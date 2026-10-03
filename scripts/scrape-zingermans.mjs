#!/usr/bin/env node
/**
 * scrape-zingermans.mjs
 * Scraper for Zingerman's Mail Order (zingermans.com) — a purpose trust-owned
 * company in Ann Arbor, MI selling food gifts, cheese, bread, pantry staples.
 *
 * Strategy: use the SearchSpring API (powers their product catalog) with
 * resultsFormat=native to get structured JSON product data. Paginate through
 * all results at 100 per page.
 *
 * Usage:
 *   node scripts/scrape-zingermans.mjs              # scrape and write store JSON
 *   node scripts/scrape-zingermans.mjs --dry-run    # show counts without writing
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'zingermans.json');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 600;
const PER_PAGE = 100;

const API_BASE = 'https://naxupv.a.searchspring.io/api/search/search.json';
const SITE_ID = 'naxupv';
const STORE_URL = 'https://www.zingermans.com';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function htmlDecode(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      if (res.status === 429) {
        console.log(`  (rate limited, waiting ${5 * (i + 1)}s...)`);
        await sleep(5000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries}: ${err.message})`);
      await sleep(2000 * (i + 1));
    }
  }
}

/**
 * Extract the best image URL from srcset or imageUrl.
 * Prefer the 2x image (280px wide) for reasonable quality.
 */
function getBestImage(result) {
  const srcset = result.image_srcset || '';
  if (srcset) {
    // Parse srcset to find 2x or 3x version
    const parts = srcset.split(',').map(s => s.trim());
    for (const target of ['2x', '3x', '1.5x', '1x']) {
      const match = parts.find(p => p.endsWith(target));
      if (match) {
        const url = match.replace(/\s+\d+(\.\d+)?x$/, '').trim();
        if (url) return url;
      }
    }
  }
  // Fallback to imageUrl or thumbnailImageUrl
  let img = result.imageUrl || result.thumbnailImageUrl || '';
  if (img.startsWith('//')) img = 'https:' + img;
  return img || null;
}

/**
 * Derive tags from SearchSpring category data.
 */
function deriveTags(result) {
  const tags = new Set();
  const hierarchies = result.category_hierarchy || [];

  for (let h of hierarchies) {
    h = htmlDecode(h);
    const parts = h.split(' > ');
    const topCat = parts[0].toLowerCase().trim();
    const skipCats = ['search results', 'custom gift contents', 'state of origin',
                      'father\'s day', 'hanukkah', 'more'];
    if (topCat && !skipCats.includes(topCat)) {
      tags.add(topCat);
    }
    if (parts.length > 1) {
      let sub = parts[1].toLowerCase().trim();
      sub = sub.replace(/^all\s+/, '');
      if (sub && sub !== 'products') {
        tags.add(sub);
      }
    }
  }

  // Add product type if meaningful (clean up hierarchy separators)
  let pt = htmlDecode(result.product_type || '').toLowerCase();
  if (pt.includes('>')) pt = pt.split('>').pop().trim();
  pt = pt.replace(/^all\s+/, '');
  if (pt && pt !== 'products') {
    tags.add(pt);
  }

  // Add special diet tags
  const diets = result.special_diet || [];
  for (const d of diets) {
    tags.add(d.toLowerCase());
  }

  // Add made-by-zingermans if present
  if (result.made_by_zingermans && result.made_by_zingermans.length > 0) {
    tags.add('made by zingermans');
  }

  return [...tags];
}

/**
 * Map a product to a site section based on its PRIMARY category hierarchy.
 * Uses only category_hierarchy (not ss_all_hierarchy) to avoid misclassifying
 * gift boxes that contain bread/cheese/etc.
 */
function mapSection(result) {
  // Use primary category hierarchy first
  const hierarchies = (result.category_hierarchy || []).map(h => htmlDecode(h).toLowerCase());
  const primaryText = hierarchies.join(' ');

  // Check primary categories in priority order
  if (primaryText.includes('gift'))
    return 'Gifts';
  if (primaryText.includes('cheese'))
    return 'Cheese';
  if (primaryText.includes('bread') || primaryText.includes('pastry') || primaryText.includes('bakery') || primaryText.includes('baked'))
    return 'Bread & Pastry';
  if (primaryText.includes('meat') || primaryText.includes('fish'))
    return 'Meat & Fish';
  if (primaryText.includes('sweet') || primaryText.includes('candy') || primaryText.includes('chocolate') || primaryText.includes('brownie'))
    return 'Sweets';
  if (primaryText.includes('olive') || primaryText.includes('oil') || primaryText.includes('vinegar'))
    return 'Oil & Vinegar';
  if (primaryText.includes('pantry') || primaryText.includes('spice') || primaryText.includes('coffee') || primaryText.includes('tea'))
    return 'Pantry';

  // Fall back to ss_all_hierarchy for uncategorized items
  const allText = (result.ss_all_hierarchy || []).map(h => htmlDecode(h).toLowerCase()).join(' ');
  if (allText.includes('gift'))
    return 'Gifts';
  if (allText.includes('cheese'))
    return 'Cheese';
  if (allText.includes('bread') || allText.includes('pastry') || allText.includes('bakery'))
    return 'Bread & Pastry';
  if (allText.includes('meat') || allText.includes('fish'))
    return 'Meat & Fish';
  if (allText.includes('sweet') || allText.includes('chocolate'))
    return 'Sweets';
  if (allText.includes('olive') || allText.includes('oil') || allText.includes('vinegar'))
    return 'Oil & Vinegar';
  if (allText.includes('pantry') || allText.includes('spice'))
    return 'Pantry';

  return 'Food & Pantry';
}

async function main() {
  console.log('Scraping Zingerman\'s via SearchSpring API...');

  const allProducts = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${API_BASE}?siteId=${SITE_ID}&resultsPerPage=${PER_PAGE}&page=${page}&resultsFormat=native`;
    console.log(`  Page ${page}/${totalPages}...`);

    const res = await fetchWithRetry(url);
    const data = await res.json();

    totalPages = data.pagination.totalPages;
    const results = data.results || [];
    console.log(`    Got ${results.length} products (total: ${data.pagination.totalResults})`);

    for (const r of results) {
      const name = r.name || r.title || '';
      if (!name) continue;

      const sku = r.sku || r.uid || r.id;
      const price = r.price ? `$${parseFloat(r.price).toFixed(2)}` : null;
      const image = getBestImage(r);
      let productUrl = r.url || '';
      if (productUrl.startsWith('//')) productUrl = 'https:' + productUrl;

      const available = r.ss_in_stock === '1' ||
                       (r.availability && r.availability.toLowerCase().includes('in stock'));

      allProducts.push({
        id: `zing-${sku}`,
        title: name,
        price,
        available,
        image,
        url: productUrl || STORE_URL,
        tags: deriveTags(r),
        _section: mapSection(r),
      });
    }

    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  // Deduplicate by SKU
  const byId = new Map();
  for (const p of allProducts) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  const unique = [...byId.values()];

  console.log(`\nTotal: ${unique.length} unique products`);

  if (DRY_RUN) {
    console.log('Dry run -- not writing files');
    const sections = {};
    for (const p of unique) {
      sections[p._section] = (sections[p._section] || 0) + 1;
    }
    console.log('Sections:', sections);
    const sample = unique.slice(0, 5);
    for (const p of sample) {
      console.log(`  ${p.title} | ${p.price} | ${p._section} | tags: ${p.tags.join(', ')}`);
    }
    return;
  }

  // Group products by section
  const sectionMap = {};
  for (const p of unique) {
    const sec = p._section;
    if (!sectionMap[sec]) sectionMap[sec] = [];
    // Remove the internal _section field before saving
    const { _section, ...product } = p;
    // Add store metadata
    sectionMap[sec].push({
      ...product,
      store_name: "Zingerman's",
      store_url: STORE_URL,
      ownership_type: 'purpose-trust',
      site_section: 'Food & Pantry',
    });
  }

  // Build sections array sorted by count descending
  const sections = Object.entries(sectionMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, products]) => ({
      label,
      count: products.length,
      products: products.sort((a, b) => {
        // Sort by price ascending
        const pa = parseFloat((a.price || '0').replace('$', ''));
        const pb = parseFloat((b.price || '0').replace('$', ''));
        return pa - pb;
      }),
    }));

  const sectionIndex = sections.map(s => ({
    slug: s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    label: s.label,
    count: s.count,
    totalPages: Math.ceil(s.count / 96),
  }));

  const storeData = {
    total: unique.length,
    sections,
    sectionIndex,
  };

  writeFileSync(STORE_FILE, JSON.stringify(storeData, null, 2));
  console.log(`\nWrote ${unique.length} products to ${STORE_FILE}`);
  for (const s of sections) {
    console.log(`  ${s.label}: ${s.count} products`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-forestry-suppliers.mjs
 * Scraper for Forestry Suppliers (forestry-suppliers.com) — purpose trust-owned.
 * Professional forestry, outdoor, and scientific equipment.
 *
 * Strategy: extract all leaf category IDs from sitemap, then hit the AJAX
 * filter endpoint /c/process_FilterItems.php for each category to get
 * server-rendered product HTML. Parse product cards from the response.
 *
 * Usage:
 *   node scripts/scrape-forestry-suppliers.mjs              # scrape and save
 *   node scripts/scrape-forestry-suppliers.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-forestry-suppliers.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'forestry-suppliers.json');
const BASE = 'https://www.forestry-suppliers.com';
const STORE_NAME = 'Forestry Suppliers';
const STORE_URL = 'https://www.forestry-suppliers.com';
const OWNERSHIP_TYPE = 'purpose-trust';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 400;
const CHECKPOINT_FILE = '/tmp/forestry-suppliers-scrape-checkpoint.json';

// Top-level category ID -> section label mapping
const TOP_CATEGORY_SECTIONS = {
  '1': 'Arborist Equipment',
  '2': 'Archaeology & Geology',
  '3': 'Cameras & Optics',
  '4': 'Clothing',
  '5': 'Wildland Firefighter Gear',
  '6': 'Footwear',
  '7': 'Forestry Equipment',
  '8': 'Hand Tools',
  '9': 'Laboratory Equipment',
  '10': 'Landscape Supply',
  '11': 'Outdoor Gear',
  '12': 'Reference Books & Media',
  '13': 'Safety Equipment',
  '14': 'Science Education',
  '15': 'Soil Management',
  '16': 'Survey & Construction',
  '17': 'Truck & ATV Accessories',
  '18': 'Water Quality Management',
  '19': 'Weather Instruments',
  '20': 'Wildlife Management',
  '1041': 'Disaster Cleanup & Readiness',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers,
        },
      });
      if (res.status === 429) {
        console.log(`  Rate limited, waiting ${15 * (i + 1)}s...`);
        await sleep(15000 * (i + 1));
        continue;
      }
      if (!res.ok && res.status !== 404) {
        console.log(`  HTTP ${res.status} for ${url}, retry ${i + 1}`);
        await sleep(3000 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
      await sleep(3000 * (i + 1));
    }
  }
}

/**
 * Parse the sitemap to extract all category URLs with their IDs and names.
 */
async function getCategoryList() {
  console.log('Fetching sitemap...');
  const res = await fetchWithRetry(`${BASE}/sitemap.xml`);
  const xml = await res.text();

  // Extract all /c/ URLs
  const locRegex = /<loc>\s*(https?:\/\/www\.forestry-suppliers\.com\/c\/[^<]+)\s*<\/loc>/g;
  const allUrls = [];
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    allUrls.push(match[1].trim());
  }

  console.log(`  Found ${allUrls.length} category URLs in sitemap`);

  // Parse each URL to get: leaf cat ID, category name, top-level parent
  // URL format: /c/category-name/1-2-3 where numbers are parent-child chain
  const seen = new Set();
  const categories = [];

  for (const url of allUrls) {
    const pathMatch = url.match(/\/c\/([^/]+)\/(\d[\d-]*)$/);
    if (!pathMatch) continue;

    const name = pathMatch[1];
    const numPath = pathMatch[2];
    const nums = numPath.split('-');
    const leafId = nums[nums.length - 1];
    const topId = nums[0];

    if (seen.has(leafId)) continue;
    seen.add(leafId);

    // Skip top-level parent categories (single number = top-level, returns 0 products)
    // But keep them if they might have products (we'll check)
    categories.push({
      catId: leafId,
      name: name.replace(/-/g, ' '),
      topId,
      section: TOP_CATEGORY_SECTIONS[topId] || 'Other',
    });
  }

  console.log(`  ${categories.length} unique category IDs extracted`);
  return categories;
}

/**
 * Parse product HTML from the filter API response.
 */
function parseProducts(html, category) {
  const products = [];

  // Match: count from "N Results found" or "N Result found"
  const countMatch = html.match(/(\d+)\s+Results?\s+found/);
  const resultCount = countMatch ? parseInt(countMatch[1]) : 0;
  if (resultCount === 0) return { products: [], totalResults: 0 };

  // Match each product card
  // Pattern: onclick="window.location='/p/XXXXX/YYYYY/slug'"
  // Image: background-image:url('/Images/300/XXXX.jpg')
  // Title: tooltip__btn small primary" ... >TITLE (SKU)</label>
  // Price: aria-label="Price">$XX.XX</span>
  const cardRegex = /class="ItemsCatDiv[^"]*"[^>]*onclick="window\.location='([^']+)'"[^]*?background-image:url\('([^']+)'\)[^]*?tooltip__btn small primary[^>]*>([^<]+)<[^]*?aria-label="Price">([^<]+)</g;

  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    const productUrl = m[1];
    const imageUrl = m[2];
    let rawTitle = m[3].trim();
    let priceStr = m[4].trim();

    // Clean title: remove trailing SKU like " (80370)"
    const skuMatch = rawTitle.match(/^(.*?)\s*\((\d+)\)\s*$/);
    const sku = skuMatch ? skuMatch[2] : null;
    const title = skuMatch ? skuMatch[1].replace(/&nbsp;/g, '').trim() : rawTitle.replace(/&nbsp;/g, '').trim();

    // Clean price: handle sale prices (strikethrough)
    // Sale format: <strike>$1,719.99</strike>&nbsp;&nbsp;<span class='septenary'>$1,619.99</span>
    // The regex captures the last price which could include markup
    // Let's do a second pass to extract clean price
    priceStr = priceStr
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    // Build product ID
    const pathParts = productUrl.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1] || '';
    const id = `forestry-suppliers-${sku || slug}`;

    // Full image URL
    const fullImage = imageUrl.startsWith('http') ? imageUrl : `${BASE}${imageUrl}`;
    const fullUrl = `${BASE}${productUrl}`;

    products.push({
      id,
      title,
      price: priceStr,
      available: true, // All listed products appear available
      image: fullImage,
      url: fullUrl,
      store_name: STORE_NAME,
      store_url: STORE_URL,
      ownership_type: OWNERSHIP_TYPE,
      site_section: category.section,
      tags: [category.name, category.section.toLowerCase()],
    });
  }

  return { products, totalResults: resultCount };
}

/**
 * Fetch all products for a given category ID, handling pagination.
 */
async function fetchCategoryProducts(category) {
  const allProducts = [];
  let page = 1;
  let totalResults = 0;

  while (true) {
    const body = new URLSearchParams({
      cat: category.catId,
      newItem: 'false',
      sale: 'false',
      stock: 'false',
      min: '',
      max: '',
      brands: '',
      sort: 'rel',
      page: String(page),
    });

    const res = await fetchWithRetry(`${BASE}/c/process_FilterItems.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res || res.status === 404) break;

    const html = await res.text();
    const { products, totalResults: total } = parseProducts(html, category);

    if (page === 1) totalResults = total;
    if (products.length === 0) break;

    allProducts.push(...products);

    // 35 products per page; if we got fewer, we're on the last page
    if (products.length < 35 || allProducts.length >= totalResults) break;

    page++;
    await sleep(DELAY_MS);
  }

  return allProducts;
}

/**
 * Save checkpoint for resumability.
 */
function saveCheckpoint(data) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(data));
}

function loadCheckpoint() {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return null;
}

/**
 * Build the final store JSON from collected products.
 */
function buildStoreJSON(allProducts) {
  // Deduplicate by product ID
  const seen = new Map();
  for (const p of allProducts) {
    if (!seen.has(p.id)) {
      seen.set(p.id, p);
    }
  }
  const deduped = [...seen.values()];

  // Group by section
  const sectionMap = {};
  for (const p of deduped) {
    const section = p.site_section;
    if (!sectionMap[section]) sectionMap[section] = [];
    sectionMap[section].push(p);
  }

  const sections = [];
  const sectionIndex = [];

  for (const [label, products] of Object.entries(sectionMap).sort((a, b) => a[0].localeCompare(b[0]))) {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    sections.push({ label, count: products.length, products });
    sectionIndex.push({
      slug,
      label,
      count: products.length,
      totalPages: Math.ceil(products.length / 12),
    });
  }

  return {
    total: deduped.length,
    sections,
    sectionIndex,
  };
}

async function main() {
  console.log(`Forestry Suppliers Scraper`);
  console.log(`========================`);

  let allProducts = [];

  if (MERGE_ONLY) {
    const cp = loadCheckpoint();
    if (!cp) {
      console.log('No checkpoint found. Run without --merge-only first.');
      process.exit(1);
    }
    allProducts = cp.products || [];
    console.log(`Loaded ${allProducts.length} products from checkpoint`);
  } else {
    // Get all categories
    const categories = await getCategoryList();

    // Load checkpoint for resume
    const cp = loadCheckpoint();
    const completedCats = new Set(cp?.completedCats || []);
    allProducts = cp?.products || [];

    if (completedCats.size > 0) {
      console.log(`Resuming: ${completedCats.size} categories already done, ${allProducts.length} products so far`);
    }

    let catIndex = 0;
    let emptyCats = 0;

    for (const cat of categories) {
      catIndex++;

      if (completedCats.has(cat.catId)) continue;

      try {
        const products = await fetchCategoryProducts(cat);

        if (products.length > 0) {
          allProducts.push(...products);
          console.log(`  [${catIndex}/${categories.length}] ${cat.name} (cat=${cat.catId}): ${products.length} products | total: ${allProducts.length}`);
        } else {
          emptyCats++;
          // Print progress every 50 empty cats
          if (emptyCats % 50 === 0) {
            console.log(`  [${catIndex}/${categories.length}] ... ${emptyCats} empty categories skipped`);
          }
        }

        completedCats.add(cat.catId);

        // Save checkpoint every 20 categories
        if (catIndex % 20 === 0) {
          saveCheckpoint({ completedCats: [...completedCats], products: allProducts });
        }

        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`  Error on cat ${cat.catId} (${cat.name}): ${err.message}`);
        // Save checkpoint and continue
        saveCheckpoint({ completedCats: [...completedCats], products: allProducts });
      }
    }

    console.log(`\nScrape complete. ${allProducts.length} products from ${categories.length} categories (${emptyCats} empty)`);
    saveCheckpoint({ completedCats: [...completedCats], products: allProducts });
  }

  // Build final JSON
  const storeJSON = buildStoreJSON(allProducts);
  console.log(`\nFinal: ${storeJSON.total} unique products across ${storeJSON.sections.length} sections`);

  for (const s of storeJSON.sectionIndex) {
    console.log(`  ${s.label}: ${s.count}`);
  }

  if (!DRY_RUN) {
    writeFileSync(STORE_FILE, JSON.stringify(storeJSON));
    console.log(`\nSaved to ${STORE_FILE}`);
  } else {
    console.log('\n(Dry run — not writing)');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

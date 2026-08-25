#!/usr/bin/env node
/**
 * scrape-scheels.mjs
 * Scraper for Scheels All Sports (scheels.com).
 *
 * Product data comes from server-rendered JSON-LD (ProductGroup) in HTML.
 * Product URLs come from their XML sitemaps (9 product sitemaps).
 * No puppeteer needed — plain HTTP fetches work.
 *
 * Usage:
 *   node scripts/scrape-scheels.mjs              # full scrape + merge
 *   node scripts/scrape-scheels.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-scheels.mjs --resume     # resume from checkpoint
 *   node scripts/scrape-scheels.mjs --merge-only # merge existing checkpoint into products.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/scheels-scrape-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');

const PARALLEL = 15;
const DELAY_MS = 200;
const CHECKPOINT_INTERVAL = 200;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 15000;

const SITEMAP_URLS = Array.from({ length: 9 }, (_, i) =>
  `https://www.scheels.com/sitemap/sitemap-products_${i + 1}.xml`
);

// Map breadcrumb/URL text to site sections
const BREADCRUMB_TO_SECTION = {
  // Sporting Goods
  'fishing': 'Sporting Goods', 'hunting': 'Sporting Goods', 'camping': 'Sporting Goods',
  'golf': 'Sporting Goods', 'baseball': 'Sporting Goods', 'softball': 'Sporting Goods',
  'basketball': 'Sporting Goods', 'football': 'Sporting Goods', 'soccer': 'Sporting Goods',
  'hockey': 'Sporting Goods', 'tennis': 'Sporting Goods', 'pickleball': 'Sporting Goods',
  'volleyball': 'Sporting Goods', 'lacrosse': 'Sporting Goods', 'wrestling': 'Sporting Goods',
  'archery': 'Sporting Goods', 'shooting': 'Sporting Goods', 'firearms': 'Sporting Goods',
  'ammunition': 'Sporting Goods', 'biking': 'Sporting Goods', 'cycling': 'Sporting Goods',
  'fitness': 'Sporting Goods', 'exercise': 'Sporting Goods', 'weights': 'Sporting Goods',
  'yoga': 'Sporting Goods', 'running': 'Sporting Goods', 'water sports': 'Sporting Goods',
  'kayak': 'Sporting Goods', 'paddle': 'Sporting Goods', 'skiing': 'Sporting Goods',
  'snowboard': 'Sporting Goods', 'skateboard': 'Sporting Goods',
  'sports': 'Sporting Goods', 'athletics': 'Sporting Goods',
  // Apparel
  'clothing': 'Apparel', 'shirts': 'Apparel', 'pants': 'Apparel', 'jackets': 'Apparel',
  'coats': 'Apparel', 'outerwear': 'Apparel', 'activewear': 'Apparel',
  'jeans': 'Apparel', 'shorts': 'Apparel', 'dresses': 'Apparel', 'sweaters': 'Apparel',
  'hoodies': 'Apparel', 'underwear': 'Apparel', 'socks': 'Apparel', 'hats': 'Apparel',
  'gloves': 'Apparel', 'accessories': 'Apparel', 'sunglasses': 'Apparel',
  'watches': 'Apparel', 'jewelry': 'Apparel', 'bags': 'Apparel', 'backpacks': 'Apparel',
  // Footwear
  'shoes': 'Apparel', 'boots': 'Apparel', 'sandals': 'Apparel', 'slippers': 'Apparel',
  'footwear': 'Apparel', 'sneakers': 'Apparel',
  // Home & Outdoors
  'home': 'Home Goods', 'kitchen': 'Home Goods', 'decor': 'Home Goods',
  'furniture': 'Home Goods', 'bedding': 'Home Goods', 'bath': 'Home Goods',
  'outdoor living': 'Home Goods', 'patio': 'Home Goods', 'grill': 'Home Goods',
  // Toys & Games
  'toys': 'Games', 'games': 'Games', 'lego': 'Games', 'puzzles': 'Games',
  // Tech
  'electronics': 'Tech & Software', 'gopro': 'Tech & Software', 'garmin': 'Tech & Software',
  'optics': 'Tech & Software',
  // Pet
  'pet': 'Home Goods',
};

function inferSection(breadcrumbs, title) {
  const text = [...breadcrumbs, title].join(' ').toLowerCase();
  for (const [keyword, section] of Object.entries(BREADCRUMB_TO_SECTION)) {
    if (text.includes(keyword)) return section;
  }
  return 'Sporting Goods'; // default for Scheels
}

function saveCheckpoint(products, completedUrls) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    products: [...products.values()],
    completedUrls: [...completedUrls],
    timestamp: new Date().toISOString(),
  }));
}

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchSitemapUrls() {
  const allUrls = [];
  for (let i = 0; i < SITEMAP_URLS.length; i++) {
    const url = SITEMAP_URLS[i];
    process.stdout.write(`Fetching sitemap ${i + 1}/${SITEMAP_URLS.length}... `);
    const res = await fetchWithTimeout(url, 30000);
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>(https:\/\/www\.scheels\.com\/p\/[^<]+)<\/loc>/g)]
      .map(m => m[1]);
    console.log(`${urls.length} URLs`);
    allUrls.push(...urls);
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`Total product URLs: ${allUrls.length}`);
  return allUrls;
}

async function scrapeProduct(url, retries = 2) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();

    // Extract JSON-LD
    const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    let pd = null;
    for (const m of ldMatches) {
      try {
        const d = JSON.parse(m[1]);
        if (d['@type'] === 'ProductGroup' || d['@type'] === 'Product') {
          pd = d;
          break;
        }
      } catch {}
    }
    if (!pd) return null;

    // Price — check top-level offers, then variants
    const price = pd.offers?.price ?? pd.hasVariant?.[0]?.offers?.price ??
      pd.hasVariant?.[0]?.offers?.[0]?.price;
    if (!price) return null;

    // Availability — check if any variant is in stock
    let inStock = false;
    if (pd.offers?.availability) {
      inStock = pd.offers.availability.includes('InStock');
    } else if (pd.hasVariant?.length) {
      inStock = pd.hasVariant.some(v => {
        const a = v.offers?.availability ?? v.offers?.[0]?.availability ?? '';
        return a.includes('InStock');
      });
    }
    if (!inStock) return null;

    // Image from og:image meta tag
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    const image = ogMatch ? ogMatch[1] : '';

    // Extract breadcrumbs from /c/ category links
    const breadcrumbs = [...new Set(
      [...html.matchAll(/href="\/c\/([^"]+)"/g)].map(m => {
        // Convert slug to readable: "mens-clothing" -> "mens clothing"
        return m[1].split('/').pop().replace(/-/g, ' ');
      })
    )];

    const id = pd.productGroupId || pd.sku || url.split('/').pop();

    return {
      id,
      title: pd.name,
      price: String(price),
      brand: pd.brand?.name || '',
      image,
      url,
      available: true,
      breadcrumbs,
    };
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return scrapeProduct(url, retries - 1);
    }
    return null;
  }
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const scheelsEntry = marketplace.find(e => e.name === 'Scheels All Sports');
  if (!scheelsEntry) {
    console.error('Scheels All Sports not found in marketplace.json');
    process.exit(1);
  }

  // Load checkpoint if resuming or merge-only
  const products = new Map();
  const completedUrls = new Set();

  if ((RESUME || MERGE_ONLY) && existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) products.set(p.id, p);
    for (const u of (cp.completedUrls || [])) completedUrls.add(u);
    console.log(`Loaded checkpoint: ${products.size} products, ${completedUrls.size} URLs completed`);
    if (MERGE_ONLY) {
      mergeIntoProductsJson(products, scheelsEntry);
      return;
    }
  }

  const allUrls = await fetchSitemapUrls();
  const todoUrls = allUrls.filter(u => !completedUrls.has(u));
  console.log(`URLs to scrape: ${todoUrls.length} (${completedUrls.size} already done)\n`);

  let processed = 0;
  let found = products.size;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < todoUrls.length; i += PARALLEL) {
    const batch = todoUrls.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map(url => scrapeProduct(url)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const url = batch[j];
      completedUrls.add(url);
      processed++;

      if (result) {
        products.set(result.id, result);
        found++;
      } else {
        skipped++;
      }
    }

    if (processed % 100 === 0 || i + PARALLEL >= todoUrls.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (todoUrls.length - processed) / rate;
      const pct = ((processed / todoUrls.length) * 100).toFixed(1);
      process.stdout.write(
        `\r  ${processed}/${todoUrls.length} (${pct}%) | ` +
        `${found} found, ${skipped} skipped | ` +
        `${rate.toFixed(1)}/s | ~${Math.round(remaining / 60)}min left   `
      );
    }

    if (processed % CHECKPOINT_INTERVAL === 0) {
      saveCheckpoint(products, completedUrls);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log('\n');
  saveCheckpoint(products, completedUrls);
  console.log(`Scrape complete: ${products.size} products found`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    return;
  }

  mergeIntoProductsJson(products, scheelsEntry);
}

function mergeIntoProductsJson(products, scheelsEntry) {
  const scheelsProducts = [...products.values()].map(p => ({
    id: `166-scheels-${p.id}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: scheelsEntry.name,
    store_url: scheelsEntry.url,
    ownership_type: scheelsEntry.ownership_type,
    site_section: inferSection(p.breadcrumbs || [], p.title || ''),
    tags: [
      p.brand,
      ...(p.breadcrumbs || []),
    ].filter(Boolean).map(t => t.toLowerCase()),
  }));

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonScheels = existing.filter(p => p.store_name !== 'Scheels All Sports');
  const final = [...nonScheels, ...scheelsProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${scheelsProducts.length} Scheels from this scrape)`);
  console.log(`  (${nonScheels.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-landrys.mjs
 * Scraper for Landry's Bicycles (landrys.com).
 *
 * Product data comes from JSON-LD (Product schema) on each page.
 * Product URLs come from their XML sitemaps (3 sub-sitemaps, ~26K URLs).
 *
 * Usage:
 *   node scripts/scrape-landrys.mjs              # full scrape + merge
 *   node scripts/scrape-landrys.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-landrys.mjs --resume     # resume from checkpoint
 *   node scripts/scrape-landrys.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/landrys-scrape-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');

const PARALLEL = 10;
const DELAY_MS = 200;
const CHECKPOINT_INTERVAL = 200;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 15000;

const SITEMAP_URLS = [
  'https://www.landrys.com/sitemap-1.xml',
  'https://www.landrys.com/sitemap-2.xml',
  'https://www.landrys.com/sitemap-3.xml',
];

// Map product categories/brands to site sections
const CATEGORY_TO_SECTION = {
  'bikes': 'Sporting Goods & Outdoors',
  'frames': 'Sporting Goods & Outdoors',
  'wheels': 'Sporting Goods & Outdoors',
  'tires': 'Sporting Goods & Outdoors',
  'tubes': 'Sporting Goods & Outdoors',
  'components': 'Sporting Goods & Outdoors',
  'drivetrain': 'Sporting Goods & Outdoors',
  'brakes': 'Sporting Goods & Outdoors',
  'pedals': 'Sporting Goods & Outdoors',
  'handlebars': 'Sporting Goods & Outdoors',
  'saddles': 'Sporting Goods & Outdoors',
  'seatposts': 'Sporting Goods & Outdoors',
  'accessories': 'Sporting Goods & Outdoors',
  'lights': 'Sporting Goods & Outdoors',
  'locks': 'Sporting Goods & Outdoors',
  'racks': 'Sporting Goods & Outdoors',
  'bags': 'Sporting Goods & Outdoors',
  'pumps': 'Sporting Goods & Outdoors',
  'tools': 'Sporting Goods & Outdoors',
  'helmets': 'Sporting Goods & Outdoors',
  'clothing': 'Apparel',
  'jerseys': 'Apparel',
  'shorts': 'Apparel',
  'jackets': 'Apparel',
  'gloves': 'Apparel',
  'shoes': 'Apparel',
  'socks': 'Apparel',
};

function inferSection(title, brand) {
  const text = [title, brand].join(' ').toLowerCase();
  // Apparel keywords
  if (/jersey|shorts?|jacket|glove|shoe|sock|tight|vest|bibs?|helmet|cap|beanie/i.test(text)) {
    return 'Apparel';
  }
  return 'Sporting Goods & Outdoors';
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
    const urls = [...xml.matchAll(/<loc>(https:\/\/(?:www\.)?landrys\.com\/products\/[^<]+)<\/loc>/g)]
      .map(m => m[1]);
    console.log(`${urls.length} URLs`);
    allUrls.push(...urls);
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
    const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!ldMatch) return null;

    let data;
    try {
      data = JSON.parse(ldMatch[1]);
    } catch {
      return null;
    }

    if (data['@type'] !== 'Product' && data['@type'] !== 'ProductGroup') return null;

    const title = data.name;
    if (!title) return null;

    // Price from offers
    const price = data.offers?.price ?? data.offers?.[0]?.price;
    if (!price) return null;

    // Availability
    const availability = data.offers?.availability ?? data.offers?.[0]?.availability ?? '';
    const inStock = availability.includes('InStock');
    if (!inStock) return null;

    // Image
    const image = Array.isArray(data.image) ? data.image[0] : (data.image || '');

    // Brand
    const brand = data.brand?.name || '';

    // SKU as ID
    const id = data.sku || url.split('/').pop().substring(0, 16);

    // Canonical URL
    const canonical = data.url || res.url || url;

    return { id, title, price: String(price), image, url: canonical, brand, available: true };
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
  const entry = marketplace.find(e => e.name === "Landry's Bicycles");
  if (!entry) {
    console.error("Landry's Bicycles not found in marketplace.json");
    process.exit(1);
  }

  const products = new Map();
  const completedUrls = new Set();

  if ((RESUME || MERGE_ONLY) && existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) products.set(p.id, p);
    for (const u of (cp.completedUrls || [])) completedUrls.add(u);
    console.log(`Loaded checkpoint: ${products.size} products, ${completedUrls.size} URLs completed`);
    if (MERGE_ONLY) {
      mergeIntoProductsJson(products, entry);
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

  mergeIntoProductsJson(products, entry);
}

function mergeIntoProductsJson(products, entry) {
  const formatted = [...products.values()].map(p => ({
    id: `${entry.id}-landrys-${p.id}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: entry.name,
    store_url: entry.url,
    ownership_type: entry.ownership_type,
    site_section: inferSection(p.title, p.brand),
    tags: [p.brand].filter(Boolean).map(t => t.toLowerCase()),
  }));

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const others = existing.filter(p => p.store_name !== "Landry's Bicycles");
  const final = [...others, ...formatted];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${formatted.length} Landry's from this scrape)`);
  console.log(`  (${others.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

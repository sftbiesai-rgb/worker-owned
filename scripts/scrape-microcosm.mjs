#!/usr/bin/env node
/**
 * scrape-microcosm.mjs
 * Scraper for Microcosm Publishing (microcosmpublishing.com).
 *
 * Product data comes from HTML meta tags + itemprop attributes.
 * Product URLs come from their XML sitemap (~43K product URLs).
 *
 * Usage:
 *   node scripts/scrape-microcosm.mjs              # full scrape + merge
 *   node scripts/scrape-microcosm.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-microcosm.mjs --resume     # resume from checkpoint
 *   node scripts/scrape-microcosm.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/microcosm-scrape-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');

const PARALLEL = 10;
const DELAY_MS = 200;
const CHECKPOINT_INTERVAL = 200;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 15000;

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
  console.log('Fetching sitemap...');
  const res = await fetchWithTimeout('https://microcosmpublishing.com/sitemap.xml', 60000);
  const xml = await res.text();
  // Extract product URLs: /catalog/{category}/{id}
  const urls = [...xml.matchAll(/<loc>(https:\/\/microcosmpublishing\.com\/catalog\/[^/]+\/\d+)<\/loc>/g)]
    .map(m => m[1]);
  console.log(`Found ${urls.length} product URLs in sitemap`);
  return urls;
}

async function scrapeProduct(url, retries = 2) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();

    // Title from <h1 itemprop="name">
    const titleMatch = html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/);
    if (!titleMatch) return null;
    const title = titleMatch[1].trim();

    // Price from meta product:price:amount
    const priceMatch = html.match(/<meta\s+property="product:price:amount"\s+content="([^"]+)"/);
    if (!priceMatch) return null;
    const price = priceMatch[1];

    // Availability from meta product:availability
    const availMatch = html.match(/<meta\s+property="product:availability"\s+content="([^"]+)"/);
    const available = availMatch ? availMatch[1].toLowerCase().includes('in stock') : false;
    if (!available) return null;

    // Image from <img itemprop="image" src="...">
    const imgMatch = html.match(/<img\s+itemprop="image"\s+src="([^"]+)"/);
    const image = imgMatch ? `https://microcosmpublishing.com${imgMatch[1]}` : '';

    // Category from URL
    const catMatch = url.match(/\/catalog\/([^/]+)\//);
    const category = catMatch ? catMatch[1] : '';

    // ID from URL
    const idMatch = url.match(/\/(\d+)$/);
    const id = idMatch ? idMatch[1] : url.split('/').pop();

    return { id, title, price, image, url: res.url, category, available };
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
  const entry = marketplace.find(e => e.name === 'Microcosm Publishing');
  if (!entry) {
    console.error('Microcosm Publishing not found in marketplace.json');
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
  const CATEGORY_TO_SECTION = {
    'books': 'Books & Media', 'zines': 'Books & Media', 'ebooks': 'Books & Media',
    'audio': 'Books & Media', 'videos': 'Books & Media', 'journals': 'Books & Media',
    'stickers': 'Books & Media', 'patches': 'Books & Media', 'buttons': 'Books & Media',
    'posters': 'Books & Media', 'tshirts': 'Apparel', 'cards': 'Books & Media',
    'magnets': 'Books & Media', 'enamel-pins': 'Books & Media', 'other': 'Books & Media',
    'decks': 'Games', 'bundle': 'Books & Media', 'gift-cards': 'Books & Media',
    'slightly-damaged': 'Books & Media',
  };

  const formatted = [...products.values()].map(p => ({
    id: `${entry.id}-microcosm-${p.id}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: entry.name,
    store_url: entry.url,
    ownership_type: entry.ownership_type,
    site_section: CATEGORY_TO_SECTION[p.category] || 'Books & Media',
    tags: [p.category].filter(Boolean),
  }));

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const others = existing.filter(p => p.store_name !== 'Microcosm Publishing');
  const final = [...others, ...formatted];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${formatted.length} Microcosm from this scrape)`);
  console.log(`  (${others.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

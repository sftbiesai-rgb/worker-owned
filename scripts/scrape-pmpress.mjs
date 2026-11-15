#!/usr/bin/env node
/**
 * scrape-pmpress.mjs
 * Scraper for PM Press (pmpress.org), a worker co-op publisher.
 *
 * PM Press moved off SunShop (index.php?l=product_detail&p=N links are dead)
 * to a UnifyCart shop in fall 2026. This walks the /shop listing
 * (24 per page) and keeps only in-stock cards. IDs use the product URL slug.
 *
 * Usage:
 *   node scripts/scrape-pmpress.mjs              # scrape and merge into products.json
 *   node scripts/scrape-pmpress.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-pmpress.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://pmpress.org';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/pmpress-scrape-checkpoint.json';
const STORE_ID = 153;
const STORE_NAME = 'PM Press';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      if (res.ok || res.status === 404) return res;
      console.log(`  (HTTP ${res.status}, retry ${i + 1}/${retries})`);
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
    }
    await sleep(3000 * (i + 1));
  }
  return null;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&rsquo;/g, '\u2019')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

// Grid cards on /shop?page=N. In-stock items have an "Add" <button>; sold-out
// items show a greyed-out <span class="add">Sold Out</span> instead, so only
// cards with the button are kept. (The page also has a list view of the same
// products, which isn't split on <div class="card">.)
function parseShopPage(html) {
  const products = [];
  let soldOut = 0;
  for (const card of html.split('<div class="card">').slice(1)) {
    const link = card.match(/<h3><a href="(https:\/\/pmpress\.org\/product\/([^"]+))">([\s\S]*?)<\/a><\/h3>/);
    if (!link) continue;
    if (!/<button[^>]*class="add"/.test(card)) { soldOut++; continue; }
    const price = card.match(/<div class="price">\s*\$([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '');
    const image = card.match(/<img src="([^"]+)"/)?.[1];
    if (!price || !(parseFloat(price) > 0) || !image) continue;
    products.push({
      productId: link[2],
      title: decodeEntities(link[3]),
      price: `$${parseFloat(price).toFixed(2)}`,
      image,
      url: link[1],
      category: decodeEntities(card.match(/<div class="cat">([^<]*)<\/div>/)?.[1] || ''),
    });
  }
  return { products, soldOut };
}

function inferTags(title) {
  const t = title.toLowerCase();
  const tags = [];

  if (t.includes('dvd') || t.includes('video')) {
    tags.push('dvd', 'video');
  } else if (t.includes(' cd') || t.includes('audio cd') || t.includes('audiobook')) {
    tags.push('audio', 'audiobook');
  } else if (t.includes('t-shirt') || t.includes('tee') || t.includes('shirt')) {
    tags.push('apparel', 't-shirt');
  } else if (t.includes('poster') || t.includes('print')) {
    tags.push('art', 'poster');
  } else if (t.includes('sticker') || t.includes('button') || t.includes('pin') || t.includes('patch')) {
    tags.push('accessories');
  } else {
    // Default: books (PM Press is primarily a book publisher)
    tags.push('books');
  }

  // Topic tags based on title keywords
  if (t.includes('anarch')) tags.push('anarchism');
  if (t.includes('marx') || t.includes('socialis') || t.includes('communist') || t.includes('communis')) tags.push('socialism');
  if (t.includes('feminis')) tags.push('feminism');
  if (t.includes('labor') || t.includes('union') || t.includes('worker')) tags.push('labor');
  if (t.includes('history') || t.includes('histor')) tags.push('history');
  if (t.includes('fiction') || t.includes('novel') || t.includes('stories')) tags.push('fiction');
  if (t.includes('graphic novel') || t.includes('comic')) tags.push('graphic novel');
  if (t.includes('music') || t.includes('punk')) tags.push('music');
  if (t.includes('ecology') || t.includes('climate') || t.includes('environment')) tags.push('ecology');

  return tags;
}

/**
 * Determine site_section from tags.
 */
function getSiteSection(tags) {
  if (tags.includes('dvd') || tags.includes('video')) return 'Movies & TV';
  if (tags.includes('audio') || tags.includes('audiobook')) return 'Music';
  if (tags.includes('apparel') || tags.includes('t-shirt')) return 'Clothing';
  if (tags.includes('accessories')) return 'Accessories';
  if (tags.includes('art') || tags.includes('poster')) return 'Art';
  return 'Books';
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const storeEntry = marketplace.find(e => e.name === STORE_NAME);
  if (!storeEntry) {
    console.error(`${STORE_NAME} not found in marketplace.json`);
    process.exit(1);
  }

  const byId = new Map();
  let failedPages = 0;

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error(`Checkpoint file not found: ${CHECKPOINT_FILE}`);
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) byId.set(p.productId, p);
    console.log(`Loaded checkpoint: ${byId.size} products`);
  } else {
    let soldOut = 0;
    for (let page = 1; page <= 500; page++) {
      const res = await fetchWithRetry(`${BASE}/shop?page=${page}`);
      if (!res || !res.ok) { console.log(`  page ${page}: failed, stopping`); failedPages++; break; }
      const { products, soldOut: so } = parseShopPage(await res.text());
      soldOut += so;
      const before = byId.size;
      for (const p of products) byId.set(p.productId, p);
      console.log(`  page ${page}: ${products.length} in stock, ${so} sold out (${byId.size} total)`);
      if (!products.length && !so) break;
      await sleep(DELAY_MS);
    }
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products: [...byId.values()], timestamp: new Date().toISOString() }));
    console.log(`Skipped ${soldOut} sold-out items`);
  }

  console.log(`\nTotal: ${byId.size} unique products`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    // Show a sample
    const sample = [...byId.values()].slice(0, 5);
    for (const p of sample) {
      console.log(`  - ${p.title} | ${p.price} | ${p.url}`);
    }
    return;
  }

  // Refuse to replace the store on a partial scrape (blocked, layout change)
  if (failedPages || byId.size < 500) {
    console.error(`\nABORTING MERGE: only ${byId.size} products${failedPages ? ' and a page failed' : ''}. Checkpoint at ${CHECKPOINT_FILE}.`);
    process.exit(1);
  }

  // Format for products.json
  const storeProducts = [...byId.values()].map(p => {
    const tags = inferTags(p.title);
    return {
      id: `${STORE_ID}-pmpress-${p.productId}`,
      title: p.title,
      price: p.price,
      available: true,
      image: p.image,
      url: p.url,
      store_name: STORE_NAME,
      store_url: storeEntry.url,
      ownership_type: storeEntry.ownership_type,
      site_section: getSiteSection(tags),
      tags,
    };
  });

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonStore = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...nonStore, ...storeProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${storeProducts.length} ${STORE_NAME} from this scrape)`);
  console.log(`  (${nonStore.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-vernier.mjs
 * Scraper for Vernier Science Education (vernier.com) — a WooCommerce store.
 * Purpose trust-owned company selling STEM education / lab equipment.
 *
 * Strategy: use the public WooCommerce Store API v1 to paginate through
 * all products. The API returns up to 100 products per page.
 *
 * Usage:
 *   node scripts/scrape-vernier.mjs              # scrape and write store JSON
 *   node scripts/scrape-vernier.mjs --dry-run    # show counts without writing
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'vernier-science-education.json');
const BASE = 'https://www.vernier.com';
const API = `${BASE}/wp-json/wc/store/v1/products`;
const PER_PAGE = 100;
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 600;
const CHECKPOINT_FILE = '/tmp/vernier-scrape-checkpoint.json';

const STORE_NAME = 'Vernier Science Education';
const STORE_URL = 'https://www.vernier.com';
const OWNERSHIP_TYPE = 'purpose trust';
const SITE_SECTION = 'Tech & Software';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
      await sleep(2000 * (i + 1));
    }
  }
}

/**
 * Derive tags from WooCommerce categories.
 * Returns lowercase category names, filtering out overly generic ones.
 */
function deriveTags(categories) {
  if (!Array.isArray(categories)) return [];
  return categories
    .map(c => c.name?.replace(/<[^>]+>/g, '').toLowerCase().trim())
    .filter(Boolean)
    .filter(t => !['uncategorized'].includes(t));
}

/**
 * Format price from WooCommerce Store API cents integer to "$X.XX" string.
 * The API returns price as a string of cents (e.g. "8500" = $85.00).
 */
function formatPrice(prices) {
  if (!prices?.price) return null;
  const cents = parseInt(prices.price, 10);
  if (isNaN(cents) || cents <= 0) return null;
  const minorUnit = prices.currency_minor_unit ?? 2;
  const dollars = cents / Math.pow(10, minorUnit);
  return `$${dollars.toFixed(2)}`;
}

async function scrapeAll() {
  const allProducts = [];
  let page = 1;
  let total = 0;

  // Resume from checkpoint if available
  let startPage = 1;
  if (existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
      if (cp.products?.length) {
        allProducts.push(...cp.products);
        startPage = cp.nextPage || 1;
        console.log(`Resuming from checkpoint: ${cp.products.length} products, page ${startPage}`);
      }
    } catch {}
  }

  page = startPage;

  while (true) {
    const url = `${API}?per_page=${PER_PAGE}&page=${page}`;
    console.log(`Fetching page ${page}... ${url}`);

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.log(`  HTTP ${res.status} — stopping pagination`);
      break;
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      console.log(`  Non-JSON response — stopping`);
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`  Empty page — done`);
      break;
    }

    let pageCount = 0;
    for (const p of data) {
      const price = formatPrice(p.prices);
      const image = p.images?.[0]?.src || p.images?.[0]?.thumbnail;
      const url = p.permalink;

      // Skip products without price or image
      if (!price || !image || !url) continue;

      allProducts.push({
        id: `vernier-${p.id}`,
        title: p.name,
        price,
        image,
        url,
        available: p.is_in_stock ?? true,
        tags: deriveTags(p.categories),
      });
      pageCount++;
    }

    console.log(`  Got ${data.length} items, kept ${pageCount} (total: ${allProducts.length})`);

    // Checkpoint every 3 pages
    if (page % 3 === 0) {
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products: allProducts, nextPage: page + 1 }));
    }

    // If fewer than PER_PAGE, this is the last page
    if (data.length < PER_PAGE) break;

    page++;
    await sleep(DELAY_MS);
  }

  return allProducts;
}

/**
 * Group products into sections by their primary category.
 */
function groupIntoSections(products) {
  const sectionMap = new Map();

  for (const p of products) {
    // Use the first tag as the section label, or "other"
    const label = p.tags[0] || 'other';
    if (!sectionMap.has(label)) {
      sectionMap.set(label, []);
    }
    sectionMap.get(label).push(p);
  }

  // Sort sections by count descending
  return [...sectionMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, products]) => ({
      label,
      count: products.length,
      products,
    }));
}

async function main() {
  console.log(`Scraping ${STORE_NAME} (${STORE_URL})...`);
  console.log(`Using WooCommerce Store API: ${API}`);
  console.log();

  const products = await scrapeAll();
  console.log();
  console.log(`Total products scraped: ${products.length}`);

  if (DRY_RUN) {
    console.log('(dry run — not writing files)');
    // Show section breakdown
    const sections = groupIntoSections(products);
    for (const s of sections) {
      console.log(`  ${s.label}: ${s.count}`);
    }
    return;
  }

  const sections = groupIntoSections(products);
  const output = {
    total: products.length,
    sections,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output));
  console.log(`Wrote ${products.length} products to ${OUT_FILE}`);

  // Show section breakdown
  console.log('\nSections:');
  for (const s of sections) {
    console.log(`  ${s.label}: ${s.count}`);
  }

  // Clean up checkpoint
  try {
    const { unlinkSync } = await import('fs');
    if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
  } catch {}
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

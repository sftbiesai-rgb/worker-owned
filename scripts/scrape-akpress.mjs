#!/usr/bin/env node
/**
 * scrape-akpress.mjs
 * Scraper for AK Press (akpress.org) — a Magento 2 store selling
 * radical/political books. Worker co-op.
 *
 * Paginates through the product listing at /products.html (30 per page,
 * ~106 pages). Extracts title, price, image, and URL from product cards.
 *
 * Usage:
 *   node scripts/scrape-akpress.mjs              # scrape and merge into products.json
 *   node scripts/scrape-akpress.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-akpress.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const BASE = 'https://www.akpress.org';
const STORE_ID = 13;
const STORE_NAME = 'AK Press';
const STORE_URL = 'https://www.akpress.org';
const OWNERSHIP_TYPE = 'worker co-op';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/akpress-scrape-checkpoint.json';
const PRODUCTS_PER_PAGE = 30;
const MAX_PAGES = 120; // safety cap (expect ~106)

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      const backoff = 2000 * (i + 1);
      console.log(`  (retry ${i + 1}/${retries} after ${err.message}, waiting ${backoff}ms)`);
      await sleep(backoff);
    }
  }
}

/**
 * Extract a slug from a product URL for use in the product ID.
 * e.g. "https://www.akpress.org/some-book.html" -> "some-book"
 */
function slugFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    // Remove leading slash and trailing .html
    return path.replace(/^\//, '').replace(/\.html$/, '').replace(/[^a-z0-9-]/g, '-');
  } catch {
    return url.replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  }
}

/**
 * Decode common HTML entities.
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parse product cards from a Magento 2 product listing page.
 * Magento 2 typically uses:
 *   .product-item or .product-item-info containers
 *   .product-item-link for the title/URL
 *   .price for the price
 *   .product-image-photo for the image
 */
function parseListingPage(html) {
  const products = [];

  // AK Press uses simple <li> elements with <a href><img></a> <a href><h3>title</h3></a> <p>price</p>
  // Find all product links pointing to .html pages on akpress.org
  const productPattern = /href="(https?:\/\/www\.akpress\.org\/[^"]+\.html)"[^>]*>\s*<h3>([^<]+)<\/h3>/g;
  let m;
  const seen = new Set();

  while ((m = productPattern.exec(html)) !== null) {
    const url = m[1].trim();
    const title = decodeEntities(m[2].trim());

    // Skip category/non-product pages
    if (url.includes('products.html') || url.includes('customer/') || url.includes('checkout/')) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    if (!title) continue;

    // Find price near this product — look backwards from this match position for price text
    // Search in the surrounding context (next 500 chars after this match)
    const after = html.substring(m.index, m.index + 1000);
    let price = null;
    // Try "Special Price $X.XX" first, then regular "$X.XX"
    const specialPrice = after.match(/Special Price\s*\$(\d+(?:\.\d{2})?)/);
    const regularPrice = after.match(/\$(\d+(?:\.\d{2})?)/);
    if (specialPrice) {
      price = `$${specialPrice[1]}`;
    } else if (regularPrice) {
      price = `$${regularPrice[1]}`;
    }

    // Find image — look before this match for the img tag in the same <li>
    const before = html.substring(Math.max(0, m.index - 500), m.index);
    let image = null;
    const imgMatch = before.match(/<img[^>]*src="(https?:\/\/www\.akpress\.org\/media\/catalog\/[^"]+)"/);
    if (imgMatch) {
      image = imgMatch[1];
    }

    const slug = slugFromUrl(url);

    products.push({
      slug,
      title,
      price,
      image,
      url,
    });
  }

  return products;
}

async function scrapePage(pageNum) {
  const url = pageNum === 1
    ? `${BASE}/products.html?product_list_limit=${PRODUCTS_PER_PAGE}`
    : `${BASE}/products.html?product_list_limit=${PRODUCTS_PER_PAGE}&p=${pageNum}`;

  const res = await fetchWithRetry(url);
  const html = await res.text();
  return parseListingPage(html);
}

async function main() {
  const bySlug = new Map();

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error(`Checkpoint file not found: ${CHECKPOINT_FILE}`);
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) bySlug.set(p.slug, p);
    console.log(`Loaded checkpoint: ${bySlug.size} products`);
  } else {
    // Determine starting page from checkpoint
    let startPage = 1;
    if (existsSync(CHECKPOINT_FILE)) {
      try {
        const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
        if (cp.lastPage) {
          startPage = cp.lastPage + 1;
          for (const p of cp.products) bySlug.set(p.slug, p);
          console.log(`Resuming from page ${startPage} (${bySlug.size} products in checkpoint)`);
        }
      } catch {
        // ignore bad checkpoint
      }
    }

    console.log(`Scraping AK Press product listings (${PRODUCTS_PER_PAGE}/page)...`);

    let emptyStreak = 0;

    for (let page = startPage; page <= MAX_PAGES; page++) {
      process.stdout.write(`  Page ${page}... `);

      let products;
      try {
        products = await scrapePage(page);
      } catch (err) {
        console.log(`FAIL: ${err.message}`);
        emptyStreak++;
        if (emptyStreak >= 3) {
          console.log('  3 consecutive failures — stopping pagination.');
          break;
        }
        await sleep(DELAY_MS);
        continue;
      }

      if (products.length === 0) {
        console.log('0 products (end of catalog)');
        emptyStreak++;
        if (emptyStreak >= 3) {
          console.log('  3 consecutive empty pages — stopping pagination.');
          break;
        }
      } else {
        emptyStreak = 0;
        let newCount = 0;
        for (const p of products) {
          if (!bySlug.has(p.slug)) {
            bySlug.set(p.slug, p);
            newCount++;
          }
        }
        console.log(`${products.length} found, ${newCount} new (${bySlug.size} unique total)`);
      }

      // Save checkpoint every 10 pages
      if (page % 10 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          lastPage: page,
          products: [...bySlug.values()],
        }));
        console.log(`  (checkpoint saved: page ${page}, ${bySlug.size} products)`);
      }

      await sleep(DELAY_MS);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      lastPage: MAX_PAGES,
      products: [...bySlug.values()],
    }));
    console.log(`\nCheckpoint saved to ${CHECKPOINT_FILE}`);
  }

  console.log(`\nTotal: ${bySlug.size} unique products`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    return;
  }

  // Format for products.json
  const akProducts = [...bySlug.values()].map(p => ({
    id: `${STORE_ID}-akpress-${p.slug}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: STORE_NAME,
    store_url: STORE_URL,
    ownership_type: OWNERSHIP_TYPE,
    site_section: 'Books',
    tags: ['books'],
  }));

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonAK = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...nonAK, ...akProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${akProducts.length} AK Press from this scrape)`);
  console.log(`  (${nonAK.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

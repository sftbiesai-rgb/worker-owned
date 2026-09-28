#!/usr/bin/env node
/**
 * scrape-bimart.mjs
 * Scraper for Bi-Mart (bimart.com) — a Mozu/Kibo Commerce store.
 * Employee-owned (ESOP) discount retailer.
 *
 * Strategy: get all product URLs from sitemap batches (~16,000 products),
 * then fetch each product page and extract the server-rendered JSON from
 * the <script id="data-mz-preload-product"> tag.
 *
 * Usage:
 *   node scripts/scrape-bimart.mjs              # scrape and merge
 *   node scripts/scrape-bimart.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-bimart.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const BASE = 'https://www.bimart.com';
const STORE_ID = 158;
const STORE_NAME = 'Bi-Mart';
const STORE_URL = 'https://www.bimart.com';
const OWNERSHIP_TYPE = 'ESOP';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 5000; // robots.txt requests 5s crawl delay
const CONCURRENCY = 1; // single request to avoid rate limits
const CHECKPOINT_FILE = '/tmp/bimart-scrape-checkpoint.json';

// Map Bi-Mart category names to site sections
const CATEGORY_TO_SECTION = {
  'electronics': 'Tech & Software',
  'hardware': 'Home Goods & Services',
  'lawn & garden': 'Home & Garden',
  'automotive': 'Home Goods & Services',
  'grocery & beverage': 'Food & Pantry',
  'sports & outdoors': 'Sporting Goods',
  'home': 'Home Goods & Services',
  'pet care': 'Home Goods & Services',
  'household essentials': 'Home Goods & Services',
  'office supplies': 'Home Goods & Services',
  'health & wellness': 'Personal Care & Wellness',
  'personal care': 'Personal Care & Wellness',
  'beauty': 'Personal Care & Wellness',
  'clothing': 'Apparel',
  'footwear': 'Apparel',
  'baby': 'Home Goods & Services',
  'toys': 'Games & Toys',
  'holiday & seasonal': 'Home Goods & Services',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.status === 429) {
        console.log(`  Rate limited, waiting ${15 * (i + 1)}s...`);
        await sleep(15000 * (i + 1));
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

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Get all product URLs from sitemap batches.
 */
async function fetchAllProductUrls() {
  console.log('Fetching sitemap index...');
  const res = await fetchWithRetry(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();

  const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m => m[1])
    .filter(u => u.includes('productBatch'));

  console.log(`Found ${sitemapUrls.length} product sitemap batches`);

  const allUrls = [];
  for (let i = 0; i < sitemapUrls.length; i++) {
    process.stdout.write(`  Batch ${i + 1}/${sitemapUrls.length}... `);
    await sleep(1000);
    const batchRes = await fetchWithRetry(sitemapUrls[i]);
    if (!batchRes.ok) { console.log(`FAIL ${batchRes.status}`); continue; }
    const batchXml = await batchRes.text();
    const urls = [...batchXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1])
      .filter(u => u.includes('/p/'));
    allUrls.push(...urls);
    console.log(`${urls.length} URLs (${allUrls.length} total)`);
  }

  return allUrls;
}

/**
 * Extract product data from a Bi-Mart product page HTML.
 * Parses the <script id="data-mz-preload-product"> JSON tag.
 */
function parseProductPage(html, url) {
  const match = html.match(/id="data-mz-preload-product">([^<]+)<\/script>/);
  if (!match) return null;

  let product;
  try {
    product = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const name = product.content?.productName || product.productName;
  if (!name) return null;

  const price = product.price?.salePrice || product.price?.price;
  if (!price) return null;

  let image = product.content?.productImages?.[0]?.imageUrl;
  if (image && image.startsWith('//')) image = 'https:' + image;

  // Get categories — find the top-level department
  const categories = product.categories || [];
  const categoryNames = categories
    .map(c => c.content?.name || '')
    .filter(n => n && n !== 'Searchable Products');

  // Find matching site section from top-level category
  let siteSection = 'Home Goods & Services';
  const tags = [];
  for (const cat of categoryNames) {
    const lower = cat.toLowerCase();
    tags.push(lower);
    if (CATEGORY_TO_SECTION[lower]) {
      siteSection = CATEGORY_TO_SECTION[lower];
    }
  }

  const productCode = product.productCode || url.match(/\/p\/(\d+)/)?.[1];

  return {
    productCode,
    title: decodeEntities(name),
    price: `$${Number(price).toFixed(2)}`,
    image,
    url,
    siteSection,
    tags,
    available: product.inventoryInfo?.onlineStockAvailable > 0,
  };
}

/**
 * Scrape a batch of URLs concurrently.
 */
async function scrapeBatch(urls, byCode, startIdx) {
  const results = await Promise.allSettled(
    urls.map(async (url, i) => {
      const res = await fetchWithRetry(url);
      if (!res.ok) return null;
      const html = await res.text();
      return parseProductPage(html, url);
    })
  );

  let newCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const p = result.value;
      if (!byCode.has(p.productCode)) {
        byCode.set(p.productCode, p);
        newCount++;
      }
    }
  }
  return newCount;
}

async function main() {
  const byCode = new Map();
  let allUrls = [];
  let startFrom = 0;

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error('No checkpoint found');
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) byCode.set(p.productCode, p);
    console.log(`Loaded checkpoint: ${byCode.size} products`);
  } else {
    // Load checkpoint to resume
    if (existsSync(CHECKPOINT_FILE)) {
      const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
      for (const p of cp.products) byCode.set(p.productCode, p);
      startFrom = cp.lastIndex || 0;
      allUrls = cp.urls || [];
      console.log(`Resuming from checkpoint: ${byCode.size} products, index ${startFrom}`);
    }

    if (allUrls.length === 0) {
      allUrls = await fetchAllProductUrls();
      // Save URLs to checkpoint
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        products: [...byCode.values()],
        urls: allUrls,
        lastIndex: 0,
      }));
    }

    console.log(`\nScraping ${allUrls.length} product pages (${CONCURRENCY} concurrent, ${DELAY_MS}ms delay)...`);

    for (let i = startFrom; i < allUrls.length; i += CONCURRENCY) {
      const batch = allUrls.slice(i, i + CONCURRENCY);
      const newCount = await scrapeBatch(batch, byCode, i);

      if ((i + CONCURRENCY) % 10 === 0 || i + CONCURRENCY >= allUrls.length) {
        process.stdout.write(`  [${Math.min(i + CONCURRENCY, allUrls.length)}/${allUrls.length}] ${byCode.size} products\n`);
      }

      // Save checkpoint every 50 products
      if ((i + CONCURRENCY) % 50 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          products: [...byCode.values()],
          urls: allUrls,
          lastIndex: i + CONCURRENCY,
        }));
      }

      await sleep(DELAY_MS);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      products: [...byCode.values()],
      urls: allUrls,
      lastIndex: allUrls.length,
    }));
  }

  console.log(`\nTotal: ${byCode.size} unique products`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    // Show samples
    const samples = [...byCode.values()].slice(0, 5);
    for (const s of samples) {
      console.log(`  ${s.title} | ${s.price} | ${s.siteSection} | ${s.url}`);
    }
    return;
  }

  // Format for products.json
  const bimartProducts = [...byCode.values()]
    .filter(p => p.available !== false)
    .map(p => ({
      id: `${STORE_ID}-bimart-${p.productCode}`,
      title: p.title,
      price: p.price,
      available: true,
      image: p.image,
      url: p.url,
      store_name: STORE_NAME,
      store_url: STORE_URL,
      ownership_type: OWNERSHIP_TYPE,
      site_section: p.siteSection,
      tags: p.tags,
    }));

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonBimart = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...nonBimart, ...bimartProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${bimartProducts.length} Bi-Mart from this scrape)`);
  console.log(`  (${nonBimart.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-frontier.mjs
 * Scraper for Frontier Co-op (frontiercoop.com) — a Magento store selling
 * spices, herbs, teas, and botanicals. Member co-op (retailers as members).
 *
 * Strategy: crawl category listing pages with pagination (?p=N), extract
 * product data from each listing page. Magento defaults to 24 items/page.
 *
 * Usage:
 *   node scripts/scrape-frontier.mjs              # scrape and merge into products.json
 *   node scripts/scrape-frontier.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-frontier.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://www.frontiercoop.com';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/frontier-scrape-checkpoint.json';

// Categories to crawl with their base paths and tag assignments
const CATEGORIES = [
  { path: '/spices-and-seasonings', tags: ['spices', 'seasonings'] },
  { path: '/bulk', tags: ['bulk'] },
  { path: '/herbs-and-teas', tags: ['herbs', 'teas'] },
  { path: '/cooking-and-baking', tags: ['cooking', 'baking'] },
  { path: '/health-and-personal-care', tags: ['health', 'personal care'] },
  { path: '/accessories', tags: ['accessories'] },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      if (res.status === 429) {
        console.log(`  (rate limited, waiting ${5 * (i + 1)}s...)`);
        await sleep(5000 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
      await sleep(2000 * (i + 1));
    }
  }
}

/**
 * Parse product data from a Magento category listing page.
 * Looks for structured product data in the HTML — product cards typically
 * contain name, price, image, and URL.
 */
function parseListingPage(html) {
  const products = [];

  // Strategy 1: Look for JSON-LD or dataLayer product data
  const dataLayerMatch = html.match(/var\s+dlObjects\s*=\s*(\[[\s\S]*?\]);/);
  if (dataLayerMatch) {
    try {
      const dlItems = JSON.parse(dataLayerMatch[1]);
      for (const item of dlItems) {
        if (item.name && item.id) {
          products.push({
            sku: String(item.id),
            title: item.name,
            price: item.price ? `$${parseFloat(item.price).toFixed(2)}` : null,
            image: null, // will need to get from HTML
            url: null,   // will need to get from HTML
          });
        }
      }
    } catch (e) {
      // fall through to HTML parsing
    }
  }

  // Strategy 2: Parse product cards from HTML
  // Magento typically uses .product-item or .product-item-info containers
  const cardPattern = /<li[^>]*class="[^"]*product[- ]item[^"]*"[^>]*>([\s\S]*?)(?=<li[^>]*class="[^"]*product[- ]item[^"]*"|<\/ol>|<\/ul>)/gi;
  let cardMatch;
  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const card = cardMatch[1];

    // Product URL and title
    const linkMatch = card.match(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1].trim();
    const title = linkMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!title) continue;

    // SKU from URL or data attribute
    // Frontier URLs are like /product-name.html or /product-name
    const skuFromUrl = url.replace(BASE, '').replace(/\.html$/, '').replace(/^\//, '').replace(/\//g, '-');
    const dataSkuMatch = card.match(/data-product-id="(\d+)"/i) ||
                         card.match(/data-product-sku="([^"]+)"/i) ||
                         card.match(/value="(\d+)"[^>]*class="[^"]*product[^"]*id/i);
    const sku = dataSkuMatch ? dataSkuMatch[1] : skuFromUrl;

    // Price
    const priceMatch = card.match(/data-price-amount="([\d.]+)"/i) ||
                       card.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*\$([\d,.]+)\s*<\/span>/i) ||
                       card.match(/\$([\d,.]+)/);
    const price = priceMatch ? `$${parseFloat(priceMatch[1]).toFixed(2)}` : null;

    // Image
    const imgMatch = card.match(/<img[^>]*src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
                     card.match(/<img[^>]*data-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
                     card.match(/<img[^>]*src="([^"]+)"/i);
    let image = imgMatch ? imgMatch[1] : null;

    // Deduplicate: skip if we already have this product from dataLayer
    const existing = products.find(p => p.sku === sku);
    if (existing) {
      // Fill in missing fields from HTML
      if (!existing.url) existing.url = url;
      if (!existing.image && image) existing.image = image;
      if (!existing.price && price) existing.price = price;
      continue;
    }

    products.push({ sku, title, price, image, url });
  }

  // Strategy 3: Fallback — broader product-item-info pattern
  if (products.length === 0) {
    const infoPattern = /<div[^>]*class="[^"]*product-item-info[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*product-item-info[^"]*"|<\/ol>|<\/ul>|$)/gi;
    while ((cardMatch = infoPattern.exec(html)) !== null) {
      const card = cardMatch[1];

      const linkMatch = card.match(/href="(https?:\/\/[^"]*frontiercoop\.com[^"]+)"[^>]*>\s*([^<]+)/i) ||
                        card.match(/href="(\/[^"]+)"[^>]*>\s*([^<]+)/i);
      if (!linkMatch) continue;

      let url = linkMatch[1];
      if (url.startsWith('/')) url = BASE + url;
      const title = linkMatch[2].replace(/\s+/g, ' ').trim();
      if (!title || title.length < 3) continue;

      const skuFromUrl = url.replace(BASE, '').replace(/\.html$/, '').replace(/^\//, '').replace(/\//g, '-');
      const dataIdMatch = card.match(/data-product-id="(\d+)"/i);
      const sku = dataIdMatch ? dataIdMatch[1] : skuFromUrl;

      const priceMatch = card.match(/data-price-amount="([\d.]+)"/i) ||
                         card.match(/\$([\d,.]+)/);
      const price = priceMatch ? `$${parseFloat(priceMatch[1]).toFixed(2)}` : null;

      const imgMatch = card.match(/<img[^>]*src="(https?:\/\/[^"]+)"/i);
      const image = imgMatch ? imgMatch[1] : null;

      products.push({ sku, title, price, image, url });
    }
  }

  return products;
}

/**
 * Detect the total number of pages for a category.
 * Magento pagination typically uses .pages-items with numbered links.
 */
function detectTotalPages(html) {
  // Look for last page number in pagination
  const pageLinks = [...html.matchAll(/\?p=(\d+)/g)];
  if (pageLinks.length > 0) {
    return Math.max(...pageLinks.map(m => parseInt(m[1], 10)));
  }

  // Look for "Items X-Y of Z" pattern
  const totalMatch = html.match(/of\s+(\d+)\s+items?/i) ||
                     html.match(/toolbar-number[^>]*>\s*(\d+)\s*<\/span>\s*Items/i);
  if (totalMatch) {
    const total = parseInt(totalMatch[1], 10);
    return Math.ceil(total / 24); // 24 items per page default
  }

  // Check for "X Items" in toolbar
  const countMatch = html.match(/<span[^>]*class="[^"]*toolbar-number[^"]*"[^>]*>(\d+)<\/span>/);
  if (countMatch) {
    const total = parseInt(countMatch[1], 10);
    return Math.ceil(total / 24);
  }

  return 1;
}

/**
 * Crawl a single category through all its pages.
 */
async function crawlCategory(category, byId) {
  const categoryUrl = `${BASE}${category.path}`;
  console.log(`\n  Category: ${category.path}`);

  // Fetch first page to detect pagination
  let res;
  try {
    res = await fetchWithRetry(categoryUrl);
  } catch (err) {
    console.log(`    FAIL: ${err.code || err.message}`);
    return 0;
  }
  if (!res.ok) {
    console.log(`    FAIL: HTTP ${res.status}`);
    return 0;
  }

  const firstPageHtml = await res.text();
  const totalPages = detectTotalPages(firstPageHtml);
  console.log(`    Pages: ${totalPages}`);

  let newCount = 0;

  // Process first page
  const firstPageProducts = parseListingPage(firstPageHtml);
  for (const p of firstPageProducts) {
    if (!byId.has(p.sku)) {
      byId.set(p.sku, { ...p, categoryTags: [...category.tags] });
      newCount++;
    } else {
      // Merge tags from additional categories
      const existing = byId.get(p.sku);
      for (const tag of category.tags) {
        if (!existing.categoryTags.includes(tag)) existing.categoryTags.push(tag);
      }
    }
  }
  console.log(`    Page 1: ${firstPageProducts.length} products (${newCount} new)`);

  // Process remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const pageUrl = `${categoryUrl}?p=${page}`;

    let pageRes;
    try {
      pageRes = await fetchWithRetry(pageUrl);
    } catch (err) {
      console.log(`    Page ${page}: FAIL (${err.code || err.message})`);
      continue;
    }
    if (!pageRes.ok) {
      console.log(`    Page ${page}: HTTP ${pageRes.status}`);
      continue;
    }

    const pageHtml = await pageRes.text();
    const pageProducts = parseListingPage(pageHtml);
    let pageNew = 0;

    for (const p of pageProducts) {
      if (!byId.has(p.sku)) {
        byId.set(p.sku, { ...p, categoryTags: [...category.tags] });
        pageNew++;
        newCount++;
      } else {
        const existing = byId.get(p.sku);
        for (const tag of category.tags) {
          if (!existing.categoryTags.includes(tag)) existing.categoryTags.push(tag);
        }
      }
    }

    console.log(`    Page ${page}: ${pageProducts.length} products (${pageNew} new, ${byId.size} total)`);
  }

  return newCount;
}

/**
 * Save checkpoint to disk.
 */
function saveCheckpoint(byId, categoriesDone) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    products: [...byId.values()],
    categoriesDone,
    timestamp: new Date().toISOString(),
  }));
  console.log(`  [checkpoint saved: ${byId.size} products]`);
}

/**
 * Load checkpoint from disk if available.
 */
function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const storeEntry = marketplace.find(e => e.id === 59);
  if (!storeEntry) {
    console.error('Frontier Co-op (id: 59) not found in marketplace.json');
    process.exit(1);
  }

  const byId = new Map();
  let startCategoryIndex = 0;

  if (MERGE_ONLY) {
    const cp = loadCheckpoint();
    if (!cp) {
      console.error('No checkpoint file found at', CHECKPOINT_FILE);
      process.exit(1);
    }
    for (const p of cp.products) byId.set(p.sku, p);
    console.log(`Loaded checkpoint: ${byId.size} products`);
  } else {
    // Check for partial checkpoint to resume from
    const cp = loadCheckpoint();
    if (cp && cp.categoriesDone && cp.categoriesDone.length > 0) {
      console.log(`Found checkpoint with ${cp.products.length} products from categories: ${cp.categoriesDone.join(', ')}`);
      for (const p of cp.products) byId.set(p.sku, p);
      // Find the next category to scrape
      startCategoryIndex = CATEGORIES.findIndex(c =>
        !cp.categoriesDone.includes(c.path)
      );
      if (startCategoryIndex === -1) startCategoryIndex = CATEGORIES.length;
      console.log(`Resuming from category index ${startCategoryIndex}`);
    }

    console.log(`Scraping Frontier Co-op across ${CATEGORIES.length} categories...`);

    const categoriesDone = cp?.categoriesDone ? [...cp.categoriesDone] : [];

    for (let i = startCategoryIndex; i < CATEGORIES.length; i++) {
      const category = CATEGORIES[i];
      const newCount = await crawlCategory(category, byId);
      categoriesDone.push(category.path);
      console.log(`  Category total new: ${newCount}`);

      // Save checkpoint after each category
      saveCheckpoint(byId, categoriesDone);

      // Extra delay between categories
      if (i < CATEGORIES.length - 1) await sleep(1500);
    }
  }

  console.log(`\nTotal: ${byId.size} unique products`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    // Show a sample
    const sample = [...byId.values()].slice(0, 3);
    for (const p of sample) {
      console.log(`  ${p.title} | ${p.price} | ${p.sku}`);
    }
    return;
  }

  // Format for products.json
  const frontierProducts = [...byId.values()].map(p => ({
    id: `${storeEntry.id}-frontier-${p.sku}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url && p.url.startsWith('http') ? p.url : (p.url ? BASE + p.url : BASE),
    store_name: storeEntry.name,
    store_url: storeEntry.url,
    ownership_type: storeEntry.ownership_type,
    site_section: 'Food & Pantry',
    tags: p.categoryTags || [],
  }));

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonFrontier = existing.filter(p => p.store_name !== 'Frontier Co-op');
  const final = [...nonFrontier, ...frontierProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${frontierProducts.length} Frontier Co-op from this scrape)`);
  console.log(`  (${nonFrontier.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

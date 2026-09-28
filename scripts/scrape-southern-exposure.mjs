#!/usr/bin/env node
/**
 * scrape-southern-exposure.mjs
 * Scraper for Southern Exposure Seed Exchange (southernexposure.com).
 *
 * Worker co-op selling heirloom & open-pollinated seeds. Custom platform.
 * Uses sitemap.xml to discover ~700+ product URLs, then fetches each page
 * to extract product details from structured data / HTML.
 *
 * Usage:
 *   node scripts/scrape-southern-exposure.mjs              # scrape and merge
 *   node scripts/scrape-southern-exposure.mjs --dry-run    # show counts only
 *   node scripts/scrape-southern-exposure.mjs --merge-only # merge checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://southernexposure.com';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 2000; // robots.txt requests 2-second crawl delay
const CHECKPOINT_FILE = '/tmp/sese-scrape-checkpoint.json';
const STORE_NAME = 'Southern Exposure Seed Exchange';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (res.status === 429) {
        console.log(`  Rate limited, waiting ${10 * (i + 1)}s...`);
        await sleep(10000 * (i + 1));
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

/** Decode common HTML entities */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Fetch and parse sitemap.xml to get all product URLs.
 * Product URLs match /products/...
 */
async function fetchProductUrls() {
  console.log('Fetching sitemap...');
  const res = await fetchWithRetry(`${BASE}/sitemap.xml`);
  if (!res.ok) {
    throw new Error(`Sitemap fetch failed: ${res.status}`);
  }
  const xml = await res.text();

  // Check for sitemap index (multiple sitemaps)
  const sitemapUrls = [];
  const sitemapIndexMatches = xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g);
  for (const m of sitemapIndexMatches) {
    sitemapUrls.push(m[1].trim());
  }

  let allUrls = [];

  if (sitemapUrls.length > 0) {
    // Sitemap index — fetch each child sitemap
    console.log(`  Found sitemap index with ${sitemapUrls.length} sitemaps`);
    for (const sitemapUrl of sitemapUrls) {
      console.log(`  Fetching ${sitemapUrl}...`);
      await sleep(DELAY_MS);
      const subRes = await fetchWithRetry(sitemapUrl);
      if (!subRes.ok) {
        console.log(`  WARN: ${sitemapUrl} returned ${subRes.status}, skipping`);
        continue;
      }
      const subXml = await subRes.text();
      const urlMatches = subXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g);
      for (const m of urlMatches) {
        allUrls.push(m[1].trim());
      }
    }
  } else {
    // Single sitemap — handle XML with newlines inside tags like <loc\n>
    const urlMatches = xml.matchAll(/<loc\s*>(https?:\/\/[^<]+)<\/loc/g);
    for (const m of urlMatches) {
      allUrls.push(m[1].trim());
    }
  }

  // Filter to product URLs only
  const productUrls = allUrls.filter(u => /\/products\/[^/]+/.test(u));
  console.log(`  Found ${allUrls.length} total URLs, ${productUrls.length} product URLs`);
  return productUrls;
}

/**
 * Extract slug from a product URL.
 * e.g. https://www.southernexposure.com/products/cherokee-purple-tomato/ → cherokee-purple-tomato
 */
function slugFromUrl(url) {
  const m = url.match(/\/products\/([^/?#]+)/);
  return m ? m[1].replace(/\/$/, '') : null;
}

/**
 * Parse a single product page and extract product data.
 * Tries JSON-LD first, falls back to Open Graph meta tags and HTML patterns.
 */
function parseProductPage(html, url) {
  const product = { url };
  const slug = slugFromUrl(url);
  if (slug) product.slug = slug;

  // --- Try JSON-LD ---
  const jsonLdBlocks = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      // Could be an array or single object
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
          product.title = product.title || item.name;
          product.image = product.image || item.image?.url || item.image?.[0]?.url || item.image?.[0] || (typeof item.image === 'string' ? item.image : null);
          product.description = product.description || item.description;

          // Price from offers
          const offers = item.offers;
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers;
            product.price = product.price || offer.price || offer.lowPrice;
            if (product.price != null) product.price = String(product.price);
            product.available = product.available ?? (offer.availability !== 'https://schema.org/OutOfStock' && offer.availability !== 'OutOfStock');
            product.currency = product.currency || offer.priceCurrency || 'USD';
          }

          // Category
          if (item.category) {
            product.category = typeof item.category === 'string' ? item.category : item.category.name;
          }
          break;
        }
      }
    } catch {
      // invalid JSON-LD, skip
    }
  }

  // --- Open Graph fallbacks ---
  if (!product.title) {
    const ogTitle = html.match(/<meta\s+(?:property|name)\s*=\s*["']og:title["']\s+content\s*=\s*["']([^"']+)["']/i);
    if (ogTitle) product.title = decodeEntities(ogTitle[1]);
  }
  if (!product.image) {
    const ogImage = html.match(/<meta\s+(?:property|name)\s*=\s*["']og:image["']\s+content\s*=\s*["']([^"']+)["']/i);
    if (ogImage) product.image = ogImage[1];
  }
  if (!product.description) {
    const ogDesc = html.match(/<meta\s+(?:property|name)\s*=\s*["']og:description["']\s+content\s*=\s*["']([^"']+)["']/i);
    if (ogDesc) product.description = decodeEntities(ogDesc[1]);
  }

  // --- HTML <title> fallback ---
  if (!product.title) {
    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
    if (titleTag) {
      let t = decodeEntities(titleTag[1]);
      // Strip trailing " - Southern Exposure..." or " | ..."
      t = t.replace(/\s*[-|].*$/, '');
      product.title = t;
    }
  }

  // --- Price from HTML if not found in JSON-LD ---
  if (!product.price) {
    // Common patterns: <span class="price">$3.50</span>, itemprop="price"
    const pricePatterns = [
      /itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /itemprop\s*=\s*["']price["'][^>]*>\s*\$?([\d,.]+)/i,
      /class\s*=\s*["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,.]+)/i,
      /data-product-price\s*=\s*["']([^"']+)["']/i,
    ];
    for (const pat of pricePatterns) {
      const m = html.match(pat);
      if (m) {
        product.price = m[1].replace(/,/g, '');
        break;
      }
    }
  }

  // --- Image from HTML fallback ---
  if (!product.image) {
    // Look for product image in typical containers
    const imgPatterns = [
      /class\s*=\s*["'][^"']*product[^"']*image[^"']*["'][^>]*src\s*=\s*["']([^"']+)["']/i,
      /id\s*=\s*["']product-image["'][^>]*src\s*=\s*["']([^"']+)["']/i,
      /data-product-image\s*=\s*["']([^"']+)["']/i,
    ];
    for (const pat of imgPatterns) {
      const m = html.match(pat);
      if (m) {
        product.image = m[1];
        break;
      }
    }
  }

  // --- Category/breadcrumb from HTML ---
  if (!product.category) {
    // Try breadcrumb
    const breadcrumbMatches = html.matchAll(/<a[^>]+href\s*=\s*["']\/(?:categories|collections)\/([^"'/]+)["'][^>]*>([^<]+)<\/a>/gi);
    const categories = [];
    for (const m of breadcrumbMatches) {
      categories.push(decodeEntities(m[2]));
    }
    if (categories.length > 0) {
      product.category = categories[categories.length - 1]; // deepest category
    }
  }

  // --- Tags ---
  product.tags = buildTags(product);

  // Format price
  if (product.price) {
    const num = parseFloat(product.price);
    if (!isNaN(num)) {
      product.price = `$${num.toFixed(2)}`;
    }
  }

  // Ensure image is absolute
  if (product.image && product.image.startsWith('/')) {
    product.image = BASE + product.image;
  } else if (product.image && product.image.startsWith('//')) {
    product.image = 'https:' + product.image;
  }

  // Default availability
  if (product.available == null) product.available = true;

  return product;
}

/**
 * Build tags array from product data.
 * Seeds are the primary product; tags reflect seed type/category.
 */
function buildTags(product) {
  const tags = ['seeds'];
  const title = (product.title || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const combined = `${title} ${category} ${desc}`;

  // Heirloom flag
  if (combined.includes('heirloom') || combined.includes('heritage')) {
    tags.push('heirloom');
  }

  // Open-pollinated
  if (combined.includes('open-pollinated') || combined.includes('open pollinated') || combined.includes('op ')) {
    tags.push('open-pollinated');
  }

  // Organic
  if (combined.includes('organic')) {
    tags.push('organic');
  }

  // Crop type categories
  const cropTypes = [
    { keywords: ['tomato', 'tomatoes'], tag: 'tomatoes' },
    { keywords: ['pepper', 'peppers'], tag: 'peppers' },
    { keywords: ['bean', 'beans'], tag: 'beans' },
    { keywords: ['squash', 'pumpkin', 'gourd'], tag: 'squash' },
    { keywords: ['corn', 'maize'], tag: 'corn' },
    { keywords: ['lettuce', 'greens', 'kale', 'spinach', 'chard', 'arugula', 'mesclun'], tag: 'greens' },
    { keywords: ['herb', 'herbs', 'basil', 'cilantro', 'dill', 'parsley', 'thyme', 'oregano', 'rosemary', 'sage', 'mint'], tag: 'herbs' },
    { keywords: ['flower', 'flowers', 'sunflower', 'zinnia', 'marigold', 'cosmos', 'nasturtium'], tag: 'flowers' },
    { keywords: ['cucumber', 'cucumbers'], tag: 'cucumbers' },
    { keywords: ['melon', 'watermelon', 'cantaloupe'], tag: 'melons' },
    { keywords: ['pea', 'peas'], tag: 'peas' },
    { keywords: ['carrot', 'carrots'], tag: 'carrots' },
    { keywords: ['onion', 'garlic', 'leek', 'shallot'], tag: 'alliums' },
    { keywords: ['radish', 'turnip', 'beet', 'beets'], tag: 'root vegetables' },
    { keywords: ['cover crop', 'grain', 'clover', 'rye', 'oat', 'buckwheat'], tag: 'cover crops' },
  ];

  for (const { keywords, tag } of cropTypes) {
    if (keywords.some(k => combined.includes(k))) {
      tags.push(tag);
      break; // one crop type per product
    }
  }

  return tags;
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const storeEntry = marketplace.find(e => e.id === 116);
  if (!storeEntry) {
    console.error('Southern Exposure Seed Exchange (id 116) not found in marketplace.json');
    process.exit(1);
  }

  const scraped = new Map(); // slug → product data

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error(`No checkpoint file at ${CHECKPOINT_FILE}`);
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) {
      scraped.set(p.slug, p);
    }
    console.log(`Loaded checkpoint: ${scraped.size} products`);
  } else {
    // Load existing checkpoint to resume
    const alreadyDone = new Set();
    if (existsSync(CHECKPOINT_FILE)) {
      const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
      for (const p of cp.products) {
        scraped.set(p.slug, p);
        alreadyDone.add(p.slug);
      }
      console.log(`Resuming from checkpoint: ${alreadyDone.size} products already scraped`);
    }

    // Fetch product URLs from sitemap
    const productUrls = await fetchProductUrls();
    if (productUrls.length === 0) {
      console.error('No product URLs found in sitemap');
      process.exit(1);
    }

    // Filter out already-scraped
    const toScrape = productUrls.filter(u => {
      const slug = slugFromUrl(u);
      return slug && !alreadyDone.has(slug);
    });

    console.log(`\n${toScrape.length} product pages to scrape (${alreadyDone.size} already done)\n`);

    let errors = 0;
    for (let i = 0; i < toScrape.length; i++) {
      const url = toScrape[i];
      const slug = slugFromUrl(url);
      process.stdout.write(`  [${i + 1}/${toScrape.length}] ${slug}... `);

      try {
        const res = await fetchWithRetry(url);
        if (!res.ok) {
          console.log(`HTTP ${res.status}`);
          errors++;
          if (errors > 50) {
            console.log('\nToo many errors, stopping.');
            break;
          }
          await sleep(DELAY_MS);
          continue;
        }

        const html = await res.text();
        const product = parseProductPage(html, url);

        if (!product.title) {
          console.log('no title found, skipping');
        } else {
          scraped.set(slug, product);
          console.log(`${product.title.substring(0, 50)} — ${product.price || 'no price'}`);
        }
      } catch (err) {
        console.log(`ERROR: ${err.code || err.message}`);
        errors++;
        if (errors > 50) {
          console.log('\nToo many errors, stopping.');
          break;
        }
      }

      // Save checkpoint every 25 products
      if ((i + 1) % 25 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          products: [...scraped.values()],
          timestamp: new Date().toISOString(),
        }));
        console.log(`  [checkpoint saved: ${scraped.size} products]`);
      }

      await sleep(DELAY_MS);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      products: [...scraped.values()],
      timestamp: new Date().toISOString(),
    }));
    console.log(`\nCheckpoint saved to ${CHECKPOINT_FILE}`);
  }

  console.log(`\nTotal: ${scraped.size} products scraped`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    // Show sample
    const sample = [...scraped.values()].slice(0, 5);
    for (const p of sample) {
      console.log(`  ${p.title} — ${p.price} — tags: ${p.tags?.join(', ')}`);
    }
    return;
  }

  // Format for products.json
  const seseProducts = [...scraped.values()]
    .filter(p => p.title && p.slug)
    .map(p => ({
      id: `${storeEntry.id}-sese-${p.slug}`,
      title: p.title,
      price: p.price || null,
      available: p.available !== false,
      image: p.image || null,
      url: p.url,
      store_name: STORE_NAME,
      store_url: BASE,
      ownership_type: 'worker co-op',
      site_section: 'Home & Garden',
      tags: p.tags || ['seeds'],
    }));

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonSese = existing.filter(p => p.store_name !== STORE_NAME);
  const final = [...nonSese, ...seseProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${seseProducts.length} ${STORE_NAME} from this scrape)`);
  console.log(`  (${nonSese.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-thorogood.mjs
 * Scraper for Thorogood USA (thorogoodusa.com) — a WooCommerce store.
 * Employee-owned (ESOP) work boot manufacturer.
 *
 * Strategy: fetch the WooCommerce product sitemap to get all product URLs,
 * then scrape each product page for details (JSON-LD, WooCommerce classes,
 * meta tags).
 *
 * Usage:
 *   node scripts/scrape-thorogood.mjs              # scrape and merge into products.json
 *   node scripts/scrape-thorogood.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-thorogood.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://thorogoodusa.com';
const SITEMAP_URL = `${BASE}/product-sitemap.xml`;
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/thorogood-scrape-checkpoint.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...options.headers,
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
 * Parse product URLs from the WooCommerce product sitemap XML.
 */
function parseSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>\s*(https:\/\/thorogoodusa\.com\/[^<]+)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

/**
 * Derive a slug-based product ID from a Thorogood product URL.
 * e.g. https://thorogoodusa.com/product/1957-series-6-moc-toe/ -> "1957-series-6-moc-toe"
 */
function slugFromUrl(url) {
  const m = url.match(/\/product\/([^/?#]+)/);
  return m ? m[1].replace(/\/$/, '') : url.replace(/[^a-z0-9]/gi, '-');
}

/**
 * Extract product data from a single product page HTML.
 */
function parseProductPage(html, url) {
  // --- Try JSON-LD first ---
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let jsonLd = null;
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const parsed = JSON.parse(content);
        // Could be an array or a single object
        const obj = Array.isArray(parsed) ? parsed.find(o => o['@type'] === 'Product') : parsed;
        if (obj && obj['@type'] === 'Product') {
          jsonLd = obj;
          break;
        }
        // Check @graph
        if (obj && obj['@graph']) {
          const product = obj['@graph'].find(g => g['@type'] === 'Product');
          if (product) {
            jsonLd = product;
            break;
          }
        }
      } catch {
        // malformed JSON-LD, skip
      }
    }
  }

  let title = null;
  let price = null;
  let image = null;
  let category = null;
  let sku = null;

  if (jsonLd) {
    title = jsonLd.name || null;
    image = jsonLd.image || null;
    if (Array.isArray(image)) image = image[0];
    sku = jsonLd.sku || null;

    // Price from offers
    if (jsonLd.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers : [jsonLd.offers];
      for (const offer of offers) {
        if (offer.price) {
          price = offer.price;
          break;
        }
        if (offer.lowPrice) {
          price = offer.highPrice && offer.lowPrice !== offer.highPrice
            ? `${offer.lowPrice} - ${offer.highPrice}`
            : offer.lowPrice;
          break;
        }
      }
    }

    // Category from JSON-LD
    if (jsonLd.category) {
      category = typeof jsonLd.category === 'string' ? jsonLd.category : null;
    }
  }

  // --- Fallback: HTML meta / WooCommerce classes ---
  if (!title) {
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitle) title = decodeHtmlEntities(ogTitle[1]);
  }
  if (!title) {
    const h1 = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/h1>/i);
    if (h1) title = decodeHtmlEntities(h1[1]);
  }

  if (!price) {
    // WooCommerce price element
    const priceMatch = html.match(/<p class="price">[\s\S]*?<(?:span|ins)[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<bdi>([^<]+)<\/bdi>/i);
    if (priceMatch) {
      price = priceMatch[1].replace(/[^\d.,]/g, '');
    }
  }
  if (!price) {
    // Try meta tag
    const metaPrice = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
    if (metaPrice) price = metaPrice[1];
  }

  if (!image) {
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage) image = ogImage[1];
  }
  if (!image) {
    const wooImg = html.match(/<div[^>]*class="[^"]*woocommerce-product-gallery[^"]*"[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
    if (wooImg) image = wooImg[1];
  }

  // Category from WooCommerce breadcrumb or product_cat
  if (!category) {
    const catMatch = html.match(/class="posted_in"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    if (catMatch) category = decodeHtmlEntities(catMatch[1]);
  }

  // Build tags from category and product attributes
  const tags = ['footwear', 'work boots'];
  if (category) {
    const catLower = category.toLowerCase();
    if (!tags.includes(catLower) && catLower !== 'uncategorized') {
      tags.push(catLower);
    }
  }

  // Look for additional WooCommerce product tags
  const tagLinks = html.matchAll(/class="tagged_as"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
  for (const tm of tagLinks) {
    const tag = decodeHtmlEntities(tm[1]).toLowerCase().trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  // Check for safety toe, EH, waterproof, etc. from title/description
  const titleLower = (title || '').toLowerCase();
  if (titleLower.includes('safety') || titleLower.includes('steel toe') || titleLower.includes('composite')) {
    if (!tags.includes('safety toe')) tags.push('safety toe');
  }
  if (titleLower.includes('waterproof')) {
    if (!tags.includes('waterproof')) tags.push('waterproof');
  }
  if (titleLower.includes('fire') || titleLower.includes('wildland')) {
    if (!tags.includes('fire boots')) tags.push('fire boots');
  }
  if (titleLower.includes('logger')) {
    if (!tags.includes('logger boots')) tags.push('logger boots');
  }

  // Format price
  if (price && !String(price).startsWith('$')) {
    price = `$${price}`;
  }

  return { title, price, image, url, tags, sku };
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, '&')
    .trim();
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const storeEntry = marketplace.find(e => e.id === 100);
  if (!storeEntry) {
    console.error('Thorogood USA (id: 100) not found in marketplace.json');
    process.exit(1);
  }

  const products = [];

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error(`No checkpoint file found at ${CHECKPOINT_FILE}`);
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    products.push(...cp.products);
    console.log(`Loaded checkpoint: ${products.length} products`);
  } else {
    // Step 1: Fetch the product sitemap
    console.log('Fetching product sitemap...');
    const sitemapRes = await fetchWithRetry(SITEMAP_URL);
    if (!sitemapRes.ok) {
      console.error(`Failed to fetch sitemap: ${sitemapRes.status}`);
      process.exit(1);
    }
    const sitemapXml = await sitemapRes.text();
    const productUrls = parseSitemap(sitemapXml);
    console.log(`Found ${productUrls.length} product URLs in sitemap\n`);

    if (productUrls.length === 0) {
      console.error('No product URLs found — sitemap format may have changed');
      process.exit(1);
    }

    // Load existing checkpoint to resume
    const seen = new Set();
    if (existsSync(CHECKPOINT_FILE)) {
      try {
        const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
        for (const p of cp.products) {
          products.push(p);
          seen.add(p.url);
        }
        console.log(`Resuming from checkpoint: ${products.length} already scraped`);
      } catch {
        console.log('Could not parse checkpoint, starting fresh');
      }
    }

    // Step 2: Scrape each product page
    const remaining = productUrls.filter(u => !seen.has(u));
    console.log(`Scraping ${remaining.length} product pages...\n`);

    for (let i = 0; i < remaining.length; i++) {
      const url = remaining[i];
      const slug = slugFromUrl(url);
      process.stdout.write(`  [${i + 1}/${remaining.length}] ${slug}... `);

      try {
        const res = await fetchWithRetry(url);
        if (!res.ok) {
          console.log(`SKIP (HTTP ${res.status})`);
          continue;
        }
        const html = await res.text();
        const product = parseProductPage(html, url);

        if (!product.title) {
          console.log('SKIP (no title found)');
          continue;
        }

        products.push(product);
        console.log(`OK — ${product.title} — ${product.price || 'no price'}`);
      } catch (err) {
        console.log(`FAIL (${err.code || err.message})`);
      }

      // Save checkpoint every 25 products
      if ((i + 1) % 25 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products }, null, 2));
        console.log(`  [checkpoint saved: ${products.length} products]\n`);
      }

      if (i < remaining.length - 1) await sleep(DELAY_MS);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products }, null, 2));
    console.log(`\nCheckpoint saved: ${products.length} products`);
  }

  console.log(`\nTotal: ${products.length} products scraped`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    // Show a sample
    if (products.length > 0) {
      console.log('\nSample product:');
      console.log(JSON.stringify(products[0], null, 2));
    }
    return;
  }

  // Format for products.json
  const thorogoodProducts = products.map(p => {
    const slug = slugFromUrl(p.url);
    return {
      id: `${storeEntry.id}-thorogood-${p.sku || slug}`,
      title: p.title,
      price: p.price,
      available: true,
      image: p.image,
      url: p.url,
      store_name: 'Thorogood USA',
      store_url: 'https://thorogoodusa.com',
      ownership_type: 'employee-owned',
      site_section: 'Apparel',
      tags: p.tags,
    };
  });

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonThorogood = existing.filter(p => p.store_name !== 'Thorogood USA');
  const final = [...nonThorogood, ...thorogoodProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${thorogoodProducts.length} Thorogood USA from this scrape)`);
  console.log(`  (${nonThorogood.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

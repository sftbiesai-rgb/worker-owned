#!/usr/bin/env node
/**
 * scrape-arbor-assays.mjs
 * Scraper for Arbor Assays (arborassays.com) — a WooCommerce store.
 * Purpose trust-owned life science company (assay kits & reagents).
 *
 * Strategy: fetch the WooCommerce product sitemap to get all product URLs,
 * then scrape each product page for details (JSON-LD, WooCommerce classes,
 * meta tags).
 *
 * Usage:
 *   node scripts/scrape-arbor-assays.mjs              # scrape and save to store JSON
 *   node scripts/scrape-arbor-assays.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-arbor-assays.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'arbor-assays.json');
const BASE = 'https://www.arborassays.com';
const SITEMAP_URL = `${BASE}/product-sitemap.xml`;
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 600;
const CHECKPOINT_FILE = '/tmp/arbor-assays-scrape-checkpoint.json';

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

function parseSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>\s*(https:\/\/www\.arborassays\.com\/[^<]+)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

function slugFromUrl(url) {
  const m = url.match(/\/product\/([^/?#]+)/);
  return m ? m[1].replace(/\/$/, '') : url.replace(/[^a-z0-9]/gi, '-');
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
    .replace(/&#8482;/g, '™')
    .replace(/&#946;/g, 'β')
    .replace(/&#945;/g, 'α')
    .replace(/&#8322;/g, '₂')
    .replace(/&#8321;/g, '₁')
    .trim();
}

function parseProductPage(html, url) {
  // --- Try JSON-LD first ---
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let jsonLd = null;
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const parsed = JSON.parse(content);
        const obj = Array.isArray(parsed) ? parsed.find(o => o['@type'] === 'Product') : parsed;
        if (obj && obj['@type'] === 'Product') {
          jsonLd = obj;
          break;
        }
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
  let available = true;

  if (jsonLd) {
    title = jsonLd.name || null;
    image = jsonLd.image || null;
    if (Array.isArray(image)) image = image[0];
    sku = jsonLd.sku || null;

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
      // Check availability from offers
      for (const offer of offers) {
        if (offer.availability) {
          const avail = offer.availability.toLowerCase();
          if (avail.includes('outofstock') || avail.includes('discontinued')) {
            available = false;
          }
        }
      }
    }

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
    const priceMatch = html.match(/<p class="price">[\s\S]*?<(?:span|ins)[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<bdi>([^<]+)<\/bdi>/i);
    if (priceMatch) {
      price = priceMatch[1].replace(/[^\d.,]/g, '');
    }
  }
  if (!price) {
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

  // Build tags from product type / category
  const tags = [];
  if (category) {
    const catLower = category.toLowerCase().trim();
    if (catLower && catLower !== 'uncategorized') {
      tags.push(catLower);
    }
  }

  // Extract all WooCommerce product categories from the page
  const catLinks = html.matchAll(/class="posted_in"[\s\S]*?(<a[^>]*>[^<]+<\/a>[\s\S]*?)<\/span>/gi);
  for (const cm of catLinks) {
    const innerLinks = cm[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi);
    for (const il of innerLinks) {
      const tag = decodeHtmlEntities(il[1]).toLowerCase().trim();
      if (tag && !tags.includes(tag) && tag !== 'uncategorized') {
        tags.push(tag);
      }
    }
  }

  // Add contextual tags based on title
  const titleLower = (title || '').toLowerCase();
  if (titleLower.includes('elisa') || titleLower.includes('eia')) {
    if (!tags.includes('elisa kit') && !tags.includes('eia kit')) {
      tags.push('immunoassay');
    }
  }
  if (titleLower.includes('detection kit') || titleLower.includes('activity kit')) {
    if (!tags.includes('detection kit')) tags.push('detection kit');
  }
  if (titleLower.includes('iswe')) {
    if (!tags.includes('iswe')) tags.push('iswe');
  }
  if (titleLower.includes('antibod') || titleLower.includes('monoclonal') || titleLower.includes('igg')) {
    if (!tags.includes('antibodies')) tags.push('antibodies');
  }

  // Always add life-science tag
  if (!tags.includes('life science')) tags.push('life science');
  if (!tags.includes('assay kits') && (titleLower.includes('kit') || titleLower.includes('assay'))) {
    tags.push('assay kits');
  }

  // Format price
  if (price && !String(price).startsWith('$')) {
    price = `$${price}`;
  }

  // Check for out-of-stock in body class or stock HTML
  if (html.includes('out-of-stock') || html.includes('class="stock out-of-stock"')) {
    available = false;
  }

  return { title, price, image, url, tags, sku, available };
}

async function main() {
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

  // Filter out non-product pages (e.g. the /shop/ archive page)
  const filtered = products.filter(p => {
    if (!p.url.includes('/product/')) return false;
    return true;
  });
  // Clean HTML entities from titles
  for (const p of filtered) {
    if (p.title) {
      p.title = p.title
        .replace(/<sub>(\d+)<\/sub>/gi, '$1')
        .replace(/<sup>(\d+)<\/sup>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/\s*–\s*Arbor Assays\s*$/i, '')
        .trim();
    }
  }

  // Step 3: Fill in missing prices from WooCommerce Store API
  console.log('\nFetching prices from WooCommerce Store API...');
  const priceMap = new Map(); // url -> price string
  for (let page = 1; page <= 10; page++) {
    const apiUrl = `${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    try {
      const res = await fetchWithRetry(apiUrl);
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      for (const item of data) {
        if (item.permalink) {
          // Extract price from the prices object or price_html
          let apiPrice = null;
          if (item.prices) {
            const p = item.prices;
            const lo = p.price ? (parseInt(p.price) / 100).toFixed(2) : null;
            const hi = p.regular_price ? (parseInt(p.regular_price) / 100).toFixed(2) : null;
            if (lo) apiPrice = `$${lo}`;
          }
          if (!apiPrice && item.price_html) {
            // Parse price from HTML like <span class="woocommerce-Price-amount">$X</span>
            const m = item.price_html.match(/\$([\d,.]+)/);
            if (m) apiPrice = `$${m[1]}`;
          }
          if (!apiPrice && typeof item.price === 'string') {
            apiPrice = item.price.startsWith('$') ? item.price : `$${item.price}`;
          }
          if (apiPrice) {
            priceMap.set(item.permalink.replace(/\/$/, ''), apiPrice);
          }
        }
      }
      console.log(`  Page ${page}: ${data.length} products`);
    } catch (err) {
      console.log(`  Page ${page}: error (${err.message})`);
      break;
    }
  }
  console.log(`  Got prices for ${priceMap.size} products from Store API`);

  // Merge API prices into products missing prices
  let pricesFilled = 0;
  for (const p of filtered) {
    if (!p.price) {
      const normalUrl = p.url.replace(/\/$/, '');
      if (priceMap.has(normalUrl)) {
        p.price = priceMap.get(normalUrl);
        pricesFilled++;
      }
    }
  }
  console.log(`  Filled ${pricesFilled} missing prices from Store API`);

  console.log(`\nTotal: ${filtered.length} products after filtering`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to store JSON');
    if (products.length > 0) {
      console.log('\nSample product:');
      console.log(JSON.stringify(products[0], null, 2));
    }
    return;
  }

  // Format for store JSON file
  const storeProducts = filtered.map(p => {
    const slug = slugFromUrl(p.url);
    return {
      id: `arbor-assays-${p.sku || slug}`,
      title: p.title,
      price: p.price,
      available: p.available,
      image: p.image,
      url: p.url,
      store_name: 'Arbor Assays',
      store_url: 'https://www.arborassays.com',
      ownership_type: 'purpose-trust',
      site_section: 'Life Science',
      tags: p.tags,
    };
  });

  // Build sectioned output matching store JSON format
  const sectionMap = new Map();
  for (const p of storeProducts) {
    // Group by first tag or 'other'
    const sectionLabel = p.tags[0] || 'other';
    if (!sectionMap.has(sectionLabel)) {
      sectionMap.set(sectionLabel, []);
    }
    sectionMap.get(sectionLabel).push(p);
  }

  const sections = [];
  let totalCount = 0;
  for (const [label, prods] of sectionMap) {
    sections.push({
      label,
      count: prods.length,
      products: prods,
    });
    totalCount += prods.length;
  }

  const output = {
    total: totalCount,
    sections,
    sectionIndex: sections.map(s => ({
      slug: s.label.toLowerCase().replace(/\s+/g, '-'),
      label: s.label,
      count: s.count,
      totalPages: Math.ceil(s.count / 12),
    })),
  };

  writeFileSync(STORE_FILE, JSON.stringify(output));
  console.log(`\nWrote ${totalCount} products to ${STORE_FILE}`);
  console.log(`Sections: ${sections.map(s => `${s.label} (${s.count})`).join(', ')}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

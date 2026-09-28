#!/usr/bin/env node
/**
 * scrape-pmpress.mjs
 * Scraper for PM Press (pmpress.org) — a SunShop-based store selling
 * political/labor books. Worker co-op.
 *
 * SunShop uses index.php?l=product_list with category and pagination params.
 * This scraper discovers categories, then paginates through each one to
 * collect all products.
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
const BASE = 'https://www.pmpress.org';
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
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.message})`);
      await sleep(2000 * (i + 1));
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .trim();
}

/**
 * Discover categories from the site navigation or category listing page.
 * SunShop stores typically list categories with links like:
 *   index.php?l=product_list&c=<id>
 *
 * Returns array of { id, name, url }.
 */
async function discoverCategories() {
  console.log('Discovering categories...');

  // Try fetching the main page to extract nav links
  const res = await fetchWithRetry(`${BASE}/`);
  const html = await res.text();

  const categories = [];
  const seen = new Set();

  // Pattern 1: SunShop category links — index.php?l=product_list&c=<id>
  const catPattern = /index\.php\?l=product_list&amp;c=(\d+)|index\.php\?l=product_list&c=(\d+)/g;
  let match;
  while ((match = catPattern.exec(html)) !== null) {
    const catId = match[1] || match[2];
    if (!seen.has(catId)) {
      seen.add(catId);
      categories.push({
        id: catId,
        url: `${BASE}/index.php?l=product_list&c=${catId}`,
      });
    }
  }

  // Pattern 2: Some SunShop stores use SEO-friendly URLs like /category/slug/
  // or /shop/category-name/. Extract those too.
  const seoPattern = /href="((?:https?:\/\/(?:www\.)?pmpress\.org)?\/(?:shop|category|products?)\/?[^"]*?)"/gi;
  while ((match = seoPattern.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `${BASE}${match[1]}`;
    if (!seen.has(url)) {
      seen.add(url);
      categories.push({ id: url, url });
    }
  }

  // Pattern 3: Also look for links in a sitemap-style listing
  // Try the product_list page with no category (sometimes shows all)
  if (categories.length === 0) {
    console.log('  No categories found on homepage, trying product_list page...');
    await sleep(DELAY_MS);
    try {
      const res2 = await fetchWithRetry(`${BASE}/index.php?l=product_list`);
      const html2 = await res2.text();
      while ((match = catPattern.exec(html2)) !== null) {
        const catId = match[1] || match[2];
        if (!seen.has(catId)) {
          seen.add(catId);
          categories.push({
            id: catId,
            url: `${BASE}/index.php?l=product_list&c=${catId}`,
          });
        }
      }
    } catch (err) {
      console.log(`  Could not fetch product_list: ${err.message}`);
    }
  }

  // Also try fetching the sitemap for more URLs
  await sleep(DELAY_MS);
  try {
    const sitemapRes = await fetchWithRetry(`${BASE}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const locPattern = /<loc>([^<]*product_list[^<]*)<\/loc>/g;
    while ((match = locPattern.exec(sitemapXml)) !== null) {
      const url = match[1];
      const cMatch = url.match(/[?&]c=(\d+)/);
      if (cMatch && !seen.has(cMatch[1])) {
        seen.add(cMatch[1]);
        categories.push({
          id: cMatch[1],
          url: url,
        });
      }
    }
  } catch (err) {
    console.log(`  No sitemap available: ${err.message}`);
  }

  console.log(`  Found ${categories.length} categories`);

  // If still no categories, create a fallback: try c=0 through c=50
  if (categories.length === 0) {
    console.log('  Using fallback: probing category IDs 1-50...');
    for (let i = 1; i <= 50; i++) {
      categories.push({
        id: String(i),
        url: `${BASE}/index.php?l=product_list&c=${i}`,
      });
    }
  }

  return categories;
}

/**
 * Parse product data from a SunShop product listing page.
 * SunShop listing pages vary in structure. We try multiple patterns.
 */
function parseProductsFromHtml(html) {
  const products = [];
  const seenUrls = new Set();

  // --- Strategy 1: SunShop product detail links ---
  // SunShop product links: index.php?l=product_detail&p=<id>
  const detailPattern = /index\.php\?l=product_detail&(?:amp;)?p=(\d+)/g;
  let match;
  const productIds = new Set();
  while ((match = detailPattern.exec(html)) !== null) {
    productIds.add(match[1]);
  }

  // For each product ID found, try to extract surrounding context
  for (const pid of productIds) {
    // Find the product block around this ID
    // Look for title — typically in an <a> tag linking to the product
    const titlePattern = new RegExp(
      `<a[^>]*href="[^"]*(?:product_detail|p=)${pid}[^"]*"[^>]*>([^<]+)</a>`,
      'i'
    );
    const titleMatch = html.match(titlePattern);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : null;
    if (!title) continue;

    // Price — look near this product ID
    // Find the section of HTML around this product
    const pidIdx = html.indexOf(`p=${pid}`);
    const contextStart = Math.max(0, pidIdx - 2000);
    const contextEnd = Math.min(html.length, pidIdx + 2000);
    const context = html.substring(contextStart, contextEnd);

    const priceMatch = context.match(/\$\s*([\d,]+\.?\d*)/);
    const price = priceMatch ? `$${priceMatch[1]}` : null;

    // Image
    const imgMatch = context.match(/<img[^>]*src="([^"]*(?:product|thumbnail|image)[^"]*)"/i)
      || context.match(/<img[^>]*src="([^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*)"/i);
    let image = imgMatch ? imgMatch[1] : null;
    if (image && !image.startsWith('http')) {
      image = image.startsWith('/') ? `${BASE}${image}` : `${BASE}/${image}`;
    }

    const url = `${BASE}/index.php?l=product_detail&p=${pid}`;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      products.push({
        productId: pid,
        title,
        price,
        image,
        url,
      });
    }
  }

  // --- Strategy 2: Generic product grid parsing ---
  // Look for product cards with class names common in SunShop themes
  // e.g., class="product_listing", class="product-item", etc.
  const cardPatterns = [
    /class="[^"]*product[_-]?(?:listing|item|card|box)[^"]*"([\s\S]*?)(?=class="[^"]*product[_-]?(?:listing|item|card|box)|$)/gi,
    /class="[^"]*item[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?\$([\d,.]+)/gi,
  ];

  for (const pattern of cardPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const block = match[0];
      // Extract URL
      const urlMatch = block.match(/href="([^"]*(?:product_detail|\/p\/)[^"]*)"/i);
      if (!urlMatch) continue;
      let prodUrl = urlMatch[1];
      if (!prodUrl.startsWith('http')) {
        prodUrl = prodUrl.startsWith('/') ? `${BASE}${prodUrl}` : `${BASE}/${prodUrl}`;
      }
      prodUrl = prodUrl.replace(/&amp;/g, '&');
      if (seenUrls.has(prodUrl)) continue;

      const pidMatch = prodUrl.match(/[?&]p=(\d+)/);
      const prodId = pidMatch ? pidMatch[1] : prodUrl.replace(/[^a-z0-9]/gi, '-').slice(-20);

      // Title
      const tMatch = block.match(/<a[^>]*>([^<]{3,})<\/a>/);
      const tTitle = tMatch ? decodeEntities(tMatch[1]) : null;
      if (!tTitle) continue;

      // Price
      const pMatch = block.match(/\$\s*([\d,]+\.?\d*)/);
      const tPrice = pMatch ? `$${pMatch[1]}` : null;

      // Image
      const iMatch = block.match(/<img[^>]*src="([^"]+)"/i);
      let tImage = iMatch ? iMatch[1] : null;
      if (tImage && !tImage.startsWith('http')) {
        tImage = tImage.startsWith('/') ? `${BASE}${tImage}` : `${BASE}/${tImage}`;
      }

      seenUrls.add(prodUrl);
      products.push({
        productId: prodId,
        title: tTitle,
        price: tPrice,
        image: tImage,
        url: prodUrl,
      });
    }
  }

  return products;
}

/**
 * Detect the total number of pages and pagination pattern from the HTML.
 * SunShop uses various pagination patterns:
 *   - &page=N
 *   - &p=N (conflicts with product ID param, less common for pagination)
 *   - &start=N (offset-based)
 */
function detectPagination(html) {
  // Look for pagination links
  const pageLinks = [];

  // Pattern: page=N
  const pagePattern = /[?&]page=(\d+)/g;
  let match;
  while ((match = pagePattern.exec(html)) !== null) {
    pageLinks.push({ param: 'page', value: parseInt(match[1]) });
  }

  // Pattern: start=N
  const startPattern = /[?&]start=(\d+)/g;
  while ((match = startPattern.exec(html)) !== null) {
    pageLinks.push({ param: 'start', value: parseInt(match[1]) });
  }

  // Pattern: "Page X of Y" or "Showing X-Y of Z"
  const pageOfMatch = html.match(/Page\s+\d+\s+of\s+(\d+)/i);
  const showingMatch = html.match(/Showing\s+\d+\s*[-–]\s*\d+\s+of\s+(\d+)/i);
  const totalItems = showingMatch ? parseInt(showingMatch[1]) : null;
  const totalPages = pageOfMatch ? parseInt(pageOfMatch[1]) : null;

  // Determine which pagination param is used
  let paginationType = null;
  let maxPage = 1;

  if (pageLinks.length > 0) {
    // Group by param type and find max
    const byParam = {};
    for (const pl of pageLinks) {
      if (!byParam[pl.param]) byParam[pl.param] = [];
      byParam[pl.param].push(pl.value);
    }

    // Prefer 'page' param
    if (byParam['page']) {
      paginationType = 'page';
      maxPage = Math.max(...byParam['page']);
    } else if (byParam['start']) {
      paginationType = 'start';
      maxPage = Math.max(...byParam['start']);
    }
  }

  return {
    type: paginationType,
    maxPage,
    totalPages,
    totalItems,
  };
}

/**
 * Scrape all products from a single category, paginating as needed.
 */
async function scrapeCategory(categoryUrl, categoryId) {
  const products = [];
  let page = 1;
  let maxPage = 1;
  let paginationType = null;
  let emptyPages = 0;

  while (page <= maxPage && page <= 100 && emptyPages < 2) {
    let url;
    if (page === 1) {
      url = categoryUrl;
    } else if (paginationType === 'page') {
      const sep = categoryUrl.includes('?') ? '&' : '?';
      url = `${categoryUrl}${sep}page=${page}`;
    } else if (paginationType === 'start') {
      // Typically 10 or 20 items per page
      const sep = categoryUrl.includes('?') ? '&' : '?';
      url = `${categoryUrl}${sep}start=${(page - 1) * 20}`;
    } else {
      // Unknown pagination, try page= param
      const sep = categoryUrl.includes('?') ? '&' : '?';
      url = `${categoryUrl}${sep}page=${page}`;
    }

    let html;
    try {
      const res = await fetchWithRetry(url);
      html = await res.text();
    } catch (err) {
      console.log(`    Page ${page} failed: ${err.message}`);
      break;
    }

    // On first page, detect pagination
    if (page === 1) {
      const pagination = detectPagination(html);
      if (pagination.type) {
        paginationType = pagination.type;
        if (pagination.totalPages) {
          maxPage = pagination.totalPages;
        } else {
          maxPage = pagination.maxPage;
        }
      }
    }

    const pageProducts = parseProductsFromHtml(html);

    if (pageProducts.length === 0) {
      emptyPages++;
      // If first page is empty, this category might not exist
      if (page === 1) break;
    } else {
      emptyPages = 0;
    }

    products.push(...pageProducts);
    page++;

    if (page <= maxPage) await sleep(DELAY_MS);
  }

  return products;
}

/**
 * Infer tags from the product title and any category context.
 * PM Press primarily sells books, but also has some audio, DVDs, etc.
 */
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

  if (MERGE_ONLY) {
    if (!existsSync(CHECKPOINT_FILE)) {
      console.error(`Checkpoint file not found: ${CHECKPOINT_FILE}`);
      process.exit(1);
    }
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) byId.set(p.productId, p);
    console.log(`Loaded checkpoint: ${byId.size} products`);
  } else {
    // Step 1: Discover categories
    const categories = await discoverCategories();
    await sleep(DELAY_MS);

    // Step 2: Also try scraping the "all products" page if it exists
    // Some SunShop stores show all products at index.php?l=product_list with no category
    const allProductsUrls = [
      `${BASE}/index.php?l=product_list`,
      `${BASE}/index.php?l=product_list&c=0`,
    ];

    const allUrls = [
      ...allProductsUrls.map(url => ({ id: 'all', url, name: 'All Products' })),
      ...categories.map(c => ({ ...c, name: `Category ${c.id}` })),
    ];

    console.log(`\nScraping ${allUrls.length} URLs...`);

    for (let i = 0; i < allUrls.length; i++) {
      const cat = allUrls[i];
      process.stdout.write(`  [${i + 1}/${allUrls.length}] ${cat.name} (${cat.url})... `);

      const products = await scrapeCategory(cat.url, cat.id);
      let newCount = 0;

      for (const p of products) {
        if (!byId.has(p.productId)) {
          byId.set(p.productId, p);
          newCount++;
        }
      }

      console.log(`${products.length} found, ${newCount} new (${byId.size} total)`);

      // Save checkpoint every 10 categories
      if ((i + 1) % 10 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          products: [...byId.values()],
          lastCategory: i,
          timestamp: new Date().toISOString(),
        }));
        console.log(`  [checkpoint saved: ${byId.size} products]`);
      }

      await sleep(DELAY_MS);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      products: [...byId.values()],
      complete: true,
      timestamp: new Date().toISOString(),
    }));
    console.log(`\n[Final checkpoint saved]`);
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
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${storeProducts.length} ${STORE_NAME} from this scrape)`);
  console.log(`  (${nonStore.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-softstar.mjs
 * Scraper for Soft Star Shoes (softstarshoes.com) — a Magento store.
 * Worker-owned co-op in Corvallis, OR. Handcrafted minimalist shoes.
 *
 * Strategy: crawl the three main category listing pages (adult-shoes,
 * kids-shoes, gift-accessories) with product_list_limit=48, then
 * visit each product page to get full details (price, image, SKU, stock).
 *
 * Usage:
 *   node scripts/scrape-softstar.mjs              # scrape and save store JSON
 *   node scripts/scrape-softstar.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-softstar.mjs --merge-only # use existing checkpoint
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'softstar-shoes.json');
const BASE = 'https://www.softstarshoes.com';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 2500;
const CHECKPOINT_FILE = '/tmp/softstar-scrape-checkpoint.json';

const STORE_ID = 101;
const STORE_NAME = 'Soft Star Shoes';
const STORE_URL = 'https://www.softstarshoes.com';
const OWNERSHIP_TYPE = 'worker co-op';
const SITE_SECTION = 'Apparel';

// Categories to crawl — each may have multiple pages
const CATEGORIES = [
  { path: '/adult-shoes.html', label: 'adult-shoes', defaultTags: ['shoes', 'adult'] },
  { path: '/kids-shoes.html', label: 'kids-shoes', defaultTags: ['shoes', 'kids'] },
  { path: '/gift-accessories.html', label: 'accessories', defaultTags: ['accessories'] },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
      await sleep(2000 * (i + 1));
    }
  }
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
    .replace(/&trade;/g, '™')
    .replace(/&reg;/g, '®')
    .trim();
}

/**
 * Extract product URLs from a Magento category listing page.
 */
function extractProductUrls(html) {
  const urls = new Set();
  // Match product links in the listing grid
  // Magento uses <a class="product-item-link" href="..."> or <a href="..." title="..."> in product items
  const linkRegex = /<a\s[^>]*href="(https:\/\/www\.softstarshoes\.com\/[^"]+\.html)"[^>]*(?:title="[^"]*"|class="[^"]*product[^"]*")[^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Skip category/navigation links
    if (!url.includes('/adult-shoes') && !url.includes('/kids-shoes') &&
        !url.includes('/gift-accessories') && !url.includes('?') &&
        !url.includes('#') && !url.includes('/sizing') &&
        !url.includes('/about') && !url.includes('/how-made') &&
        !url.includes('/sustainable') && !url.includes('/minimal') &&
        !url.includes('/transitioning') && !url.includes('/growing') &&
        !url.includes('/clearance-') && !url.includes('/shop-som') &&
        !url.includes('/customer/') && !url.includes('/checkout/') &&
        !url.includes('/catalogsearch/')) {
      urls.add(url);
    }
  }

  // Also try a broader pattern for product links in the grid
  const hrefRegex = /href="(https:\/\/www\.softstarshoes\.com\/[a-z0-9][\w-]*\.html)"/gi;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    // Only include if it looks like a product URL (not a category or CMS page)
    if (!url.includes('/adult-shoes') && !url.includes('/kids-shoes') &&
        !url.includes('/gift-accessories') && !url.includes('/sizing') &&
        !url.includes('/about') && !url.includes('/how-made') &&
        !url.includes('/sustainable') && !url.includes('/minimal') &&
        !url.includes('/transitioning') && !url.includes('/growing') &&
        !url.includes('/customer/') && !url.includes('/checkout/') &&
        !url.includes('/catalogsearch/') && !url.includes('/privacy') &&
        !url.includes('/terms') && !url.includes('/return') &&
        !url.includes('/faq') && !url.includes('/contact') &&
        !url.includes('/blog') && !url.includes('/newsletter')) {
      urls.add(url);
    }
  }

  return [...urls];
}

/**
 * Extract product data from a single product page.
 */
function parseProductPage(html, url) {
  let title = null;
  let price = null;
  let image = null;
  let sku = null;
  let available = true;
  const tags = [];

  // --- Try JSON-LD ---
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const parsed = JSON.parse(content);
        const obj = Array.isArray(parsed) ? parsed.find(o => o['@type'] === 'Product') : parsed;
        if (obj && obj['@type'] === 'Product') {
          title = title || obj.name;
          image = image || (Array.isArray(obj.image) ? obj.image[0] : obj.image);
          sku = sku || obj.sku;
          if (obj.offers) {
            const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
            for (const offer of offers) {
              if (offer.price) { price = price || offer.price; break; }
              if (offer.lowPrice) { price = price || offer.lowPrice; break; }
            }
            // Check availability
            for (const offer of offers) {
              if (offer.availability && offer.availability.includes('OutOfStock')) {
                available = false;
              }
            }
          }
          break;
        }
        if (obj && obj['@graph']) {
          const product = obj['@graph'].find(g => g['@type'] === 'Product');
          if (product) {
            title = title || product.name;
            image = image || (Array.isArray(product.image) ? product.image[0] : product.image);
            sku = sku || product.sku;
            break;
          }
        }
      } catch { /* skip malformed JSON-LD */ }
    }
  }

  // --- Try GTM dataLayer for product info ---
  const gtmMatch = html.match(/\"product\"\s*:\s*\{[^}]*\"name\"\s*:\s*\"([^"]+)\"[^}]*\"price\"\s*:\s*(\d+(?:\.\d+)?)[^}]*\}/);
  if (gtmMatch) {
    title = title || decodeHtmlEntities(gtmMatch[1]);
    price = price || gtmMatch[2];
  }
  const skuGtm = html.match(/\"sku\"\s*:\s*\"([^"]+)\"/);
  if (skuGtm && !sku) sku = skuGtm[1];

  // --- Fallback: og:title ---
  if (!title) {
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitle) title = decodeHtmlEntities(ogTitle[1]);
  }

  // --- Fallback: h1 product title ---
  if (!title) {
    const h1 = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*<span>([^<]+)<\/span>/i);
    if (h1) title = decodeHtmlEntities(h1[1]);
  }
  if (!title) {
    const h1 = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i);
    if (h1) title = decodeHtmlEntities(h1[1]);
  }

  // --- Price fallbacks ---
  if (!price) {
    // Special price first (sale price)
    const specialPrice = html.match(/class="[^"]*special-price[^"]*"[\s\S]*?<span[^>]*class="[^"]*price["'][^>]*>\$?([\d,.]+)/i);
    if (specialPrice) price = specialPrice[1];
  }
  if (!price) {
    // "Starting at" or regular price
    const priceMatch = html.match(/<span[^>]*class="[^"]*price["'][^>]*>\$?([\d,.]+)<\/span>/i);
    if (priceMatch) price = priceMatch[1];
  }
  if (!price) {
    const metaPrice = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
    if (metaPrice) price = metaPrice[1];
  }

  // --- Image fallbacks ---
  if (!image) {
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage) image = ogImage[1];
  }
  if (!image) {
    // Magento gallery image
    const galleryImg = html.match(/"full"\s*:\s*"(https:\/\/[^"]+)"/);
    if (galleryImg) image = galleryImg[1];
  }

  // --- Stock check ---
  if (html.includes('Out of stock') || html.includes('out-of-stock') ||
      html.includes('"is_in_stock":false') || html.includes('Currently unavailable')) {
    available = false;
  }

  // --- Build tags ---
  const urlLower = url.toLowerCase();
  const titleLower = (title || '').toLowerCase();

  // Determine category from URL or breadcrumbs
  if (urlLower.includes('baby') || titleLower.includes('baby')) {
    tags.push('shoes', 'kids', 'baby');
  } else if (urlLower.includes('child') || urlLower.includes('youth') ||
             titleLower.includes('child') || titleLower.includes('youth')) {
    tags.push('shoes', 'kids');
  } else if (urlLower.includes('adult') || urlLower.includes('primal') ||
             urlLower.includes('runamoc') || urlLower.includes('moccasin') ||
             urlLower.includes('boot') || urlLower.includes('sandal') ||
             urlLower.includes('slipper') || urlLower.includes('ballerine') ||
             urlLower.includes('flats') || urlLower.includes('rogue') ||
             urlLower.includes('dash') || urlLower.includes('hawthorne') ||
             urlLower.includes('solstice') || urlLower.includes('switchback') ||
             urlLower.includes('astoria') || urlLower.includes('phoenix') ||
             urlLower.includes('sawyer') || urlLower.includes('chinook')) {
    tags.push('shoes');
  }

  // Product type tags
  if (titleLower.includes('boot')) tags.push('boots');
  if (titleLower.includes('sandal')) tags.push('sandals');
  if (titleLower.includes('slipper')) tags.push('slippers');
  if (titleLower.includes('moccasin') || titleLower.includes('moc')) tags.push('moccasins');
  if (titleLower.includes('sock')) tags.push('socks');
  if (titleLower.includes('insole')) tags.push('insoles');
  if (titleLower.includes('lace')) tags.push('laces');
  if (titleLower.includes('toe spacer') || titleLower.includes('correct toes')) tags.push('foot health');
  if (titleLower.includes('leather care') || titleLower.includes('leathercare') ||
      titleLower.includes('nikwax') || titleLower.includes('bee natural')) tags.push('shoe care');
  if (titleLower.includes('gift card')) tags.push('gift cards');

  // Feature tags
  if (titleLower.includes('primal')) tags.push('minimalist');
  if (titleLower.includes('sheepskin')) tags.push('sheepskin');
  if (titleLower.includes('merino')) tags.push('merino wool');
  if (titleLower.includes('earthing') || titleLower.includes('grounding')) tags.push('grounding');

  // If no tags yet, mark as accessory
  if (tags.length === 0) tags.push('accessories');

  // Deduplicate tags
  const uniqueTags = [...new Set(tags)];

  // Format price
  if (price && !String(price).startsWith('$')) {
    price = `$${price}`;
  }

  return { title, price, image, url, sku, available, tags: uniqueTags };
}

/**
 * Crawl a category page and extract product URLs.
 * Handles pagination by following ?p=N.
 */
async function crawlCategory(category) {
  const allUrls = new Set();
  let page = 1;

  while (true) {
    const params = `product_list_limit=48${page > 1 ? `&p=${page}` : ''}`;
    const categoryUrl = `${BASE}${category.path}?${params}`;
    console.log(`  Fetching ${category.label} page ${page}...`);

    const res = await fetchWithRetry(categoryUrl);
    if (!res.ok) {
      console.log(`  HTTP ${res.status} — stopping pagination for ${category.label}`);
      break;
    }
    const html = await res.text();
    const urls = extractProductUrls(html);

    if (urls.length === 0) {
      if (page === 1) console.log(`  No products found on ${category.label} page 1`);
      break;
    }

    const beforeSize = allUrls.size;
    for (const u of urls) allUrls.add(u);
    const newCount = allUrls.size - beforeSize;
    console.log(`  Found ${urls.length} links (${newCount} new) on page ${page}`);

    // If we got fewer than 48, there's no next page
    if (urls.length < 48 || newCount === 0) break;

    page++;
    await sleep(DELAY_MS);
  }

  return [...allUrls];
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
    // Step 1: Collect all product URLs from category pages
    console.log('Crawling category pages for product URLs...\n');
    const allProductUrls = new Set();
    const categoryMap = new Map(); // url -> category info

    for (const cat of CATEGORIES) {
      const urls = await crawlCategory(cat);
      for (const u of urls) {
        if (!allProductUrls.has(u)) {
          allProductUrls.add(u);
          categoryMap.set(u, cat);
        }
      }
      await sleep(DELAY_MS);
    }

    const productUrls = [...allProductUrls];
    console.log(`\nTotal unique product URLs: ${productUrls.length}\n`);

    if (productUrls.length === 0) {
      console.error('No product URLs found — site structure may have changed');
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
      const slug = url.replace(BASE + '/', '').replace('.html', '');
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

      // Save checkpoint every 20 products
      if ((i + 1) % 20 === 0) {
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
    console.log('Dry run — not writing to store file');
    if (products.length > 0) {
      console.log('\nSample product:');
      console.log(JSON.stringify(products[0], null, 2));
    }
    return;
  }

  // Group products into sections for the store JSON format
  const sectionMap = new Map();
  for (const p of products) {
    // Determine section label from tags
    let sectionLabel = 'other';
    if (p.tags.includes('baby')) sectionLabel = 'baby-shoes';
    else if (p.tags.includes('kids')) sectionLabel = 'kids-shoes';
    else if (p.tags.includes('boots')) sectionLabel = 'boots';
    else if (p.tags.includes('sandals')) sectionLabel = 'sandals';
    else if (p.tags.includes('slippers') || p.tags.includes('moccasins')) sectionLabel = 'slippers-moccasins';
    else if (p.tags.includes('shoes')) sectionLabel = 'shoes';
    else if (p.tags.includes('socks')) sectionLabel = 'socks';
    else if (p.tags.includes('insoles')) sectionLabel = 'insoles';
    else if (p.tags.includes('shoe care')) sectionLabel = 'shoe-care';
    else if (p.tags.includes('foot health')) sectionLabel = 'foot-health';
    else sectionLabel = 'accessories';

    if (!sectionMap.has(sectionLabel)) sectionMap.set(sectionLabel, []);

    const slug = p.url.replace(BASE + '/', '').replace('.html', '').replace(/[^a-z0-9]/gi, '-');
    sectionMap.get(sectionLabel).push({
      id: `${STORE_ID}-softstar-${p.sku || slug}`,
      title: p.title,
      price: p.price,
      available: p.available,
      image: p.image,
      url: p.url,
      store_name: STORE_NAME,
      store_url: STORE_URL,
      ownership_type: OWNERSHIP_TYPE,
      site_section: SITE_SECTION,
      tags: p.tags,
    });
  }

  // Build sections array
  const sections = [];
  // Preferred section order
  const sectionOrder = ['shoes', 'boots', 'sandals', 'slippers-moccasins', 'kids-shoes', 'baby-shoes', 'socks', 'insoles', 'foot-health', 'shoe-care', 'accessories', 'other'];
  for (const label of sectionOrder) {
    if (sectionMap.has(label)) {
      const prods = sectionMap.get(label);
      sections.push({ label, count: prods.length, products: prods });
    }
  }
  // Any sections not in the order
  for (const [label, prods] of sectionMap) {
    if (!sectionOrder.includes(label)) {
      sections.push({ label, count: prods.length, products: prods });
    }
  }

  const totalProducts = products.length;
  const sectionIndex = sections.map(s => ({
    slug: s.label,
    label: s.label,
    count: s.count,
    totalPages: Math.ceil(s.count / 96),
  }));

  const output = { total: totalProducts, sections, sectionIndex };
  writeFileSync(STORE_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${totalProducts} products to ${STORE_FILE}`);
  for (const s of sections) {
    console.log(`  ${s.label}: ${s.count} products`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

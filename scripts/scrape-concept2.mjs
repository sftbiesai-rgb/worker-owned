#!/usr/bin/env node
/**
 * scrape-concept2.mjs
 * Scraper for Concept2 (concept2.com) — a purpose trust-owned company.
 * Makes rowing machines, ski trainers, bikes, and fitness equipment.
 *
 * Strategy: Concept2 has a small product catalog. Main machines live at
 * /ergs/* pages, and accessories/parts at /product/* pages. We fetch the
 * sitemap to discover /product/* URLs, then scrape each page for details.
 * The main erg pages are handled specially since they have a different layout.
 *
 * Usage:
 *   node scripts/scrape-concept2.mjs              # scrape and save
 *   node scripts/scrape-concept2.mjs --dry-run    # show results without writing
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'concept2.json');
const BASE = 'https://www.concept2.com';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 600;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .trim();
}

/**
 * Extract product info from a /product/* page.
 */
function parseProductPage(html, url) {
  let title = null;
  let price = null;
  let image = null;

  // Try og:title
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitle) title = decodeHtmlEntities(ogTitle[1]);

  // Fallback: <title> tag
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) {
      title = decodeHtmlEntities(titleTag[1]).replace(/\s*\|\s*Concept2.*$/i, '').trim();
    }
  }

  // Fallback: h1
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1) title = decodeHtmlEntities(h1[1]);
  }

  // Price — look for dollar amounts in price-related elements
  // Try a price field or similar
  const pricePatterns = [
    /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /\bprice[^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /<span[^>]*>\s*\$([\d,]+(?:\.\d{2})?)\s*<\/span>/i,
    /\$([\d,]+\.\d{2})/,
  ];
  for (const pat of pricePatterns) {
    const m = html.match(pat);
    if (m) {
      price = `$${m[1]}`;
      break;
    }
  }

  // Image — og:image
  const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImage) image = ogImage[1];

  // Fallback image from main content area
  if (!image) {
    const imgMatch = html.match(/<img[^>]+src=["'](https:\/\/cms\.concept2\.com\/[^"']+)["']/i);
    if (imgMatch) image = imgMatch[1];
  }

  // Check for "Add to Cart" to determine availability
  const hasAddToCart = /add.to.cart/i.test(html);

  return { title, price, image, url, available: hasAddToCart };
}

/**
 * Extract product info from an /ergs/* page (main machines).
 * These pages have a different layout with model selectors.
 */
function parseErgPage(html, url) {
  let title = null;
  let price = null;
  let image = null;

  // og:title
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitle) title = decodeHtmlEntities(ogTitle[1]);

  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) {
      title = decodeHtmlEntities(titleTag[1]).replace(/\s*\|\s*Concept2.*$/i, '').trim();
    }
  }

  // Price — first dollar amount on page (usually the base price)
  const priceMatch = html.match(/\$([\d,]+\.\d{2})/);
  if (priceMatch) {
    price = `$${priceMatch[1]}`;
  }

  // og:image
  const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImage) image = ogImage[1];

  // Fallback: image_src link tag
  if (!image) {
    const imgSrc = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
    if (imgSrc) image = imgSrc[1];
  }

  if (!image) {
    const imgMatch = html.match(/<img[^>]+src=["'](https:\/\/cms\.concept2\.com\/[^"']+)["']/i);
    if (imgMatch) image = imgMatch[1];
  }

  return { title, price, image, url, available: true };
}

/**
 * Determine tags based on product title and URL.
 */
function deriveTags(title, url) {
  const tags = ['fitness equipment'];
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (t.includes('rowerg') || t.includes('rower') || t.includes('rowing') || u.includes('rowerg')) {
    tags.push('rowing machine');
  }
  if (t.includes('skierg') || t.includes('ski') || u.includes('skierg')) {
    tags.push('ski trainer');
  }
  if (t.includes('bikeerg') || t.includes('bike') || u.includes('bikeerg')) {
    tags.push('exercise bike');
  }
  if (t.includes('strengtherg') || u.includes('strengtherg')) {
    tags.push('strength training');
  }
  if ((t.includes('dynamic') || u.includes('dynamic')) && !tags.includes('rowing machine')) {
    tags.push('rowing machine');
  }
  if (t.includes('slide')) {
    tags.push('rowing accessory');
  }
  if (t.includes('floor stand')) {
    tags.push('equipment stand');
  }
  if (t.includes('floor mat') || t.includes('mat')) {
    tags.push('floor mat');
  }
  if (t.includes('cover')) {
    tags.push('equipment cover');
  }
  if (t.includes('heart rate') || t.includes('hrm')) {
    tags.push('heart rate monitor');
  }
  if (t.includes('seat') || t.includes('pad')) {
    tags.push('seat accessory');
  }
  if (t.includes('logcard') || t.includes('log card')) {
    tags.push('training accessory');
  }
  if (t.includes('oar') || t.includes('scull')) {
    tags.push('rowing gear');
  }

  // If only base tag, add 'accessory'
  if (tags.length === 1) {
    tags.push('accessory');
  }

  return tags;
}

async function main() {
  // Curated product URLs: main machines + key consumer accessories.
  // Concept2 has ~90 /product/ pages but most are small replacement parts
  // (bolts, washers, bearings). We include the 5 main ergs plus the best
  // consumer-facing accessories.
  const allUrls = [
    // Main machines (erg pages — different layout)
    { url: `${BASE}/ergs/rowerg`, isErg: true },
    { url: `${BASE}/ergs/skierg`, isErg: true },
    { url: `${BASE}/ergs/bikeerg`, isErg: true },
    { url: `${BASE}/ergs/strengtherg`, isErg: true },
    { url: `${BASE}/ergs/dynamic-rowerg`, isErg: true },
    // Key accessories (product pages)
    { url: `${BASE}/product/22`, isErg: false },   // Slide Pair ($390)
    { url: `${BASE}/product/23`, isErg: false },   // Slide Single ($195)
    { url: `${BASE}/product/295`, isErg: false },  // SkiErg Floor Stand ($220)
    { url: `${BASE}/product/336`, isErg: false },  // RowErg Floor Mat ($55)
    { url: `${BASE}/product/25`, isErg: false },   // RowErg Cover ($65)
    { url: `${BASE}/product/815`, isErg: false },  // Deluxe Seat Pad ($12)
    { url: `${BASE}/product/338`, isErg: false },  // PM5 Retrofit Kit ($160)
    { url: `${BASE}/product/20`, isErg: false },   // Dynamic Link ($65)
    { url: `${BASE}/product/garmin-hrm-200`, isErg: false },  // Garmin HRM 200 ($80)
    { url: `${BASE}/product/699`, isErg: false },  // RowErg Device Holder ($25)
    { url: `${BASE}/product/757`, isErg: false },  // SkiErg Device Holder ($25)
  ];

  const products = [];

  console.log(`Scraping ${allUrls.length} Concept2 product pages...\n`);

  for (let i = 0; i < allUrls.length; i++) {
    const { url, isErg } = allUrls[i];
    const slug = isErg
      ? url.split('/ergs/')[1]
      : (url.split('/product/')[1] || url);
    process.stdout.write(`  [${i + 1}/${allUrls.length}] ${slug}... `);
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        console.log(`SKIP (HTTP ${res.status})`);
        continue;
      }
      const html = await res.text();
      const product = isErg ? parseErgPage(html, url) : parseProductPage(html, url);
      if (!product.title) {
        console.log('SKIP (no title)');
        continue;
      }
      product.tags = deriveTags(product.title, url);
      products.push(product);
      console.log(`OK — ${product.title} — ${product.price || 'no price'}`);
    } catch (err) {
      console.log(`FAIL (${err.message})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nTotal: ${products.length} products scraped`);

  if (DRY_RUN) {
    console.log('\nDry run — not writing output file');
    console.log('\nSample products:');
    for (const p of products.slice(0, 5)) {
      console.log(JSON.stringify(p, null, 2));
    }
    return;
  }

  // Format for store JSON output
  const storeProducts = products.map((p, i) => {
    const slug = p.url.includes('/ergs/')
      ? p.url.split('/ergs/')[1]
      : (p.url.split('/product/')[1] || String(i));
    return {
      id: `concept2-${slug}`,
      title: p.title,
      price: p.price || '',
      url: p.url,
      image: p.image || '',
      available: p.available,
      tags: p.tags,
    };
  });

  // Build the store JSON structure
  const output = {
    total: storeProducts.length,
    sections: [
      {
        label: 'Fitness Equipment',
        count: storeProducts.length,
        products: storeProducts,
      },
    ],
    sectionIndex: [
      {
        slug: 'fitness-equipment',
        label: 'Fitness Equipment',
        count: storeProducts.length,
        totalPages: 1,
      },
    ],
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${storeProducts.length} products to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

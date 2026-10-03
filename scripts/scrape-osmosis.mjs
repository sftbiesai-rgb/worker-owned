#!/usr/bin/env node
/**
 * scrape-osmosis.mjs
 * Scraper for Osmosis Day Spa Sanctuary (osmosis.com) — a WooCommerce store.
 * Purpose trust-owned skincare/wellness company.
 *
 * Strategy: the WooCommerce Store API caps results and misses some products.
 * Instead, we scrape the HTML category pages which show all products.
 * We fetch each leaf-level category page (with pagination) and extract
 * product data from the HTML, then deduplicate by URL.
 *
 * Usage:
 *   node scripts/scrape-osmosis.mjs
 *   node scripts/scrape-osmosis.mjs --dry-run
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, '..', 'public', 'data', 'stores', 'osmosis-day-spa.json');
const BASE = 'https://osmosis.com';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 800;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      if (i === retries - 1) return null;
      console.log(`  (retry ${i + 1}/${retries})`);
      await sleep(2000 * (i + 1));
    }
  }
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#038;/g, '&')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extract products from a WooCommerce category page HTML.
 * WooCommerce uses <li class="product"> or <li class="... product ..."> elements.
 */
function extractProducts(html, categoryName) {
  const products = [];

  // Match each product block — WooCommerce wraps each in <li class="...product...">
  // We look for product links, titles, prices, and images
  const productBlocks = html.split(/<li[^>]*class="[^"]*product[^"]*"[^>]*>/gi);

  for (let i = 1; i < productBlocks.length; i++) {
    const block = productBlocks[i].split(/<\/li>/)[0] || '';

    // Extract URL
    const urlMatch = block.match(/<a[^>]+href="(https:\/\/osmosis\.com\/product\/[^"]+)"/i);
    if (!urlMatch) continue;
    const url = urlMatch[1];

    // Extract title - try multiple patterns
    let title = '';
    // WooCommerce product title heading
    const titleMatch = block.match(/<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)<\/h2>/i)
      || block.match(/<h3[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)<\/h3>/i)
      || block.match(/<h2[^>]*>([^<]+)<\/h2>/i)
      || block.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    if (titleMatch) {
      title = decodeHtml(titleMatch[1]);
    }

    // Extract price
    let price = '';
    // Look for the price amount
    const priceMatch = block.match(/<(?:span|ins)[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<bdi[^>]*>([^<]+)<\/bdi>/i)
      || block.match(/<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([^<]+)<\/span>/i)
      || block.match(/<bdi>([^<]+)<\/bdi>/i);
    if (priceMatch) {
      const raw = priceMatch[1].replace(/[^\d.,]/g, '');
      price = raw ? `$${raw}` : '';
    }

    // Extract image
    let image = '';
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
      image = imgMatch[1];
      // Get full-size image if it's a thumbnail
      const srcsetMatch = block.match(/<img[^>]+srcset="([^"]+)"/i);
      if (srcsetMatch) {
        // Get the largest image from srcset
        const srcset = srcsetMatch[1];
        const parts = srcset.split(',').map(s => s.trim());
        let maxW = 0;
        for (const part of parts) {
          const [srcUrl, descriptor] = part.split(/\s+/);
          const w = parseInt(descriptor, 10) || 0;
          if (w > maxW) {
            maxW = w;
            image = srcUrl;
          }
        }
      }
    }

    // Generate an ID from the URL slug
    const slugMatch = url.match(/\/product\/([^/?#]+)/);
    const slug = slugMatch ? slugMatch[1].replace(/\/$/, '') : '';

    if (title && slug) {
      products.push({
        id: `osmosis-${slug}`,
        title,
        price,
        image,
        url: url.replace(/\/$/, '/'),
        available: true, // listed on the shop = available
        categoryName,
      });
    }
  }

  return products;
}

/**
 * Check if there's a next page in the pagination
 */
function getNextPageUrl(html) {
  const nextMatch = html.match(/<a[^>]+class="[^"]*next[^"]*"[^>]+href="([^"]+)"/i);
  return nextMatch ? nextMatch[1] : null;
}

async function scrapeCategory(catUrl, catName) {
  const products = [];
  let url = catUrl;
  let page = 1;

  while (url) {
    process.stdout.write(`    page ${page}... `);
    const html = await fetchPage(url);
    if (!html) {
      console.log('FAIL');
      break;
    }

    const pageProducts = extractProducts(html, catName);
    console.log(`${pageProducts.length} products`);
    products.push(...pageProducts);

    const nextUrl = getNextPageUrl(html);
    if (nextUrl && nextUrl !== url) {
      url = nextUrl;
      page++;
      await sleep(DELAY_MS);
    } else {
      break;
    }
  }

  return products;
}

async function main() {
  console.log('Scraping Osmosis Day Spa Sanctuary via HTML category pages...\n');

  // Top-level categories to scrape (from the shop sidebar)
  // These are the leaf categories or top-level ones that list products directly.
  // We use the top-level categories: Organic Skin Care (75), Body (20),
  // Wellness (12), Gifts (23), Clothing (1), Uncategorized (9)
  // Plus Brands sub-brands: KPS (23), Laurel (16), Naturopathica (8),
  // Phyt's (16), True Botanicals (5), Vital Body CBD (9)
  const categoriesToScrape = [
    // Top-level product categories
    { url: `${BASE}/product-category/skin-care/`, name: 'Organic Skin Care' },
    { url: `${BASE}/product-category/body/`, name: 'Body' },
    { url: `${BASE}/product-category/wellness/`, name: 'Wellness' },
    { url: `${BASE}/product-category/gifts/`, name: 'Gifts' },
    { url: `${BASE}/product-category/clothing/`, name: 'Clothing' },
    { url: `${BASE}/product-category/uncategorized/`, name: 'Uncategorized' },
    // Brand sub-categories (children of Brands)
    { url: `${BASE}/product-category/brands/kps/`, name: 'KPS' },
    { url: `${BASE}/product-category/brands/laurel/`, name: 'Laurel' },
    { url: `${BASE}/product-category/brands/naturopathica/`, name: 'Naturopathica' },
    { url: `${BASE}/product-category/brands/phyts/`, name: "Phyt's" },
    { url: `${BASE}/product-category/brands/true-botanicals/`, name: 'True Botanicals' },
    { url: `${BASE}/product-category/brands/vital-body-cbd/`, name: 'Vital Body CBD' },
  ];

  const productMap = new Map(); // id -> product

  for (const cat of categoriesToScrape) {
    console.log(`  ${cat.name} (${cat.url})`);
    const products = await scrapeCategory(cat.url, cat.name);

    let newCount = 0;
    for (const p of products) {
      if (!productMap.has(p.id)) {
        productMap.set(p.id, p);
        newCount++;
      }
    }
    console.log(`    -> ${products.length} found, ${newCount} new (total: ${productMap.size})\n`);
    await sleep(DELAY_MS);
  }

  const allProducts = [...productMap.values()];
  console.log(`Total unique products: ${allProducts.length}`);

  // Enrich with Store API data where possible (for better images, descriptions)
  console.log('\nEnriching with Store API data...');
  const API = `${BASE}/wp-json/wc/store/v1/products`;
  const apiProducts = new Map();

  // Fetch all we can from the API (up to 100)
  const apiRes = await fetchPage(`${API}?per_page=100`);
  if (apiRes) {
    try {
      const apiData = JSON.parse(apiRes);
      if (Array.isArray(apiData)) {
        for (const p of apiData) {
          const slug = p.slug || '';
          apiProducts.set(`osmosis-${slug}`, p);
          // Also map by permalink
          const permSlug = p.permalink?.match(/\/product\/([^/?#]+)/)?.[1]?.replace(/\/$/, '');
          if (permSlug) apiProducts.set(`osmosis-${permSlug}`, p);
        }
        console.log(`  Got ${apiData.length} API products for enrichment`);
      }
    } catch { console.log('  Failed to parse API response'); }
  }

  // Enrich products with API data
  for (const p of allProducts) {
    const apiP = apiProducts.get(p.id);
    if (apiP) {
      // Use better image from API if available
      if (apiP.images?.[0]?.src) {
        p.image = apiP.images[0].src;
      }
      // Get availability from API
      p.available = apiP.is_purchasable !== false && apiP.is_in_stock !== false;
      // Get more accurate price
      if (apiP.prices) {
        const raw = apiP.prices.price || apiP.prices.regular_price;
        if (raw) {
          const dec = apiP.prices.currency_minor_unit ?? 2;
          const amount = parseInt(raw, 10) / Math.pow(10, dec);
          p.price = `$${amount.toFixed(2)}`;
        }
      }
      // Get tags from API categories
      if (apiP.categories) {
        const apiTags = [];
        for (const cat of apiP.categories) {
          const name = cat.name?.toLowerCase().trim();
          if (name && name !== 'uncategorized') apiTags.push(name);
        }
        if (apiP.tags) {
          for (const tag of apiP.tags) {
            const name = tag.name?.toLowerCase().trim();
            if (name && !apiTags.includes(name)) apiTags.push(name);
          }
        }
        if (apiTags.length > 0) {
          p.apiTags = apiTags;
        }
      }
    }
  }

  // Build tags for all products
  for (const p of allProducts) {
    const tags = [];
    const catName = (p.categoryName || '').toLowerCase();

    // Use API tags if available
    if (p.apiTags) {
      tags.push(...p.apiTags);
    } else {
      // Use category name
      if (catName && catName !== 'uncategorized') {
        tags.push(catName);
      }
    }

    // Add keyword-based tags from title
    const titleLower = p.title.toLowerCase();
    if (titleLower.includes('serum') && !tags.includes('serum')) tags.push('serum');
    if (titleLower.includes('cleanser') && !tags.includes('cleanser')) tags.push('cleanser');
    if (titleLower.includes('moisturiz') && !tags.includes('moisturizer')) tags.push('moisturizer');
    if ((titleLower.includes('sunscreen') || titleLower.includes('spf')) && !tags.includes('sunscreen')) tags.push('sunscreen');
    if (titleLower.includes('mask') && !tags.includes('mask')) tags.push('mask');
    if (titleLower.includes('oil') && !tags.includes('oil')) tags.push('oil');
    if (titleLower.includes('cream') && !tags.includes('cream')) tags.push('cream');
    if (titleLower.includes('toner') && !tags.includes('toner')) tags.push('toner');

    if (!tags.includes('skincare') && !tags.includes('wellness') && !tags.includes('clothing')) {
      tags.push('skincare');
    }

    p.tags = tags;
    delete p.categoryName;
    delete p.apiTags;
  }

  if (DRY_RUN) {
    console.log('\nDry run -- not writing to file');
    console.log('\nSample products:');
    for (const p of allProducts.slice(0, 5)) {
      console.log(JSON.stringify(p, null, 2));
    }
    return;
  }

  // Build output in the store file format
  const sections = {};
  for (const p of allProducts) {
    let section = 'Skincare';
    const tagStr = p.tags.join(' ');
    if (tagStr.includes('gift') || tagStr.includes('clothing')) section = 'Gifts & Accessories';
    else if (tagStr.includes('wellness') || tagStr.includes('bath') || tagStr.includes('cbd') || tagStr.includes('aromatherapy')) section = 'Wellness';
    else if (tagStr.includes('body') && !tagStr.includes('organic skin care')) section = 'Body Care';

    if (!sections[section]) sections[section] = [];
    sections[section].push({
      store_id: null,
      title: p.title,
      price: p.price,
      url: p.url,
      image: p.image,
      available: p.available,
      store_name: 'Osmosis Day Spa Sanctuary',
      site_section: 'Health & Wellness',
      ownership_type: 'purpose-trust',
      store_url: 'https://osmosis.com',
      tags: p.tags,
    });
  }

  const sectionArray = Object.entries(sections).map(([label, products]) => ({
    label,
    count: products.length,
    products,
  }));

  const output = {
    total: allProducts.length,
    sections: sectionArray,
    sectionIndex: sectionArray.map(s => ({
      slug: s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
      label: s.label,
      count: s.count,
      totalPages: Math.ceil(s.count / 48),
    })),
  };

  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${allProducts.length} products to ${STORE_FILE}`);
  console.log('Sections:', sectionArray.map(s => `${s.label} (${s.count})`).join(', '));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scrape-scheels.mjs
 * Scraper for Scheels All Sports (scheels.com).
 *
 * Scheels uses Cloudflare JS challenge — requires puppeteer.
 * Instead of visiting 168K individual product URLs, we crawl ~800 category
 * pages, each of which lists dozens of in-stock products. This is ~200x
 * fewer page loads.
 *
 * Product data comes from JSON-LD on individual product pages, but we
 * extract product links + basic info from category page grids.
 *
 * Usage:
 *   node scripts/scrape-scheels.mjs              # full scrape + merge
 *   node scripts/scrape-scheels.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-scheels.mjs --resume     # resume from checkpoint
 *   node scripts/scrape-scheels.mjs --merge-only # merge existing checkpoint into products.json
 *   node scripts/scrape-scheels.mjs --enrich    # fetch prices from product pages for category-scraped products
 *   node scripts/scrape-scheels.mjs --enrich-details  # fetch color/size/attributes from product pages
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/scheels-categories-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');
const ENRICH = process.argv.includes('--enrich') && !process.argv.includes('--enrich-details');
const ENRICH_DETAILS = process.argv.includes('--enrich-details');

const PARALLEL_TABS = ENRICH_DETAILS ? 3 : (ENRICH ? 10 : 5);
const DELAY_MS = ENRICH_DETAILS ? 1500 : (ENRICH ? 300 : 500);
const CHECKPOINT_INTERVAL = 50;
const ENRICH_CHECKPOINT_FILE = '/tmp/scheels-enrich-checkpoint.json';
const DETAILS_CHECKPOINT_FILE = '/tmp/scheels-details-checkpoint.json';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BREADCRUMB_TO_SECTION = {
  'fishing': 'Sporting Goods', 'hunting': 'Sporting Goods', 'camping': 'Sporting Goods',
  'golf': 'Sporting Goods', 'baseball': 'Sporting Goods', 'softball': 'Sporting Goods',
  'basketball': 'Sporting Goods', 'football': 'Sporting Goods', 'soccer': 'Sporting Goods',
  'hockey': 'Sporting Goods', 'tennis': 'Sporting Goods', 'pickleball': 'Sporting Goods',
  'volleyball': 'Sporting Goods', 'lacrosse': 'Sporting Goods', 'wrestling': 'Sporting Goods',
  'archery': 'Sporting Goods', 'shooting': 'Sporting Goods', 'firearms': 'Sporting Goods',
  'ammunition': 'Sporting Goods', 'biking': 'Sporting Goods', 'cycling': 'Sporting Goods',
  'fitness': 'Sporting Goods', 'exercise': 'Sporting Goods', 'weights': 'Sporting Goods',
  'yoga': 'Sporting Goods', 'running': 'Sporting Goods', 'water sports': 'Sporting Goods',
  'kayak': 'Sporting Goods', 'paddle': 'Sporting Goods', 'skiing': 'Sporting Goods',
  'snowboard': 'Sporting Goods', 'skateboard': 'Sporting Goods',
  'sports': 'Sporting Goods', 'athletics': 'Sporting Goods',
  'clothing': 'Apparel', 'shirts': 'Apparel', 'pants': 'Apparel', 'jackets': 'Apparel',
  'coats': 'Apparel', 'outerwear': 'Apparel', 'activewear': 'Apparel',
  'jeans': 'Apparel', 'shorts': 'Apparel', 'dresses': 'Apparel', 'sweaters': 'Apparel',
  'hoodies': 'Apparel', 'underwear': 'Apparel', 'socks': 'Apparel', 'hats': 'Apparel',
  'gloves': 'Apparel', 'accessories': 'Apparel', 'sunglasses': 'Apparel',
  'watches': 'Apparel', 'jewelry': 'Apparel', 'bags': 'Apparel', 'backpacks': 'Apparel',
  'shoes': 'Apparel', 'boots': 'Apparel', 'sandals': 'Apparel', 'slippers': 'Apparel',
  'footwear': 'Apparel', 'sneakers': 'Apparel',
  'home': 'Home Goods', 'kitchen': 'Home Goods', 'decor': 'Home Goods',
  'furniture': 'Home Goods', 'bedding': 'Home Goods', 'bath': 'Home Goods',
  'outdoor living': 'Home Goods', 'patio': 'Home Goods', 'grill': 'Home Goods',
  'toys': 'Games', 'games': 'Games', 'lego': 'Games', 'puzzles': 'Games',
  'electronics': 'Tech & Software', 'gopro': 'Tech & Software', 'garmin': 'Tech & Software',
  'optics': 'Tech & Software',
  'pet': 'Home Goods',
};

function inferSection(categoryPath, title) {
  const text = [categoryPath, title].join(' ').toLowerCase();
  for (const [keyword, section] of Object.entries(BREADCRUMB_TO_SECTION)) {
    if (text.includes(keyword)) return section;
  }
  return 'Sporting Goods';
}

function saveCheckpoint(products, completedCategories) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    products: [...products.values()],
    completedCategories: [...completedCategories],
    timestamp: new Date().toISOString(),
  }));
}

async function solveCloudflareThenGetPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'font', 'media'].includes(type)) req.abort();
    else req.continue();
  });

  await page.goto('https://www.scheels.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const content = await page.content();
    if (!content.includes('Just a moment')) {
      console.log(`Cloudflare cleared after ${i + 1}s`);
      return page;
    }
  }
  throw new Error('Cloudflare challenge did not clear after 30s');
}

async function fetchCategoryUrls(page) {
  console.log('Fetching category sitemap...');
  await page.goto('https://www.scheels.com/sitemap/sitemap-categories.xml', {
    waitUntil: 'networkidle2', timeout: 30000,
  });
  const content = await page.content();
  const urls = [...content.matchAll(/<loc>(https:\/\/www\.scheels\.com\/c\/[^<]+)<\/loc>/g)]
    .map(m => m[1])
    // Skip event/location pages, only keep product categories
    .filter(u => !u.includes('/events/'));
  console.log(`Found ${urls.length} category URLs`);
  return urls;
}

/**
 * Scrape a single category page — extract all product links and basic info.
 * Scrolls to load lazy-loaded products, then paginates if needed.
 */
async function scrapeCategory(page, categoryUrl, retries = 2) {
  const products = [];
  const categoryPath = categoryUrl.replace('https://www.scheels.com/c/', '');

  try {
    let currentUrl = categoryUrl;
    let pageNum = 0;

    while (currentUrl) {
      pageNum++;
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait for product grid to render
      await new Promise(r => setTimeout(r, 2000));

      // Scroll down to trigger lazy loading
      for (let s = 0; s < 10; s++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 300));
      }

      const pageProducts = await page.evaluate((catPath) => {
        const items = [];

        // Try to extract from product card links
        const productLinks = document.querySelectorAll('a[href*="/p/"]');
        const seen = new Set();

        for (const link of productLinks) {
          const href = link.getAttribute('href');
          if (!href || !href.startsWith('/p/')) continue;
          const fullUrl = `https://www.scheels.com${href}`;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          // Try to find product info near this link
          const card = link.closest('[data-testid], [class*="product"], [class*="card"], article, li') || link.parentElement;
          if (!card) continue;

          const title = card.querySelector('h2, h3, [class*="name"], [class*="title"]')?.textContent?.trim()
            || link.textContent?.trim()
            || '';

          const priceEl = card.querySelector('[class*="price"], [class*="Price"]');
          const priceText = priceEl?.textContent?.trim() || '';
          const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
          const price = priceMatch ? priceMatch[1].replace(',', '') : '';

          const img = card.querySelector('img');
          const image = img?.src || img?.getAttribute('data-src') || '';

          // Extract brand if visible
          const brandEl = card.querySelector('[class*="brand"], [class*="Brand"]');
          const brand = brandEl?.textContent?.trim() || '';

          // ID from URL
          const idMatch = href.match(/\/([^/]+)$/);
          const id = idMatch ? idMatch[1] : href.split('/').pop();

          if (title && title.length > 2) {
            items.push({ id, title, price, image, brand, url: fullUrl, categoryPath: catPath });
          }
        }

        // Check for next page link
        const nextLink = document.querySelector('a[aria-label="Next"], a[rel="next"], [class*="next"] a, [class*="pagination"] a:last-child');
        const nextHref = nextLink?.getAttribute('href');
        const nextUrl = nextHref && !nextHref.includes('javascript') ? nextHref : null;

        return { items, nextUrl };
      }, categoryPath);

      for (const p of pageProducts.items) {
        if (!products.some(existing => existing.id === p.id)) {
          products.push(p);
        }
      }

      // Follow pagination (but cap at 20 pages per category to avoid infinite loops)
      if (pageProducts.nextUrl && pageNum < 20) {
        currentUrl = pageProducts.nextUrl.startsWith('http')
          ? pageProducts.nextUrl
          : `https://www.scheels.com${pageProducts.nextUrl}`;
        await new Promise(r => setTimeout(r, 500));
      } else {
        currentUrl = null;
      }
    }

    return products;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 3000));
      return scrapeCategory(page, categoryUrl, retries - 1);
    }
    return products;
  }
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const scheelsEntry = marketplace.find(e => e.name === 'Scheels All Sports');
  if (!scheelsEntry) {
    console.error('Scheels All Sports not found in marketplace.json');
    process.exit(1);
  }

  const products = new Map();
  const completedCategories = new Set();

  if ((RESUME || MERGE_ONLY) && existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) products.set(p.id, p);
    for (const u of (cp.completedCategories || [])) completedCategories.add(u);
    console.log(`Loaded checkpoint: ${products.size} products, ${completedCategories.size} categories completed`);
    if (MERGE_ONLY) {
      mergeIntoProductsJson(products, scheelsEntry);
      return;
    }
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const mainPage = await solveCloudflareThenGetPage(browser);
    const allCategoryUrls = await fetchCategoryUrls(mainPage);
    await mainPage.close();

    const todoCategories = allCategoryUrls.filter(u => !completedCategories.has(u));
    console.log(`Categories to scrape: ${todoCategories.length} (${completedCategories.size} already done)\n`);

    // Create worker tabs
    const tabs = [];
    for (let i = 0; i < PARALLEL_TABS; i++) {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if (['image', 'font', 'media'].includes(type)) req.abort();
        else req.continue();
      });
      tabs.push(page);
    }

    let processed = 0;
    let totalNewProducts = 0;
    const startTime = Date.now();

    for (let i = 0; i < todoCategories.length; i += PARALLEL_TABS) {
      const batch = todoCategories.slice(i, i + PARALLEL_TABS);
      const results = await Promise.all(
        batch.map((url, idx) => scrapeCategory(tabs[idx], url))
      );

      for (let j = 0; j < results.length; j++) {
        const categoryProducts = results[j];
        const url = batch[j];
        completedCategories.add(url);
        processed++;

        let newInCategory = 0;
        for (const p of categoryProducts) {
          if (!products.has(p.id)) {
            products.set(p.id, p);
            totalNewProducts++;
            newInCategory++;
          }
        }

        if (newInCategory > 0) {
          const catName = url.replace('https://www.scheels.com/c/', '');
          console.log(`  ${catName}: +${newInCategory} new (${categoryProducts.length} total in category)`);
        }
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (todoCategories.length - processed) / rate;
      const pct = ((processed / todoCategories.length) * 100).toFixed(1);
      process.stdout.write(
        `\r  ${processed}/${todoCategories.length} categories (${pct}%) | ` +
        `${products.size} unique products | ` +
        `${rate.toFixed(1)} cats/s | ~${Math.round(remaining / 60)}min left   \n`
      );

      if (processed % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(products, completedCategories);
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log('\n');
    saveCheckpoint(products, completedCategories);
    console.log(`Scrape complete: ${products.size} unique products from ${processed} categories`);

    for (const tab of tabs) await tab.close();
  } finally {
    await browser.close();
  }

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    return;
  }

  mergeIntoProductsJson(products, scheelsEntry);
}

/**
 * Enrich mode: load category checkpoint, visit each product page to get price
 * from JSON-LD. Much faster than scraping all 168K sitemap URLs since we only
 * visit the ~36K products we know exist from category scraping.
 */
async function enrichMain() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const scheelsEntry = marketplace.find(e => e.name === 'Scheels All Sports');
  if (!scheelsEntry) {
    console.error('Scheels All Sports not found in marketplace.json');
    process.exit(1);
  }

  if (!existsSync(CHECKPOINT_FILE)) {
    console.error('No category checkpoint found. Run without --enrich first.');
    process.exit(1);
  }

  const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  const products = new Map();
  for (const p of cp.products) products.set(p.id, p);
  console.log(`Loaded ${products.size} products from category checkpoint`);

  // Load enrich checkpoint if resuming
  const enrichedIds = new Set();
  if (RESUME && existsSync(ENRICH_CHECKPOINT_FILE)) {
    const ecp = JSON.parse(readFileSync(ENRICH_CHECKPOINT_FILE, 'utf8'));
    for (const p of ecp.products) {
      products.set(p.id, p);
      enrichedIds.add(p.id);
    }
    console.log(`Resumed: ${enrichedIds.size} already enriched`);
  }

  // Filter to products that still need prices
  const needsPrice = [...products.values()].filter(p => !p.price && !enrichedIds.has(p.id));
  console.log(`Products needing prices: ${needsPrice.length}\n`);

  if (needsPrice.length === 0) {
    console.log('All products enriched!');
    if (!DRY_RUN) mergeIntoProductsJson(products, scheelsEntry);
    return;
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const mainPage = await solveCloudflareThenGetPage(browser);
    await mainPage.close();

    // Create worker tabs
    const tabs = [];
    for (let i = 0; i < PARALLEL_TABS; i++) {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) req.abort();
        else req.continue();
      });
      tabs.push(page);
    }

    let processed = 0;
    let enriched = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = 0; i < needsPrice.length; i += PARALLEL_TABS) {
      const batch = needsPrice.slice(i, i + PARALLEL_TABS);
      const results = await Promise.all(
        batch.map((p, idx) => enrichProduct(tabs[idx], p))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const original = batch[j];
        processed++;

        if (result) {
          products.set(original.id, { ...original, ...result });
          enrichedIds.add(original.id);
          enriched++;
        } else {
          failed++;
        }
      }

      if (processed % 50 === 0 || i + PARALLEL_TABS >= needsPrice.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (needsPrice.length - processed) / rate;
        const pct = ((processed / needsPrice.length) * 100).toFixed(1);
        process.stdout.write(
          `\r  ${processed}/${needsPrice.length} (${pct}%) | ` +
          `${enriched} enriched, ${failed} failed | ` +
          `${rate.toFixed(1)}/s | ~${Math.round(remaining / 60)}min left   `
        );
      }

      if (processed % (CHECKPOINT_INTERVAL * 2) === 0) {
        writeFileSync(ENRICH_CHECKPOINT_FILE, JSON.stringify({
          products: [...products.values()].filter(p => p.price),
          timestamp: new Date().toISOString(),
        }));
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log('\n');

    // Save final enrich checkpoint
    writeFileSync(ENRICH_CHECKPOINT_FILE, JSON.stringify({
      products: [...products.values()].filter(p => p.price),
      timestamp: new Date().toISOString(),
    }));

    const withPrice = [...products.values()].filter(p => p.price).length;
    console.log(`Enrich complete: ${withPrice} products with prices (${enriched} new this run)`);

    for (const tab of tabs) await tab.close();
  } finally {
    await browser.close();
  }

  if (DRY_RUN) {
    console.log('Dry run — not writing to products.json');
    return;
  }

  mergeIntoProductsJson(products, scheelsEntry);
}

async function enrichProduct(page, product, retries = 2) {
  try {
    // Clean URL — remove queryID params
    const cleanUrl = product.url.split('?')[0];
    await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    const data = await page.evaluate(() => {
      const ldScripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      for (const script of ldScripts) {
        try {
          const d = JSON.parse(script.textContent);
          if (d['@type'] === 'ProductGroup' || d['@type'] === 'Product') {
            const price = d.offers?.price ?? d.hasVariant?.[0]?.offers?.price ??
              d.hasVariant?.[0]?.offers?.[0]?.price;
            const availability = d.offers?.availability ?? d.hasVariant?.[0]?.offers?.availability ??
              d.hasVariant?.[0]?.offers?.[0]?.availability ?? '';
            const inStock = availability.includes('InStock') ||
              (d.hasVariant || []).some(v => {
                const a = v.offers?.availability ?? v.offers?.[0]?.availability ?? '';
                return a.includes('InStock');
              });
            const brand = d.brand?.name || '';
            const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
            const image = ogImage && !ogImage.includes('favicon') ? ogImage : '';
            return { price: price ? String(price) : '', brand, image, inStock };
          }
        } catch {}
      }
      return null;
    });

    if (!data || !data.price || !data.inStock) return null;
    return { price: data.price, brand: data.brand || product.brand, image: data.image || product.image };
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return enrichProduct(page, product, retries - 1);
    }
    return null;
  }
}

function mergeIntoProductsJson(products, scheelsEntry) {
  const scheelsProducts = [...products.values()]
    .filter(p => p.title && p.price)
    .map(p => ({
      id: `166-scheels-${p.id}`,
      title: p.title,
      price: p.price,
      available: true,
      image: p.image || '',
      url: p.url.split('?')[0],
      store_name: scheelsEntry.name,
      store_url: scheelsEntry.url,
      ownership_type: scheelsEntry.ownership_type,
      site_section: inferSection(p.categoryPath || '', p.title || ''),
      tags: [p.brand, p.categoryPath].filter(Boolean).map(t => t.toLowerCase().replace(/-/g, ' ')),
    }));

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonScheels = existing.filter(p => p.store_name !== 'Scheels All Sports');
  const final = [...nonScheels, ...scheelsProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${scheelsProducts.length} Scheels from this scrape)`);
  console.log(`  (${nonScheels.length} other stores)`);
}

/**
 * Enrich-details mode: visit each Scheels product page to extract color, size,
 * and other attributes from the Next.js RSC payload. Works from existing
 * products.json so we don't need the category checkpoint.
 */
async function enrichDetailsMain() {
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const scheelsProducts = existing.filter(p => p.store_name === 'Scheels All Sports');
  const nonScheels = existing.filter(p => p.store_name !== 'Scheels All Sports');
  console.log(`Loaded ${scheelsProducts.length} Scheels products from products.json`);

  // Load checkpoint if resuming
  const enrichedMap = new Map(); // id -> { color, ageGroup, ... }
  if (existsSync(DETAILS_CHECKPOINT_FILE)) {
    const cp = JSON.parse(readFileSync(DETAILS_CHECKPOINT_FILE, 'utf8'));
    for (const [id, details] of Object.entries(cp.details || {})) {
      enrichedMap.set(id, details);
    }
    console.log(`Resumed: ${enrichedMap.size} already enriched from checkpoint`);
  }

  const needsDetails = scheelsProducts.filter(p => !enrichedMap.has(p.id));
  console.log(`Products needing details: ${needsDetails.length}\n`);

  if (needsDetails.length === 0) {
    console.log('All products enriched!');
    applyDetailsAndSave(scheelsProducts, nonScheels, enrichedMap);
    return;
  }

  if (DRY_RUN) {
    console.log('Dry run — would enrich', needsDetails.length, 'products');
    return;
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const mainPage = await solveCloudflareThenGetPage(browser);
    await mainPage.close();

    const tabs = [];
    for (let i = 0; i < PARALLEL_TABS; i++) {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) req.abort();
        else req.continue();
      });
      tabs.push(page);
    }
    console.log(`Created ${tabs.length} worker tabs, warming up...`);

    // Warm up — navigate tab[0] to verify Cloudflare cookies work
    const testUrl = needsDetails[0].url.split('?')[0];
    await tabs[0].goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));
    const testTitle = await tabs[0].title();
    console.log(`Warmup: ${testTitle.slice(0, 60)}`);
    if (testTitle === 'Just a moment...') {
      console.log('Cloudflare blocking tabs — waiting...');
      for (let w = 0; w < 30; w++) {
        await new Promise(r => setTimeout(r, 2000));
        const t = await tabs[0].title();
        if (t !== 'Just a moment...') { console.log(`Cleared after ${(w+1)*2}s`); break; }
      }
    }

    let processed = 0;
    let enriched = 0;
    let failed = 0;
    let consecutiveFails = 0;
    const startTime = Date.now();

    for (let i = 0; i < needsDetails.length; i += PARALLEL_TABS) {
      // If too many consecutive failures, re-solve Cloudflare with fresh tabs
      if (consecutiveFails >= 30) {
        console.log('  [re-solving Cloudflare — closing old tabs, opening fresh...]');
        // Save checkpoint before re-solve attempt
        saveDetailsCheckpoint(enrichedMap);
        try {
          // Close old tabs
          for (const tab of tabs) { try { await tab.close(); } catch {} }
          tabs.length = 0;

          // Open a fresh page and solve CF
          const freshPage = await browser.newPage();
          await freshPage.setUserAgent(USER_AGENT);
          await freshPage.goto('https://www.scheels.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
          for (let w = 0; w < 30; w++) {
            await new Promise(r => setTimeout(r, 2000));
            const title = await freshPage.title();
            if (title !== 'Just a moment...') {
              console.log(`  [Cloudflare re-cleared after ${(w+1)*2}s]`);
              break;
            }
          }
          await freshPage.close();

          // Create fresh worker tabs (cookies are shared at browser level)
          for (let t = 0; t < PARALLEL_TABS; t++) {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.setRequestInterception(true);
            page.on('request', req => {
              const type = req.resourceType();
              if (['image', 'font', 'media', 'stylesheet'].includes(type)) req.abort();
              else req.continue();
            });
            tabs.push(page);
          }
          console.log(`  [Created ${tabs.length} fresh tabs]`);
        } catch (e) {
          console.log('  [CF re-solve error:', e.message.slice(0, 80), ']');
          // If browser is totally dead, bail out
          if (e.message.includes('Connection closed') || e.message.includes('Target closed')) {
            console.log('  [Browser died — saving checkpoint and exiting]');
            saveDetailsCheckpoint(enrichedMap);
            process.exit(1);
          }
        }
        consecutiveFails = 0;
        await new Promise(r => setTimeout(r, 5000));
      }

      const batch = needsDetails.slice(i, i + PARALLEL_TABS);
      const results = await Promise.all(
        batch.map((p, idx) => extractProductDetails(tabs[idx], p))
      );

      let batchSuccess = 0;
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const product = batch[j];
        processed++;

        if (result) {
          enrichedMap.set(product.id, result);
          enriched++;
          batchSuccess++;
        } else {
          // Mark as attempted with empty result so we don't retry
          enrichedMap.set(product.id, {});
          failed++;
        }
      }

      if (batchSuccess > 0) consecutiveFails = 0;
      else consecutiveFails += batch.length;

      // Progress display — every 10 for single-tab mode
      if (processed % 10 === 0 || i + PARALLEL_TABS >= needsDetails.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (needsDetails.length - processed) / rate;
        const pct = ((processed / needsDetails.length) * 100).toFixed(1);
        console.log(
          `  ${processed}/${needsDetails.length} (${pct}%) | ` +
          `${enriched} enriched, ${failed} failed | ` +
          `${rate.toFixed(1)}/s | ~${Math.round(remaining / 60)}min left`
        );
      }

      // Checkpoint every 100 products
      if (processed % 100 === 0) {
        saveDetailsCheckpoint(enrichedMap);
      }

      const jitter = Math.floor(Math.random() * 1000);
      await new Promise(r => setTimeout(r, DELAY_MS + jitter));
    }

    console.log('\n');
    saveDetailsCheckpoint(enrichedMap);

    const withColor = [...enrichedMap.values()].filter(d => d.color).length;
    console.log(`Detail enrich complete: ${withColor} products with color data (${enriched} enriched this run, ${failed} failed)`);

    for (const tab of tabs) await tab.close();
  } finally {
    await browser.close();
  }

  applyDetailsAndSave(scheelsProducts, nonScheels, enrichedMap);
}

function saveDetailsCheckpoint(enrichedMap) {
  const details = {};
  for (const [id, d] of enrichedMap) details[id] = d;
  writeFileSync(DETAILS_CHECKPOINT_FILE, JSON.stringify({
    details,
    count: enrichedMap.size,
    timestamp: new Date().toISOString(),
  }));
  console.log(`\n  [checkpoint saved: ${enrichedMap.size} products]`);
}

async function extractProductDetails(page, product, retries = 2) {
  try {
    const cleanUrl = product.url.split('?')[0];
    await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));

    const data = await page.evaluate((Q) => {
      // RSC payload uses escaped quotes. The actual textContent has \\\" as the
      // quote delimiter. We pass Q='\\\"' from Node to avoid escaping confusion.
      function extract(text, key) {
        const marker = key + Q + ':' + Q;
        const idx = text.indexOf(marker);
        if (idx === -1) return '';
        const start = idx + marker.length;
        const end = text.indexOf(Q, start);
        return end === -1 ? '' : text.slice(start, end);
      }
      function extractArray(text, key) {
        const marker = key + Q + ':[' + Q;
        const idx = text.indexOf(marker);
        if (idx === -1) return '';
        const start = idx + marker.length;
        const end = text.indexOf(Q, start);
        return end === -1 ? '' : text.slice(start, end);
      }
      function extractNum(text, key) {
        const marker = key + Q + ':';
        const idx = text.indexOf(marker);
        if (idx === -1) return '';
        const start = idx + marker.length;
        const numMatch = text.slice(start, start + 20).match(/^(\d+\.?\d*)/);
        return numMatch ? numMatch[1] : '';
      }

      const scripts = [...document.querySelectorAll('script')];
      for (const s of scripts) {
        const t = s.textContent || '';
        if (!t.includes('self.__next_f.push') || !t.includes('definingAttributes')) continue;

        // Color: skip label entries (\"color\":\"Color\"), find one with ::
        let color = '';
        const colorPattern = 'color' + Q + ':' + Q;
        let colorIdx = t.indexOf(colorPattern);
        while (colorIdx !== -1) {
          const cStart = colorIdx + colorPattern.length;
          const cEnd = t.indexOf(Q, cStart);
          if (cEnd !== -1) {
            const val = t.slice(cStart, cEnd);
            if (val.includes('::')) { color = val.split('::')[1]; break; }
          }
          colorIdx = t.indexOf(colorPattern, colorIdx + 1);
        }

        const ageGroup = extractArray(t, 'ageGroup');
        const gender = extractArray(t, 'gender');

        // Width: same :: pattern as color
        let width = '';
        const widthPattern = 'width' + Q + ':' + Q;
        let widthIdx = t.indexOf(widthPattern);
        while (widthIdx !== -1) {
          const wStart = widthIdx + widthPattern.length;
          const wEnd = t.indexOf(Q, wStart);
          if (wEnd !== -1) {
            const val = t.slice(wStart, wEnd);
            if (val.includes('::')) { width = val.split('::')[1]; break; }
          }
          widthIdx = t.indexOf(widthPattern, widthIdx + 1);
        }

        const brand = extract(t, 'brand');

        // Price: discountedPrice centAmount preferred, else price centAmount (cents)
        const discountIdx = t.indexOf('discountedPrice');
        const priceIdx = t.indexOf(Q + 'price' + Q + ':{');
        let centAmount = '';
        if (discountIdx !== -1) {
          centAmount = extractNum(t.slice(discountIdx), 'centAmount');
        } else if (priceIdx !== -1) {
          centAmount = extractNum(t.slice(priceIdx), 'centAmount');
        }
        const price = centAmount ? String(parseInt(centAmount) / 100) : '';

        const inStock = t.includes(Q + 'isOnStock' + Q + ':true') ? true :
                        t.includes(Q + 'isOnStock' + Q + ':false') ? false : null;

        if (color || ageGroup || gender || brand) {
          return { color, ageGroup, width, gender, brand, price, inStock };
        }
      }
      return null;
    }, '\\"');

    return data;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return extractProductDetails(page, product, retries - 1);
    }
    return null;
  }
}

function applyDetailsAndSave(scheelsProducts, nonScheels, enrichedMap) {
  let colorCount = 0;
  const updated = scheelsProducts.map(p => {
    const details = enrichedMap.get(p.id);
    if (!details || !details.color) return p;

    colorCount++;
    // Parse color — e.g. "Black/Black/Anthracite/Mtlc Dark Grey" → dedupe
    const colorParts = [...new Set(details.color.split('/').map(c => c.trim()))];
    const colorTag = colorParts.join('/');

    // Build enriched tags
    const existingTags = p.tags || [];
    const newTags = [...existingTags];
    if (colorTag) newTags.push(colorTag.toLowerCase());
    if (details.gender) newTags.push(details.gender.toLowerCase());
    if (details.ageGroup && details.ageGroup !== 'Adult') newTags.push(details.ageGroup.toLowerCase());

    // Update brand if we got a better one
    const brand = details.brand || '';
    if (brand && !existingTags.some(t => t.toLowerCase() === brand.toLowerCase())) {
      newTags[0] = brand.toLowerCase(); // replace first tag (brand position)
    }

    // Update price if we got one and product doesn't have one
    const price = details.price && (!p.price || p.price === '') ? details.price : p.price;

    // Update availability
    const available = details.inStock === false ? false : p.available;

    return { ...p, tags: newTags, price, available };
  });

  const final = [...nonScheels, ...updated];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  ${colorCount} Scheels products enriched with color/attributes`);
  console.log(`  ${nonScheels.length} other store products unchanged`);
}

(ENRICH_DETAILS ? enrichDetailsMain() : ENRICH ? enrichMain() : main()).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

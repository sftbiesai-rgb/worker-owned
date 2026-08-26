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
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/scheels-scrape-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');

const PARALLEL_TABS = 5;
const DELAY_MS = 500;
const CHECKPOINT_INTERVAL = 50;
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

function mergeIntoProductsJson(products, scheelsEntry) {
  const scheelsProducts = [...products.values()]
    .filter(p => p.title && p.price)
    .map(p => ({
      id: `166-scheels-${p.id}`,
      title: p.title,
      price: p.price,
      available: true,
      image: p.image || '',
      url: p.url,
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

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

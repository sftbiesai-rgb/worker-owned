#!/usr/bin/env node
/**
 * scheels-api-search.mjs
 * Scrape Scheels via their Typesense search API called from within puppeteer.
 * One browser tab, no product page visits needed — gets title, brand, price, images.
 *
 * Usage:
 *   node scripts/scheels-api-search.mjs              # full scrape + merge
 *   node scripts/scheels-api-search.mjs --dry-run    # show counts without writing
 *   node scripts/scheels-api-search.mjs --resume     # resume from checkpoint
 *   node scripts/scheels-api-search.mjs --merge-only # merge checkpoint into products.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const CHECKPOINT_FILE = '/tmp/scheels-api-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const MERGE_ONLY = process.argv.includes('--merge-only');

const PAGE_SIZE = 50;  // API caps at 50 for pages beyond 1
const DELAY_MS = 300;
const CHECKPOINT_INTERVAL = 50; // pages
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
  'pet': 'Home Goods', 'food': 'Food & Pantry', 'candy': 'Food & Pantry', 'snacks': 'Food & Pantry',
};

function inferSection(categoryPath, title) {
  const text = [categoryPath, title].join(' ').toLowerCase();
  for (const [keyword, section] of Object.entries(BREADCRUMB_TO_SECTION)) {
    if (text.includes(keyword)) return section;
  }
  return 'Sporting Goods';
}

function buildImageUrl(imageCode) {
  if (!imageCode) return '';
  // Amplience CDN — open access, supports resizing
  return `https://cdn.media.amplience.net/i/scheelspoc/${imageCode}?w=400&fmt=webp`;
}

function buildProductUrl(objectID) {
  // objectID format like "5022-T0240717" — product URL uses /p/{objectID}
  return `https://www.scheels.com/p/${objectID}`;
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const scheelsEntry = marketplace.find(e => e.name === 'Scheels All Sports');
  if (!scheelsEntry) {
    console.error('Scheels All Sports not found in marketplace.json');
    process.exit(1);
  }

  const products = new Map();
  let completedCategories = new Set();

  if ((RESUME || MERGE_ONLY) && existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) products.set(p.objectID, p);
    for (const c of (cp.completedCategories || [])) completedCategories.add(c);
    console.log(`Loaded checkpoint: ${products.size} products, ${completedCategories.size} categories done`);
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
    protocolTimeout: 120000,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // Solve Cloudflare
    console.log('Solving Cloudflare...');
    await page.goto('https://www.scheels.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const content = await page.content();
      if (!content.includes('Just a moment')) {
        console.log(`Cloudflare cleared after ${i + 1}s\n`);
        break;
      }
      if (i === 29) throw new Error('Cloudflare did not clear');
    }

    // Helper: fetch one page from the search API
    async function fetchSearchPage(pageNum, facetFilter) {
      return page.evaluate(async (pNum, pSize, filter) => {
        try {
          const query = {
            indexName: 'commercetools_products',
            page: pNum,
            pageSize: pSize,
            filters: 'inStock:true'
          };
          if (filter) query.facetFilters = [[filter]];
          const resp = await fetch('https://search.scheels.com/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: [query] })
          });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const data = await resp.json();
          const r = data.results?.[0];
          if (!r) return { error: 'No results' };
          return {
            hits: (r.hits || []).map(h => {
              const d = h.data || {};
              const attrs = d.attributes || {};
              const vAttrs = d.variants?.[0]?.attributes || {};
              return {
                objectID: d.objectID || h.id,
                title: d.title || '',
                brand: d.brand || '',
                price: d.pricing?.minRetail || d.pricing?.maxRetail || null,
                salePrice: d.pricing?.groups?.default?.onSale ? (d.pricing?.groups?.default?.minSale || null) : null,
                image: d.variants?.[0]?.images?.[0] || '',
                categories: d.categoryHierarchy || {},
                color: attrs.color?.[0] || vAttrs.color?.[0] || '',
                refinementColor: attrs.refinementColor?.[0] || vAttrs.refinementColor?.[0] || '',
                gender: attrs.gender?.[0] || vAttrs.gender?.[0] || '',
                sport: attrs.sport?.[0] || '',
                activity: attrs.activity?.[0] || '',
                productType: d.productType || '',
                description: (d.description || '').slice(0, 200),
              };
            }),
            totalHits: r.totalHits,
          };
        } catch (e) { return { error: e.message }; }
      }, pageNum, PAGE_SIZE, facetFilter);
    }

    // Helper: paginate through a query (up to 200 pages / 10K products)
    async function paginateQuery(label, facetFilter) {
      let newCount = 0;
      let emptyPages = 0;

      for (let pageNum = 1; pageNum <= 200; pageNum++) {
        let result = await fetchSearchPage(pageNum, facetFilter);

        if (result.error) {
          if (result.error.includes('400')) break;
          await new Promise(r => setTimeout(r, 2000));
          result = await fetchSearchPage(pageNum, facetFilter);
          if (result.error) break;
        }

        if (!result.hits || result.hits.length === 0) {
          emptyPages++;
          if (emptyPages >= 10) break; // API has intermittent empty pages, tolerate gaps
          continue;
        }
        emptyPages = 0;

        for (const hit of result.hits) {
          if (hit.title && !products.has(hit.objectID)) {
            products.set(hit.objectID, hit);
            newCount++;
          }
        }

        if (pageNum === 1 && result.totalHits) {
          const pages = Math.min(Math.ceil(result.totalHits / PAGE_SIZE), 200);
          process.stdout.write(`  ${label}: ${result.totalHits} total, ~${pages} pages... `);
        }

        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      return newCount;
    }

    const startTime = Date.now();

    // Phase 1: Unfiltered query — gets first ~10K products
    if (!completedCategories.has('__unfiltered__')) {
      console.log('Phase 1: Unfiltered query (first ~10K products)...');
      const n = await paginateQuery('unfiltered', null);
      console.log(`+${n} new (${products.size} total)`);
      completedCategories.add('__unfiltered__');

      writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        products: [...products.values()],
        completedCategories: [...completedCategories],
        timestamp: new Date().toISOString(),
      }));
    }

    // Phase 2: Discover all categories2 values from products we have so far
    const cats2 = new Set();
    for (const p of products.values()) {
      for (const v of (p.categories?.categories2 || [])) cats2.add(v);
    }
    console.log(`\nPhase 2: Query by ${cats2.size} categories2 values...`);

    let catsDone = 0;
    for (const catName of [...cats2].sort()) {
      if (completedCategories.has(catName)) {
        catsDone++;
        continue;
      }

      const filter = `categoryHierarchy.categories2:${catName}`;
      const n = await paginateQuery(catName.replace('All > ', ''), filter);
      completedCategories.add(catName);
      catsDone++;

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`+${n} new (${products.size} total) [${catsDone}/${cats2.size}] ${elapsed.toFixed(0)}s`);

      if (catsDone % 3 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          products: [...products.values()],
          completedCategories: [...completedCategories],
          timestamp: new Date().toISOString(),
        }));
      }
    }

    // Phase 3: For any category2 with >10K products, drill into categories3
    console.log('\nPhase 3: Checking for large categories needing deeper drilling...');
    const cats3 = new Set();
    for (const p of products.values()) {
      for (const v of (p.categories?.categories3 || [])) cats3.add(v);
    }

    for (const catName of [...cats3].sort()) {
      if (completedCategories.has(`c3:${catName}`)) continue;

      const filter = `categoryHierarchy.categories3:${catName}`;
      const n = await paginateQuery(catName.replace(/All > .+ > /, ''), filter);
      completedCategories.add(`c3:${catName}`);

      if (n > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`+${n} new (${products.size} total) ${elapsed.toFixed(0)}s`);
      }

      if (cats3.size > 50 && [...completedCategories].filter(c => c.startsWith('c3:')).length % 10 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          products: [...products.values()],
          completedCategories: [...completedCategories],
          timestamp: new Date().toISOString(),
        }));
      }
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      products: [...products.values()],
      completedCategories: [...completedCategories],
      timestamp: new Date().toISOString(),
    }));

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`\nScrape complete: ${products.size} unique products with prices in ${(elapsed/60).toFixed(1)} minutes`);
    await page.close();
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
    .map(p => {
      // Build category path from hierarchy
      const cats = p.categories || {};
      const deepest = cats.categories5?.[0] || cats.categories4?.[0] || cats.categories3?.[0] || '';
      const categoryPath = deepest.replace(/^All > /, '');

      const tags = [p.brand, categoryPath].filter(Boolean).map(t => t.toLowerCase().replace(/-/g, ' '));

      // Add color
      if (p.color) {
        const colorClean = p.color.includes('::') ? p.color.split('::')[1] : p.color;
        tags.push(colorClean.toLowerCase());
      }

      // Add gender, sport, activity, productType
      if (p.gender) tags.push(p.gender.toLowerCase());
      if (p.sport) tags.push(p.sport.toLowerCase());
      if (p.activity) tags.push(p.activity.toLowerCase());
      if (p.productType) tags.push(p.productType.toLowerCase());

      return {
        id: `166-scheels-${p.objectID}`,
        title: p.title,
        price: String(p.salePrice || p.price),
        available: true,
        image: buildImageUrl(p.image),
        url: buildProductUrl(p.objectID),
        store_name: scheelsEntry.name,
        store_url: scheelsEntry.url,
        ownership_type: scheelsEntry.ownership_type,
        site_section: inferSection(categoryPath, p.title),
        tags,
      };
    });

  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonScheels = existing.filter(p => p.store_name !== 'Scheels All Sports');
  const final = [...nonScheels, ...scheelsProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));

  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${scheelsProducts.length} Scheels with prices)`);
  console.log(`  (${nonScheels.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

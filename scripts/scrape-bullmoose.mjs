#!/usr/bin/env node
/**
 * scrape-bullmoose.mjs
 * Custom scraper for Bull Moose (FieldStack Omni platform).
 *
 * Bull Moose uses a proprietary FieldStack platform that renders products
 * client-side via AJAX. The flow:
 *   1. Load a category page to get a session cookie + SearchId
 *   2. Hit /gsrp/{page} with X-Search-Guid header to get product HTML
 *   3. Parse product cards for title, price, image, URL
 *
 * Usage:
 *   node scripts/scrape-bullmoose.mjs              # scrape and merge into products.json
 *   node scripts/scrape-bullmoose.mjs --dry-run    # show counts without writing
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://www.bullmoose.com';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 300;

// Categories to scrape — picked to cover the full catalog with minimal overlap.
// Each category is capped at ~1000 results by FieldStack, so we use genre-level
// categories rather than top-level ones.
const CATEGORIES = [
  // Music (vinyl, CDs, cassettes)
  { id: '469', slug: 'rock-pop', tag: 'music' },
  { id: '470', slug: 'rap-hip-hop', tag: 'music' },
  { id: '471', slug: 'country', tag: 'music' },
  { id: '472', slug: 'jazz', tag: 'music' },
  { id: '599', slug: 'k-pop', tag: 'music' },
  { id: '770', slug: 'heavy-metal', tag: 'music' },
  { id: '771', slug: 'blues', tag: 'music' },
  { id: '598', slug: 'vaporwave', tag: 'music' },
  { id: '597', slug: 'bull-moose-exclusive-vinyl', tag: 'music' },
  { id: '663', slug: 'local-music', tag: 'music' },
  { id: '527', slug: 'in-case-you-missed-it', tag: 'music' },

  // Movies & TV
  { id: '292', slug: 'television-series', tag: 'movies' },
  { id: '334', slug: 'horror-films', tag: 'movies' },
  { id: '335', slug: 'comedy-movies', tag: 'movies' },
  { id: '548', slug: 'drama', tag: 'movies' },
  { id: '546', slug: 'foreign', tag: 'movies' },
  { id: '542', slug: 'documentary', tag: 'movies' },
  { id: '537', slug: 'anime', tag: 'movies' },
  { id: '333', slug: 'family-friendly-movies', tag: 'movies' },
  { id: '545', slug: 'western-films', tag: 'movies' },
  { id: '549', slug: 'movies-criterion', tag: 'movies' },

  // Video Games
  { id: '209', slug: 'nintendo-switch-games', tag: 'video games' },
  { id: '760', slug: 'playstation-5-games', tag: 'video games' },
  { id: '762', slug: 'xbox-series-xs-games', tag: 'video games' },
  { id: '222', slug: 'playstation-4-games', tag: 'video games' },
  { id: '842', slug: 'nintendo-switch-2-games', tag: 'video games' },

  // Books
  { id: '227', slug: 'graphic-novels', tag: 'books' },
  { id: '245', slug: 'fiction-literature', tag: 'books' },
  { id: '246', slug: 'nonfiction', tag: 'books' },
  { id: '401', slug: 'manga', tag: 'books' },
  { id: '228', slug: 'childrens-books', tag: 'books' },
  { id: '248', slug: 'young-adult', tag: 'books' },

  // Games & Collectibles
  { id: '230', slug: 'board-games-puzzles', tag: 'board games' },
  { id: '337', slug: 'magic-the-gathering', tag: 'trading cards' },
  { id: '339', slug: 'pokemon-tcg', tag: 'trading cards' },
  { id: '340', slug: 'yu-gi-oh-tcg', tag: 'trading cards' },

  // Merch
  { id: '651', slug: 'bullmoosemerch', tag: 'merch' },
];

// Map the primary category tag to the correct site_section for split-products.mjs
const TAG_TO_SECTION = {
  'music': 'Music',
  'movies': 'Media & Publishing',
  'video games': 'Games',
  'books': 'Media & Publishing',
  'board games': 'Games',
  'trading cards': 'Games',
  'merch': 'Apparel',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchCategory(cat) {
  // Step 1: Load category page for session cookie + SearchId
  const catUrl = `${BASE}/c/${cat.id}/${cat.slug}`;
  const catRes = await fetch(catUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!catRes.ok) {
    console.log(`  FAIL: ${catRes.status} loading ${catUrl}`);
    return [];
  }
  const catHtml = await catRes.text();
  const searchIdMatch = catHtml.match(/SearchId:\s*'([^']+)'/);
  if (!searchIdMatch) {
    console.log(`  FAIL: no SearchId found`);
    return [];
  }
  const searchId = searchIdMatch[1];

  // Extract cookies from response
  const cookies = catRes.headers.getSetCookie?.() ?? [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

  // Step 2: Paginate through /gsrp/ endpoint
  const products = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await fetch(`${BASE}/gsrp/${page}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'X-Search-Guid': searchId,
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookieStr,
      },
    });

    if (!res.ok) break;
    const data = await res.json();
    if (!data.success) break;

    totalPages = data.data.totalPages || 1;
    const html = data.data.data || '';

    // Parse product cards from HTML
    const parsed = parseProducts(html, cat.tag);
    products.push(...parsed);

    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  return products;
}

function parseProducts(html, categoryTag) {
  const products = [];

  // Split by product card boundaries
  const cards = html.split(/class="producttitlelink product-grid-variant"/);
  // First element is before the first card
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];

    // Extract URL and title from the link
    const linkMatch = card.match(/href="\/p\/(\d+)\/([^"]+)"\s+title="([^"]+)"/);
    if (!linkMatch) continue;
    const [, productId, slug, title] = linkMatch;

    // Extract image URL
    const imgMatch = card.match(/data-src="([^"]+)"/);
    const image = imgMatch
      ? (imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1])
      : null;

    // Extract price (use the itemprop="price" which has the clean number)
    const priceMatch = card.match(/itemprop="price">([^<]+)</);
    const price = priceMatch ? parseFloat(priceMatch[1]) : null;
    if (!price || price <= 0) continue;

    // Extract format (Audio CD, Vinyl, Blu-ray, etc.)
    const formatMatch = card.match(/class="see-more-format">\s*([^<]+)/);
    const format = formatMatch ? formatMatch[1].trim() : '';

    // Build tags from category and format
    const tags = [categoryTag];
    if (format) tags.push(format.toLowerCase());

    products.push({
      productId,
      title: decodeHtmlEntities(title),
      price: price.toFixed(2),
      image,
      url: `${BASE}/p/${productId}/${slug}`,
      format,
      tags,
    });
  }

  return products;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const bmEntry = marketplace.find(e => e.name === 'Bull Moose');
  if (!bmEntry) {
    console.error('Bull Moose not found in marketplace.json');
    process.exit(1);
  }

  console.log(`Scraping Bull Moose across ${CATEGORIES.length} categories...`);

  // Deduplicate by product ID across categories
  const byId = new Map();
  let totalFetched = 0;

  for (const cat of CATEGORIES) {
    process.stdout.write(`  ${cat.slug}... `);
    const products = await fetchCategory(cat);
    let newCount = 0;

    for (const p of products) {
      if (!byId.has(p.productId)) {
        byId.set(p.productId, p);
        newCount++;
      } else {
        // Merge tags from duplicate appearances
        const existing = byId.get(p.productId);
        for (const tag of p.tags) {
          if (!existing.tags.includes(tag)) existing.tags.push(tag);
        }
      }
    }

    totalFetched += products.length;
    console.log(`${products.length} fetched, ${newCount} new (${byId.size} unique total)`);
    await sleep(500); // Extra delay between categories
  }

  console.log(`\nTotal: ${totalFetched} fetched, ${byId.size} unique products`);

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    return;
  }

  // Format for products.json
  const bmProducts = [...byId.values()].map(p => ({
    id: `176-bm-${p.productId}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: bmEntry.name,
    store_url: bmEntry.url,
    ownership_type: bmEntry.ownership_type,
    site_section: TAG_TO_SECTION[p.tags[0]] || bmEntry.site_section,
    tags: p.tags,
  }));

  // Merge into existing products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  // Remove any old Bull Moose products
  const filtered = existing.filter(p => p.store_name !== 'Bull Moose');
  filtered.push(...bmProducts);

  writeFileSync(PRODUCTS_FILE, JSON.stringify(filtered, null, 2));
  console.log(`\nWrote ${filtered.length} total products to products.json`);
  console.log(`  (${bmProducts.length} Bull Moose + ${filtered.length - bmProducts.length} other stores)`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * scrape-zia.mjs
 * Custom scraper for Zia Records (FieldStack Omni platform).
 *
 * Zia uses the same FieldStack platform as Bull Moose, but their category
 * browse returns 0 results via AJAX (requires store selection). However,
 * the search endpoint works without a store. We use search queries to
 * crawl the catalog.
 *
 * Usage:
 *   node scripts/scrape-zia.mjs              # scrape and merge into products.json
 *   node scripts/scrape-zia.mjs --dry-run    # show counts without writing
 *   node scripts/scrape-zia.mjs --merge-only # merge existing checkpoint
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const MARKETPLACE_FILE = join(__dirname, '..', 'src', 'data', 'marketplace.json');
const BASE = 'https://www.ziarecords.com';
const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/zia-scrape-checkpoint.json';

const TAG_TO_SECTION = {
  'music': 'Music',
  'movies': 'Movies & TV',
  'video games': 'Games',
  'books': 'Books',
  'board games': 'Games',
  'trading cards': 'Games',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  (retry ${i + 1}/${retries} after ${err.code || err.message})`);
      await sleep(2000 * (i + 1));
    }
  }
}

// Search terms designed to cover the Zia catalog broadly.
// Single letters and common words cast a wide net.
const SEARCH_TERMS = [
  // Single letters — FieldStack returns results for any match
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  // Common words to catch remaining items
  'the', 'of', 'and', 'new', 'best', 'love', 'one', 'vol',
  // Music genres
  'rock', 'pop', 'jazz', 'blues', 'country', 'metal', 'punk', 'hip hop',
  'rap', 'soul', 'funk', 'reggae', 'classical', 'folk', 'indie',
  'electronic', 'techno', 'house', 'r&b', 'latin', 'world',
  // Movie genres
  'horror', 'comedy', 'drama', 'action', 'sci-fi', 'documentary',
  'thriller', 'anime', 'western', 'criterion', 'arrow',
  // Formats
  'vinyl', 'cd', 'cassette', 'blu-ray', 'dvd', '4k', 'book',
  // Popular artists/titles to catch stragglers
  'beatles', 'taylor swift', 'pink floyd', 'led zeppelin', 'nirvana',
  'radiohead', 'bowie', 'prince', 'queen', 'stones',
  'marvel', 'star wars', 'harry potter', 'lord of the rings',
];

async function fetchSearch(term) {
  const searchUrl = `${BASE}/search?q=${encodeURIComponent(term)}`;
  let res;
  try {
    res = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (err) {
    console.log(`  FAIL: ${err.code || err.message}`);
    failedTerms++;
    return [];
  }
  if (!res.ok) { failedTerms++; return []; }

  const html = await res.text();
  const searchId = html.match(/SearchId:\s*'([^']+)'/)?.[1];
  if (!searchId) {
    console.log(`  FAIL: no SearchId`);
    failedTerms++;
    return [];
  }

  const cookies = (res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const products = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    let r;
    try {
      r = await fetchWithRetry(`${BASE}/gsrp/${page}?q=${encodeURIComponent(term)}&so=0&page=${page}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Search-Guid': searchId,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookies,
        },
      });
    } catch (err) {
      console.log(`  (page ${page} failed: ${err.code || err.message})`);
      break;
    }

    if (!r.ok) break;
    const data = await r.json();
    if (!data.success) break;

    totalPages = data.data.totalPages || 1;
    const prodHtml = data.data.data || '';
    const parsed = parseProducts(prodHtml);
    products.push(...parsed);

    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  return products;
}

// Running tally of shipping-status decisions, printed at the end of the run.
// If skipped_no_span drops to ~0, the card HTML probably changed: investigate.
const avStats = { av10: 0, av11: 0, av12: 0, av21: 0, av40: 0, skipped_av30: 0, skipped_av50: 0, skipped_no_span: 0 };
let failedTerms = 0;

function parseProducts(html) {
  const products = [];
  const cards = html.split(/class="producttitlelink product-grid-variant"/);

  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];

    // URL: /p/{id}/{slug} (one edition) or /pid/{id}/{slug} (a title with
    // several editions). The two id spaces are different: /p/566105 and
    // /pid/566105 are different products, so keep the path type in the URL
    // and the id ("pid-" prefix) instead of rewriting everything to /p/.
    const linkMatch = card.match(/href="\/(p|pid)\/(\d+)\/([^"]+)"\s+title="([^"]+)"/);
    if (!linkMatch) continue;

    const pathType = linkMatch[1];
    const productId = pathType === 'pid' ? `pid-${linkMatch[2]}` : linkMatch[2];
    const slug = linkMatch[3];
    const title = linkMatch[4]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');

    // Same allowlist as scrape-bullmoose.mjs (same FieldStack card HTML): keep
    // only cards whose Shipping line shows In Stock (av10/av11), Limited
    // availability (av12), Special Order (av21), or Pre-order (av40). Items
    // that can't ship have NO Shipping line at all (pickup only), so a
    // missing span means skip.
    const shipCls = card.match(/Shipping[^<]*<span class="av\s+([^"]+)"/s)?.[1] || '';
    const keepMatch = shipCls.match(/av10|av11|av12|av21|av40/);
    if (!keepMatch) {
      if (shipCls.includes('av30')) avStats.skipped_av30++;
      else if (shipCls.includes('av50')) avStats.skipped_av50++;
      else avStats.skipped_no_span++;
      continue;
    }
    avStats[keepMatch[0]]++;

    // Price from itemprop="price"
    const priceMatch = card.match(/itemprop="price">([^<]+)</);
    const price = priceMatch ? priceMatch[1].trim() : null;

    // Image from data-src (lazy loaded)
    const imgMatch = card.match(/data-src="([^"]+)"/);
    let image = imgMatch ? imgMatch[1] : null;
    if (image && image.startsWith('//')) image = 'https:' + image;

    // Format from see-more-format
    const formatMatch = card.match(/class="see-more-format">\s*([^<]+)/);
    const format = formatMatch ? formatMatch[1].trim() : null;

    // Infer category from format
    let category = 'music'; // default
    if (format) {
      const f = format.toLowerCase();
      if (f.includes('dvd') || f.includes('blu-ray') || f.includes('4k ultra') || f.includes('vhs')) category = 'movies';
      else if (f.includes('game') || f.includes('playstation') || f.includes('nintendo') || f.includes('xbox')) category = 'video games';
      else if (f.includes('book') || f.includes('paperback') || f.includes('hardcover')) category = 'books';
      else if (f.includes('board game') || f.includes('puzzle')) category = 'board games';
      else if (f.includes('card game') || f.includes('tcg')) category = 'trading cards';
    }

    const tags = [category];
    if (format) tags.push(format);

    products.push({
      productId,
      title,
      price,
      image,
      url: `${BASE}/${pathType}/${linkMatch[2]}/${slug}`,
      tags,
      shipStatus: keepMatch[0],
    });
  }

  return products;
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const ziaEntry = marketplace.find(e => e.name === 'Zia Records');
  if (!ziaEntry) {
    console.error('Zia Records not found in marketplace.json');
    process.exit(1);
  }

  const byId = new Map();

  if (MERGE_ONLY) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    for (const p of cp.products) byId.set(p.productId, p);
    console.log(`Loaded checkpoint: ${byId.size} products`);
  } else {
    console.log(`Scraping Zia Records via ${SEARCH_TERMS.length} search terms...`);

    for (let i = 0; i < SEARCH_TERMS.length; i++) {
      const term = SEARCH_TERMS[i];
      process.stdout.write(`  [${i + 1}/${SEARCH_TERMS.length}] "${term}"... `);
      const products = await fetchSearch(term);
      let newCount = 0;

      for (const p of products) {
        if (!byId.has(p.productId)) {
          byId.set(p.productId, p);
          newCount++;
        } else {
          const existing = byId.get(p.productId);
          for (const tag of p.tags) {
            if (!existing.tags.includes(tag)) existing.tags.push(tag);
          }
        }
      }

      console.log(`${products.length} fetched, ${newCount} new (${byId.size} unique total)`);

      // Save checkpoint every 10 terms
      if ((i + 1) % 10 === 0) {
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products: [...byId.values()] }));
      }

      await sleep(1500);
    }

    // Final checkpoint
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ products: [...byId.values()] }));
  }

  console.log(`\nTotal: ${byId.size} unique products`);
  if (!MERGE_ONLY) {
    console.log(`Shipping-status audit: kept ${JSON.stringify({ av10: avStats.av10, av11: avStats.av11, av12: avStats.av12, av21: avStats.av21, av40: avStats.av40 })}`);
    console.log(`                    skipped ${JSON.stringify({ av30: avStats.skipped_av30, av50: avStats.skipped_av50, no_shipping_line: avStats.skipped_no_span })}`);
  }

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    return;
  }

  // Guardrails: the merge below replaces every Zia product, so a partial
  // scrape (blocked search, changed HTML) would gut the store
  if (failedTerms > 10 || byId.size < 2000) {
    console.error(`\nABORTING MERGE: scrape looks partial (${failedTerms} failed terms, ${byId.size} products).`);
    console.error(`Checkpoint preserved at ${CHECKPOINT_FILE}. Investigate, then re-run or use --merge-only.`);
    process.exit(1);
  }

  // Format for products.json
  const ziaProducts = [...byId.values()].map(p => ({
    id: `${ziaEntry.id}-zia-${p.productId}`,
    title: p.title,
    price: p.price,
    available: true,
    image: p.image,
    url: p.url,
    store_name: ziaEntry.name,
    store_url: ziaEntry.url,
    ownership_type: ziaEntry.ownership_type,
    site_section: TAG_TO_SECTION[p.tags[0]] || 'Music',
    tags: p.tags,
  }));

  // Merge into products.json
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonZia = existing.filter(p => p.store_name !== 'Zia Records');
  const final = [...nonZia, ...ziaProducts];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${ziaProducts.length} Zia Records from this scrape)`);
  console.log(`  (${nonZia.length} other stores)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

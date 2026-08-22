#!/usr/bin/env node
/**
 * validate-bullmoose.mjs
 * Checks our Bull Moose product data for gaps by verifying that known popular
 * products are present. Any missing items are searched on Bull Moose and added.
 *
 * Usage:
 *   node scripts/validate-bullmoose.mjs              # check and fill gaps
 *   node scripts/validate-bullmoose.mjs --check-only # just report gaps
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json');
const BASE = 'https://www.bullmoose.com';
const CHECK_ONLY = process.argv.includes('--check-only');
const DELAY_MS = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Must-have products: if Bull Moose sells it and we don't have it, that's a gap.
// Format: [search query, expected title substring]
// These are chosen to be evergreen popular titles across categories.
const MUST_HAVES = [
  // Books — bestselling series & authors
  ['hunger games suzanne collins', 'hunger games'],
  ['harry potter sorcerer stone', 'harry potter'],
  ['lord of the rings tolkien', 'lord of the rings'],
  ['game of thrones george martin', 'game of thrones'],
  ['percy jackson lightning thief', 'percy jackson'],
  ['diary wimpy kid', 'wimpy kid'],
  ['cat in the hat', 'cat in the hat'],
  ['where the wild things are', 'wild things'],
  ['very hungry caterpillar', 'hungry caterpillar'],
  ['goodnight moon', 'goodnight moon'],
  ['to kill a mockingbird', 'mockingbird'],
  ['1984 orwell', '1984'],
  ['great gatsby fitzgerald', 'great gatsby'],
  ['catcher in the rye', 'catcher in the rye'],
  ['little prince saint exupery', 'little prince'],
  ['hobbit tolkien', 'hobbit'],
  ['chronicles narnia', 'narnia'],
  ['dune herbert', 'dune'],
  ['enders game', 'ender'],
  ['hitchhikers guide galaxy', 'hitchhiker'],
  ['outlander gabaldon', 'outlander'],
  ['twilight stephenie meyer', 'twilight'],
  ['gone girl gillian flynn', 'gone girl'],
  ['the shining stephen king', 'shining'],
  ['it stephen king', 'stephen king'],
  ['educated tara westover', 'educated'],
  ['becoming michelle obama', 'becoming'],
  ['atomic habits james clear', 'atomic habits'],
  ['fourth wing yarros', 'fourth wing'],

  // Music — all-time bestselling albums
  ['thriller michael jackson', 'michael jackson'],
  ['dark side of the moon', 'dark side'],
  ['abbey road beatles', 'abbey road'],
  ['rumours fleetwood mac', 'rumours'],
  ['back in black ac dc', 'back in black'],
  ['hotel california eagles', 'hotel california'],
  ['nevermind nirvana', 'nevermind'],
  ['born to run springsteen', 'born to run'],
  ['purple rain prince', 'purple rain'],
  ['legend bob marley', 'bob marley'],
  ['kind of blue miles davis', 'kind of blue'],
  ['ok computer radiohead', 'ok computer'],
  ['in rainbows radiohead', 'in rainbows'],
  ['lemonade beyonce', 'beyonce'],
  ['folklore taylor swift', 'folklore'],
  ['midnights taylor swift', 'midnights'],

  // Movies — top grossing / iconic films
  ['godfather coppola', 'godfather'],
  ['shawshank redemption', 'shawshank'],
  ['star wars new hope', 'star wars'],
  ['empire strikes back', 'empire strikes'],
  ['back to the future', 'back to the future'],
  ['forrest gump', 'forrest gump'],
  ['jurassic park', 'jurassic park'],
  ['titanic cameron', 'titanic'],
  ['the matrix', 'matrix'],
  ['fight club', 'fight club'],
  ['pulp fiction', 'pulp fiction'],
  ['inception nolan', 'inception'],
  ['spirited away', 'spirited away'],
  ['princess mononoke', 'princess mononoke'],
  ['breaking bad complete', 'breaking bad'],
  ['the office complete', 'the office'],
  ['game of thrones complete', 'game of thrones'],

  // Games — bestselling of all time
  ['zelda tears kingdom', 'zelda'],
  ['zelda breath of the wild', 'breath of the wild'],
  ['mario odyssey', 'mario odyssey'],
  ['mario kart', 'mario kart'],
  ['pokemon scarlet', 'pokemon'],
  ['elden ring', 'elden ring'],
  ['god of war ragnarok', 'god of war'],
  ['spider-man ps5', 'spider-man'],
  ['animal crossing new horizons', 'animal crossing'],
  ['super smash bros ultimate', 'smash bros'],
  ['minecraft', 'minecraft'],
  ['call of duty', 'call of duty'],
  ['grand theft auto', 'grand theft'],
  ['last of us', 'last of us'],
  ['halo infinite', 'halo'],
];

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'");
}

function parseProducts(html) {
  const products = [];
  const cards = html.split(/class="producttitlelink product-grid-variant"/);
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    const linkMatch = card.match(/href="\/p\/(\d+)\/([^"]+)"\s+title="([^"]+)"/);
    if (!linkMatch) continue;
    const [, productId, slug, title] = linkMatch;
    // Check SHIPPING availability (not Curbside Pickup). Skip only if shipping
    // is Back-order (av30) or Out of Stock (av50).
    const shipMatch = card.match(/Shipping[^<]*<span class="av\s+([^"]+)"/s);
    if (shipMatch) {
      const cls = shipMatch[1];
      if (cls.includes('av30') || cls.includes('av50')) continue;
    }
    const imgMatch = card.match(/data-src="([^"]+)"/);
    let image = null;
    if (imgMatch && !imgMatch[1].includes('ArtNotAvailable')) {
      image = imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1];
    }
    const priceMatch = card.match(/itemprop="price">([^<]+)</);
    const price = priceMatch ? parseFloat(priceMatch[1]) : null;
    if (!price || price <= 0) continue;
    const formatMatch = card.match(/class="see-more-format">\s*([^<]+)/);
    const format = formatMatch ? formatMatch[1].trim() : '';
    products.push({ productId, title: decodeHtmlEntities(title), price: price.toFixed(2), image, url: `${BASE}/p/${productId}/${slug}`, format });
  }
  return products;
}

function inferTag(format) {
  const f = (format || '').toLowerCase();
  if (f.includes('vinyl') || f.includes('audio cd') || f.includes('cassette') || f.includes('sacd')) return 'music';
  if (f.includes('dvd') || f.includes('blu-ray') || f.includes('4k ultra') || f.includes('vhs')) return 'movies';
  if (f.includes('game') || f.includes('playstation') || f.includes('nintendo') || f.includes('xbox') || f.includes('sega')) return 'video games';
  if (f.includes('book') || f.includes('paperback') || f.includes('hardcover')) return 'books';
  if (f.includes('card game') || f.includes('tcg')) return 'trading cards';
  return 'books';
}

const TAG_TO_SECTION = {
  'music': 'Music', 'movies': 'Movies & TV', 'video games': 'Games',
  'books': 'Books', 'board games': 'Games', 'trading cards': 'Games', 'merch': 'Apparel',
};

async function searchBullMoose(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&so=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const sidMatch = html.match(/SearchId:\s*'([^']+)'/);
  if (!sidMatch) return [];

  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

  const products = [];
  let page = 1, totalPages = 1;
  while (page <= totalPages) {
    const r = await fetch(`${BASE}/gsrp/${page}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0', 'X-Search-Guid': sidMatch[1],
        'X-Requested-With': 'XMLHttpRequest', 'Cookie': cookieStr,
      },
    });
    if (!r.ok) break;
    const data = await r.json();
    if (!data.success) break;
    totalPages = data.data.totalPages || 1;
    products.push(...parseProducts(data.data.data || ''));
    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }
  return products;
}

async function main() {
  const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const bmProducts = products.filter(p => p.store_name === 'Bull Moose');
  const existingIds = new Set(bmProducts.map(p => p.id.replace('176-bm-', '')));
  const allTitles = bmProducts.map(p => p.title.toLowerCase());

  console.log(`Validating ${MUST_HAVES.length} must-have products against ${bmProducts.length} Bull Moose entries...\n`);

  const missing = [];
  const found = [];

  for (const [query, titleCheck] of MUST_HAVES) {
    const has = allTitles.some(t => t.includes(titleCheck.toLowerCase()));
    if (has) {
      found.push(query);
    } else {
      missing.push([query, titleCheck]);
    }
  }

  console.log(`✓ ${found.length} must-haves present`);
  console.log(`✗ ${missing.length} must-haves missing\n`);

  if (missing.length === 0) {
    console.log('All must-have products accounted for!');
    return;
  }

  console.log('Missing:');
  for (const [query] of missing) {
    console.log(`  - ${query}`);
  }

  if (CHECK_ONLY) {
    console.log('\n--check-only mode, not searching for missing items.');
    return;
  }

  // Search for missing items and add them
  console.log(`\nSearching Bull Moose for ${missing.length} missing items...`);
  let added = 0;

  for (const [query, titleCheck] of missing) {
    process.stdout.write(`  "${query}"... `);
    const results = await searchBullMoose(query);
    let termNew = 0;

    for (const p of results) {
      if (!existingIds.has(p.productId)) {
        existingIds.add(p.productId);
        const tag = inferTag(p.format);
        products.push({
          id: `176-bm-${p.productId}`,
          title: p.title,
          price: p.price,
          available: true,
          image: p.image,
          url: p.url,
          store_name: 'Bull Moose',
          store_url: 'https://www.bullmoose.com',
          ownership_type: 'employee-owned',
          site_section: TAG_TO_SECTION[tag] || 'Books',
          tags: [tag, ...(p.format ? [p.format.toLowerCase()] : [])],
        });
        termNew++;
        added++;
      }
    }

    // Check if we found what we were looking for
    const nowHas = results.some(p => p.title.toLowerCase().includes(titleCheck.toLowerCase()));
    console.log(`${results.length} results, ${termNew} new${nowHas ? '' : ' (title not found on BM)'}`);
    await sleep(DELAY_MS);
  }

  if (added > 0) {
    writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    console.log(`\nAdded ${added} products. Total: ${products.length}`);
  } else {
    console.log('\nNo new products to add.');
  }

  // Re-check coverage
  const finalTitles = products.filter(p => p.store_name === 'Bull Moose').map(p => p.title.toLowerCase());
  const stillMissing = missing.filter(([, tc]) => !finalTitles.some(t => t.includes(tc.toLowerCase())));
  if (stillMissing.length > 0) {
    console.log(`\n⚠ ${stillMissing.length} items still missing (may not be sold by Bull Moose):`);
    for (const [query] of stillMissing) console.log(`  - ${query}`);
  } else {
    console.log('\n✓ All must-haves now covered!');
  }
}

main().catch(console.error);

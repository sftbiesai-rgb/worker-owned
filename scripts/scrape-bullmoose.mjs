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
const PILOT = process.argv.includes('--pilot');
const MERGE_ONLY = process.argv.includes('--merge-only');
const DELAY_MS = 800;
const CHECKPOINT_FILE = '/tmp/bm-scrape-raw.json';
const PILOT_FILE = '/tmp/bm-pilot.json';

// Small representative subset for --pilot runs (verify filter before full scrape)
const PILOT_CATEGORIES = [
  { id: '469', slug: 'rock-pop', tag: 'music' },
  { id: '209', slug: 'nintendo-switch-games', tag: 'video games' },
  { id: '245', slug: 'fiction-literature', tag: 'books' },
  { id: '301', slug: 'hot-pre-orders', tag: 'music' },
];
const PILOT_SEARCH_TERMS = ['taylor swift', 'zelda'];

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
  { id: '357', slug: 'upcoming-music', tag: 'music' },
  { id: '888', slug: 'rsd-2026', tag: 'music' },
  // Music — vinyl clearance genres
  { id: '706', slug: 'vinyl-clearance-rock-pop', tag: 'music' },
  { id: '696', slug: 'vinyl-clearance-metal-punk', tag: 'music' },
  { id: '697', slug: 'vinyl-clearance-electronic', tag: 'music' },
  { id: '698', slug: 'vinyl-clearance-jazz', tag: 'music' },
  { id: '699', slug: 'vinyl-clearance-country', tag: 'music' },
  { id: '700', slug: 'vinyl-clearance-rap', tag: 'music' },
  { id: '701', slug: 'vinyl-clearance-soundtracks', tag: 'music' },
  { id: '702', slug: 'vinyl-clearance-folk-blues', tag: 'music' },
  { id: '703', slug: 'vinyl-clearance-soul-rb', tag: 'music' },
  { id: '704', slug: 'vinyl-clearance-classical', tag: 'music' },
  { id: '694', slug: 'vinyl-clearance-intl', tag: 'music' },

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
  { id: '539', slug: 'music-on-video', tag: 'movies' },
  { id: '215', slug: 'arrow-films', tag: 'movies' },
  { id: '550', slug: 'movies-kino', tag: 'movies' },
  { id: '738', slug: 'studio-ghibli', tag: 'movies' },
  { id: '381', slug: 'new-movies', tag: 'movies' },

  // Video Games — current gen
  { id: '209', slug: 'nintendo-switch-games', tag: 'video games' },
  { id: '760', slug: 'playstation-5-games', tag: 'video games' },
  { id: '762', slug: 'xbox-series-xs-games', tag: 'video games' },
  { id: '222', slug: 'playstation-4-games', tag: 'video games' },
  { id: '842', slug: 'nintendo-switch-2-games', tag: 'video games' },
  { id: '219', slug: 'xbox-one-games', tag: 'video games' },
  // Video Games — retro
  { id: '257', slug: 'retrogames', tag: 'video games' },
  { id: '250', slug: 'playstation-3', tag: 'video games' },
  { id: '274', slug: 'playstation-2', tag: 'video games' },
  { id: '275', slug: 'playstation-1', tag: 'video games' },
  { id: '251', slug: 'xbox-360', tag: 'video games' },
  { id: '273', slug: 'xbox', tag: 'video games' },
  { id: '254', slug: 'wii-u', tag: 'video games' },
  { id: '253', slug: 'wii', tag: 'video games' },
  { id: '252', slug: 'nintendo-3ds', tag: 'video games' },
  { id: '256', slug: 'nintendo-ds', tag: 'video games' },
  { id: '277', slug: 'gamecube', tag: 'video games' },
  { id: '268', slug: 'nintendo-64', tag: 'video games' },
  { id: '278', slug: 'snes', tag: 'video games' },
  { id: '280', slug: 'gameboy-advance', tag: 'video games' },
  { id: '281', slug: 'gameboy-gbc', tag: 'video games' },
  { id: '279', slug: 'nes', tag: 'video games' },
  { id: '255', slug: 'playstation-vita', tag: 'video games' },
  { id: '276', slug: 'psp', tag: 'video games' },
  { id: '283', slug: 'sega-dreamcast', tag: 'video games' },
  { id: '285', slug: 'sega-saturn', tag: 'video games' },
  { id: '284', slug: 'sega-gamegear', tag: 'video games' },
  { id: '282', slug: 'sega-genesis-cd-32x', tag: 'video games' },
  { id: '286', slug: 'atari', tag: 'video games' },

  // Video Games — extra sort passes for categories near the 1000-item cap
  { id: '209', slug: 'nintendo-switch-games', tag: 'video games', sort: 1 },
  { id: '760', slug: 'playstation-5-games', tag: 'video games', sort: 1 },
  { id: '222', slug: 'playstation-4-games', tag: 'video games', sort: 1 },
  // Video Games — accessories
  { id: '476', slug: 'nintendo-switch-accessories', tag: 'video games' },
  { id: '761', slug: 'playstation-5-accessories', tag: 'video games' },
  { id: '763', slug: 'xbox-series-xs-accessories', tag: 'video games' },
  { id: '225', slug: 'gaming', tag: 'video games' },

  // Books — fiction genres
  { id: '245', slug: 'fiction-literature', tag: 'books' },
  { id: '322', slug: 'horror', tag: 'books' },
  { id: '323', slug: 'fantasy', tag: 'books' },
  { id: '324', slug: 'sci-fi', tag: 'books' },
  { id: '325', slug: 'mystery-thriller', tag: 'books' },
  { id: '427', slug: 'historical-fiction', tag: 'books' },
  { id: '428', slug: 'poetry', tag: 'books' },
  { id: '429', slug: 'romance', tag: 'books' },
  // Books — nonfiction genres
  { id: '246', slug: 'nonfiction', tag: 'books' },
  { id: '326', slug: 'biography-memoir', tag: 'books' },
  { id: '466', slug: 'true-crime', tag: 'books' },
  { id: '400', slug: 'history', tag: 'books' },
  { id: '411', slug: 'science', tag: 'books' },
  { id: '399', slug: 'cookbooks', tag: 'books' },
  { id: '407', slug: 'self-help', tag: 'books' },
  { id: '430', slug: 'nature-outdoors', tag: 'books' },
  { id: '426', slug: 'health', tag: 'books' },
  { id: '409', slug: 'politics-current-events', tag: 'books' },
  { id: '412', slug: 'social-science', tag: 'books' },
  { id: '425', slug: 'crafts-hobbies', tag: 'books' },
  { id: '406', slug: 'gardening', tag: 'books' },
  { id: '416', slug: 'house-home', tag: 'books' },
  // Books — other
  { id: '249', slug: 'audiobooks', tag: 'books' },
  { id: '422', slug: 'music-books', tag: 'books' },
  { id: '423', slug: 'movie-and-tv-books', tag: 'books' },
  { id: '424', slug: 'humor-books', tag: 'books' },
  { id: '465', slug: 'astrology-and-witchcraft', tag: 'books' },
  { id: '266', slug: 'upcoming-book-releases', tag: 'books' },
  { id: '895', slug: 'local-authors', tag: 'books' },
  { id: '227', slug: 'graphic-novels', tag: 'books' },
  { id: '401', slug: 'manga', tag: 'books' },
  { id: '228', slug: 'childrens-books', tag: 'books' },
  { id: '248', slug: 'young-adult', tag: 'books' },

  // Featured / Bestseller (curated lists of popular items often missing from genre pages)
  { id: '462', slug: 'bestsellers', tag: 'books' },
  { id: '385', slug: 'new-books', tag: 'books' },
  { id: '572', slug: 'new-in-paperback', tag: 'books' },
  { id: '827', slug: 'featured-music', tag: 'music' },
  { id: '212', slug: 'featured-movies', tag: 'movies' },
  { id: '852', slug: 'coming-soon-to-home-video', tag: 'movies' },

  // Games & Collectibles
  { id: '230', slug: 'board-games-puzzles', tag: 'board games' },
  { id: '337', slug: 'magic-the-gathering', tag: 'trading cards' },
  { id: '836', slug: 'disney-lorcana', tag: 'trading cards' },
  { id: '339', slug: 'pokemon-tcg', tag: 'trading cards' },
  { id: '340', slug: 'yu-gi-oh-tcg', tag: 'trading cards' },

  // Merch & Gifts
  { id: '651', slug: 'bullmoosemerch', tag: 'merch' },
  { id: '881', slug: 'woobles', tag: 'merch' },
  { id: '756', slug: 'baggu', tag: 'merch' },

  // Curated / trending (catches popular items not in genre pages)
  { id: '301', slug: 'hot-pre-orders', tag: 'music' },
  { id: '672', slug: 'new-music', tag: 'music' },

  // Specials / catch-all
  { id: '259', slug: 'new-this-week', tag: 'books' },
  { id: '876', slug: 'uncle-stinkys-discount-den', tag: 'books' },

  // Bestseller sort passes — same categories re-scraped sorted by Best Seller
  // to catch popular items that fall off the default relevance sort at 1000-item cap
  { id: '469', slug: 'rock-pop', tag: 'music', sort: 5 },
  { id: '470', slug: 'rap-hip-hop', tag: 'music', sort: 5 },
  { id: '245', slug: 'fiction-literature', tag: 'books', sort: 5 },
  { id: '246', slug: 'nonfiction', tag: 'books', sort: 5 },
  { id: '228', slug: 'childrens-books', tag: 'books', sort: 5 },
  { id: '292', slug: 'television-series', tag: 'movies', sort: 5 },
  { id: '334', slug: 'horror-films', tag: 'movies', sort: 5 },
  { id: '335', slug: 'comedy-movies', tag: 'movies', sort: 5 },
  { id: '548', slug: 'drama', tag: 'movies', sort: 5 },
  { id: '227', slug: 'graphic-novels', tag: 'books', sort: 5 },
  { id: '401', slug: 'manga', tag: 'books', sort: 5 },
];

// Map the primary category tag to the correct site_section for split-products.mjs
const TAG_TO_SECTION = {
  'music': 'Music',
  'movies': 'Movies & TV',
  'video games': 'Games',
  'books': 'Books',
  'board games': 'Games',
  'trading cards': 'Games',
  'merch': 'Apparel',
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

async function fetchCategory(cat) {
  // Step 1: Load category page for session cookie + SearchId
  // so= controls sort: 0=Relevance, 1=Name A-Z, 3=Price Low-High, 5=Best Seller, 9=Newest
  const sort = cat.sort || 0;
  const catUrl = `${BASE}/c/${cat.id}/${cat.slug}?so=${sort}`;
  let catRes;
  try {
    catRes = await fetchWithRetry(catUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (err) {
    console.log(`  FAIL: ${err.code || err.message}`);
    return [];
  }
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
    let res;
    try {
      res = await fetchWithRetry(`${BASE}/gsrp/${page}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Search-Guid': searchId,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieStr,
        },
      });
    } catch (err) {
      console.log(`  (page ${page} failed: ${err.code || err.message}, stopping category)`);
      break;
    }

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

// Running tally of shipping-status decisions, logged at end of run for auditing.
const avStats = { av10: 0, av11: 0, av21: 0, av40: 0, skipped_av30: 0, skipped_av50: 0, skipped_no_span: 0 };
// Sample of skipped items (with reason) for pilot verification.
const skippedSamples = [];

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

    // Check SHIPPING availability (not Curbside Pickup — items can be out of stock
    // locally but still shippable). Keep only cards whose Shipping line shows
    // In Stock (av10/av11), Special Order (av21), or Pre-order (av40).
    // IMPORTANT: fully-unshippable items render NO "Shipping:" line at all (only a
    // Pickup line with av50), so a missing span means unshippable — skip it.
    const shipMatch = card.match(/Shipping[^<]*<span class="av\s+([^"]+)"/s);
    const shipCls = shipMatch?.[1] || '';
    const keepMatch = shipCls.match(/av10|av11|av21|av40/);
    if (!keepMatch) {
      if (shipCls.includes('av30')) avStats.skipped_av30++;
      else if (shipCls.includes('av50')) avStats.skipped_av50++;
      else avStats.skipped_no_span++;
      if (skippedSamples.length < 1000) {
        // For no-span cards, record whatever av class the card DOES show (pickup status)
        const anyAv = card.match(/<span class="av\s+([^"]+)"/);
        skippedSamples.push({
          title: decodeHtmlEntities(title),
          url: `${BASE}/p/${productId}/${slug}`,
          reason: shipCls ? `shipping:${shipCls.trim()}` : `no-shipping-line (card av: ${anyAv?.[1]?.trim() || 'none'})`,
        });
      }
      continue;
    }
    avStats[keepMatch[0]]++;

    // Extract image URL (skip Bull Moose's "no art" placeholder)
    const imgMatch = card.match(/data-src="([^"]+)"/);
    let image = null;
    if (imgMatch && !imgMatch[1].includes('ArtNotAvailable')) {
      image = imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1];
    }

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
      shipStatus: keepMatch[0], // av10/av11 = In Stock, av21 = Special Order, av40 = Pre-order
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

// Popular search terms to supplement category scraping.
// Category pages cap at ~1000 results so popular items get missed.
// These terms catch mainstream products that people actually search for.
const SEARCH_TERMS = [
  // ── Books: bestselling authors & series ──
  'hunger games', 'harry potter', 'lord of the rings', 'game of thrones', 'percy jackson',
  'stephen king', 'colleen hoover', 'taylor jenkins reid', 'james patterson', 'rick riordan',
  'brandon sanderson', 'sarah j maas', 'diary of a wimpy kid', 'dog man', 'dav pilkey',
  'john grisham', 'danielle steel', 'nora roberts', 'lee child', 'jack reacher',
  'agatha christie', 'neil gaiman', 'margaret atwood', 'toni morrison', 'george orwell',
  'jk rowling', 'suzanne collins', 'veronica roth', 'divergent', 'maze runner',
  'jeff kinney', 'dr seuss', 'eric carle', 'mo willems', 'pete the cat',
  'rebecca yarros', 'fourth wing', 'iron flame', 'holly black', 'leigh bardugo',
  'freida mcfadden', 'bonnie garmus', 'lessons chemistry', 'project hail mary',
  'atomic habits', 'where crawdads sing', 'midnight library', 'it ends with us',
  // Books: more bestselling / classic authors
  'haruki murakami', 'tana french', 'chimamanda ngozi', 'kazuo ishiguro', 'ann patchett',
  'min jin lee', 'pachinko', 'donna tartt', 'secret history', 'cormac mccarthy',
  'blood meridian', 'the road mccarthy', 'normal people rooney', 'beautiful world',
  'tomorrow and tomorrow', 'babel rf kuang', 'yellowface', 'piranesi', 'house in the cerulean',
  'anxious people', 'a man called ove', 'circe madeline miller', 'song of achilles',
  'priory of the orange tree', 'ninth house', 'the poppy war',
  'all the light we cannot see', 'demon copperhead', 'james mcbride',
  'heaven and earth grocery', 'hernan diaz',
  // Books: children's & YA bestsellers
  'wings of fire', 'captain underpants', 'magic tree house', 'bad guys',
  'big nate', 'goosebumps', 'warrior cats', 'amulet', 'baby sitters club',
  'raina telgemeier', 'heartstopper', 'wonder palacio', 'hatchet paulsen',
  'keeper of the lost cities', 'six of crows', 'shadow and bone',
  // Books: nonfiction bestsellers
  'sapiens', 'thinking fast and slow', 'freakonomics', 'outliers gladwell',
  'shoe dog phil knight', 'born a crime', 'greenlights mcconaughey',
  'untamed glennon doyle', 'brene brown', 'dare to lead',
  'subtle art not giving', 'mans search for meaning', 'the body keeps the score',
  'how to win friends', 'brief history of time', 'guns germs steel',
  'braiding sweetgrass', 'entangled life', 'breath james nestor',
  // Books: cooking
  'salt fat acid heat', 'ottolenghi', 'kenji lopez alt', 'ina garten',
  // Books: graphic novels & manga bestsellers
  'one piece', 'naruto', 'my hero academia', 'demon slayer', 'jujutsu kaisen',
  'attack on titan', 'chainsaw man', 'spy x family', 'dragon ball',
  'berserk', 'vinland saga', 'fullmetal alchemist', 'death note',
  'saga vaughan', 'sandman gaiman', 'maus spiegelman', 'persepolis',
  'watchmen', 'v for vendetta', 'invincible kirkman', 'walking dead compendium',

  // ── Music: artists & albums ──
  'taylor swift', 'beyonce', 'beatles', 'pink floyd', 'led zeppelin', 'radiohead',
  'kendrick lamar', 'tyler the creator', 'billie eilish', 'olivia rodrigo', 'sabrina carpenter',
  'drake', 'adele', 'the weeknd', 'kanye west', 'nirvana', 'bob dylan', 'david bowie',
  'fleetwood mac', 'queen', 'rolling stones', 'bruce springsteen', 'johnny cash',
  'bob marley', 'miles davis', 'john coltrane', 'dolly parton', 'willie nelson',
  'hozier', 'chappell roan', 'sza', 'dua lipa', 'post malone', 'bad bunny',
  // Music: more popular artists
  'arctic monkeys', 'tame impala', 'the national', 'phoebe bridgers', 'bon iver',
  'frank ocean', 'mac demarco', 'king gizzard', 'khruangbin', 'japanese breakfast',
  'mitski', 'boygenius', 'big thief', 'alvvays', 'beach house',
  'foo fighters', 'green day', 'blink 182', 'my chemical romance', 'paramore',
  'lana del rey', 'charli xcx', 'doja cat', 'megan thee stallion',
  'jack white', 'the black keys', 'sturgill simpson', 'tyler childers',
  'jason isbell', 'colter wall', 'zach bryan', 'morgan wallen', 'chris stapleton',
  'thelonious monk', 'charles mingus', 'bill evans', 'sonny rollins',
  'stevie wonder', 'marvin gaye', 'prince', 'michael jackson', 'whitney houston',
  'elton john', 'billy joel', 'tom petty', 'the cure', 'depeche mode',
  'tool', 'metallica', 'iron maiden', 'black sabbath',
  'wu tang clan', 'nas', 'outkast', 'a tribe called quest',
  'elliott smith', 'jeff buckley', 'nick drake', 'leonard cohen', 'joni mitchell',
  'sufjan stevens', 'fleet foxes', 'neutral milk hotel',

  // ── Movies & TV ──
  'star wars', 'marvel', 'disney', 'batman', 'lord of the rings',
  'breaking bad', 'the office', 'friends tv', 'stranger things', 'game of thrones',
  'jurassic park', 'indiana jones', 'james bond', 'mission impossible', 'fast furious',
  'pixar', 'studio ghibli', 'miyazaki', 'scorsese', 'tarantino', 'nolan',
  'the sopranos', 'the wire', 'seinfeld', 'simpsons', 'south park',
  'succession', 'house of dragon', 'yellowstone', 'last of us', 'mandalorian',
  // Movies: more popular titles
  'alien', 'blade runner', 'terminator', 'john wick', 'mad max fury road',
  'dune villeneuve', 'oppenheimer', 'everything everywhere all at once', 'parasite bong',
  'wes anderson', 'grand budapest', 'david lynch', 'twin peaks',
  'stanley kubrick', 'clockwork orange', '2001 space odyssey',
  'coen brothers', 'fargo', 'no country for old men', 'big lebowski',
  'a24', 'midsommar', 'hereditary', 'uncut gems',
  'harry potter movie', 'top gun maverick',
  // TV series
  'the bear tv', 'ted lasso', 'severance', 'white lotus', 'shogun',
  'true detective', 'better call saul', 'ozark', 'fleabag', 'schitts creek',
  'avatar last airbender', 'rick and morty', 'doctor who', 'star trek',

  // ── Video Games ──
  'zelda', 'mario', 'pokemon', 'final fantasy', 'call of duty', 'minecraft',
  'elden ring', 'god of war', 'spider-man', 'animal crossing',
  'halo', 'resident evil', 'grand theft auto', 'assassins creed', 'dark souls',
  'super smash bros', 'metroid', 'kirby', 'sonic', 'mega man',
  'dragon quest', 'persona', 'fire emblem', 'kingdom hearts', 'monster hunter',
  'lego', 'madden', 'fifa', 'nba 2k', 'fortnite',
  // Games: more popular titles
  'baldurs gate', 'hogwarts legacy', 'jedi survivor',
  'alan wake', 'dead space', 'mario wonder', 'pikmin', 'splatoon',
  'luigi mansion', 'donkey kong', 'ratchet clank', 'horizon forbidden west',
  'gran turismo', 'hollow knight', 'hades', 'cuphead',
  'switch controller', 'ps5 controller', 'xbox controller', 'amiibo',

  // ── Personal favorites (owner-requested coverage) ──
  'adrian tchaikovsky', 'aphex twin', 'boards of canada', 'techno', 'house music',
  'electro', 'electronic music', 'nabokov', 'thomas pynchon', 'paul thomas anderson',
  'boston red sox', 'red sox', 'x-files', 'no pressure',

  // ── Board games & merch ──
  'catan', 'ticket to ride', 'pandemic board game', 'wingspan', 'azul',
  'codenames', 'terraforming mars', 'spirit island', 'gloomhaven',
  'dungeons dragons', 'jigsaw puzzle', 'ravensburger',
  't-shirt', 'poster', 'funko pop', 'tote bag',
]

async function fetchSearch(query) {
  const searchUrl = `${BASE}/search?q=${encodeURIComponent(query)}&so=0`;
  let res;
  try {
    res = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (err) {
    console.log(`FAIL: ${err.code || err.message}`);
    return [];
  }
  if (!res.ok) return [];

  const html = await res.text();
  const searchIdMatch = html.match(/SearchId:\s*'([^']+)'/);
  if (!searchIdMatch) return [];
  const searchId = searchIdMatch[1];

  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

  const products = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    let r;
    try {
      r = await fetchWithRetry(`${BASE}/gsrp/${page}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Search-Guid': searchId,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieStr,
        },
      });
    } catch (err) {
      break;
    }
    if (!r.ok) break;
    const data = await r.json();
    if (!data.success) break;

    totalPages = data.data.totalPages || 1;
    const parsed = parseProducts(data.data.data || '', 'search');
    products.push(...parsed);

    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  return products;
}

// Guess the primary category tag from format tags
function inferCategoryTag(tags) {
  const format = tags[1]?.toLowerCase() || '';
  if (format.includes('vinyl') || format.includes('audio cd') || format.includes('cassette') || format.includes('sacd')) return 'music';
  if (format.includes('dvd') || format.includes('blu-ray') || format.includes('4k ultra') || format.includes('vhs') || format.includes('laserdisc')) return 'movies';
  if (format.includes('game') || format.includes('playstation') || format.includes('nintendo') || format.includes('xbox') || format.includes('sega')) return 'video games';
  if (format.includes('book') || format.includes('paperback') || format.includes('hardcover')) return 'books';
  if (format.includes('card game') || format.includes('tcg')) return 'trading cards';
  if (format.includes('board game') || format.includes('puzzle')) return 'board games';
  return 'books'; // default for items without clear format
}

async function main() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'));
  const bmEntry = marketplace.find(e => e.name === 'Bull Moose');
  if (!bmEntry) {
    console.error('Bull Moose not found in marketplace.json');
    process.exit(1);
  }

  const categories = PILOT ? PILOT_CATEGORIES : CATEGORIES;
  const searchTerms = PILOT ? PILOT_SEARCH_TERMS : SEARCH_TERMS;

  // Deduplicate by product ID across categories
  const byId = new Map();
  let zeroCategories = 0;

  const saveCheckpoint = () => {
    if (PILOT) return;
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      zeroCategories, avStats, products: [...byId.values()],
    }));
  };

  if (MERGE_ONLY) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    zeroCategories = cp.zeroCategories;
    Object.assign(avStats, cp.avStats);
    for (const p of cp.products) byId.set(p.productId, p);
    console.log(`Loaded checkpoint: ${byId.size} products, ${zeroCategories} zero-result categories`);
  } else {
    console.log(`Scraping Bull Moose across ${categories.length} categories...`);
    let totalFetched = 0;

    for (const cat of categories) {
      process.stdout.write(`  ${cat.slug}... `);
      const products = await fetchCategory(cat);
      if (products.length === 0) zeroCategories++;
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
      saveCheckpoint();
      await sleep(2000); // Extra delay between categories to avoid throttling
    }

    console.log(`\nCategories: ${totalFetched} fetched, ${byId.size} unique products`);

    // Supplemental search scrape for popular items missed by category pages
    console.log(`\nSearching ${searchTerms.length} popular terms...`);
    let searchNew = 0;
    let termCount = 0;
    for (const term of searchTerms) {
      process.stdout.write(`  "${term}"... `);
      const results = await fetchSearch(term);
      let newCount = 0;
      for (const p of results) {
        if (!byId.has(p.productId)) {
          // Fix the 'search' tag with real category
          p.tags[0] = inferCategoryTag(p.tags);
          byId.set(p.productId, p);
          newCount++;
        }
      }
      searchNew += newCount;
      console.log(`${results.length} fetched, ${newCount} new (${byId.size} unique total)`);
      if (++termCount % 25 === 0) saveCheckpoint();
      await sleep(300);
    }
    console.log(`Search: ${searchNew} new products found`);
    saveCheckpoint();
  }

  console.log(`\nTotal: ${byId.size} unique products`);
  console.log(`Shipping-status audit: kept ${JSON.stringify({ av10: avStats.av10, av11: avStats.av11, av21: avStats.av21, av40: avStats.av40 })}`);
  console.log(`                    skipped ${JSON.stringify({ av30: avStats.skipped_av30, av50: avStats.skipped_av50, no_shipping_line: avStats.skipped_no_span })}`);

  if (PILOT) {
    writeFileSync(PILOT_FILE, JSON.stringify({
      avStats,
      kept: [...byId.values()],
      skippedSamples,
    }, null, 2));
    console.log(`\nPilot run — wrote ${byId.size} kept + ${skippedSamples.length} skipped samples to ${PILOT_FILE}`);
    console.log('(products.json untouched)');
    return;
  }

  if (DRY_RUN) {
    console.log('Dry run — not writing to file');
    return;
  }

  // Guardrails: refuse to merge a scrape that looks partial. The replace
  // strategy below drops every old product not re-found, so merging a bad
  // scrape would silently gut the catalog.
  if (zeroCategories > 3 || byId.size < 5000) {
    console.error(`\nABORTING MERGE: scrape looks partial (${zeroCategories} categories returned 0 products, ${byId.size} unique products).`);
    console.error(`Checkpoint preserved at ${CHECKPOINT_FILE}. Investigate, then re-run or use --merge-only.`);
    process.exit(1);
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
  // Replace strategy: only keep products found in this scrape. Old products not
  // re-found are dropped — they likely went out of stock or were delisted. This
  // avoids accumulating stale out-of-stock items from previous scrapes.
  const existing = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const nonBM = existing.filter(p => p.store_name !== 'Bull Moose');
  const oldBM = new Map(existing.filter(p => p.store_name === 'Bull Moose').map(p => [p.id, p]));
  const dropped = [...oldBM.keys()].filter(id => !new Map(bmProducts.map(p => [p.id, p])).has(id)).length;
  const mergedBM = bmProducts;

  const final = [...nonBM, ...mergedBM];
  writeFileSync(PRODUCTS_FILE, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} total products to products.json`);
  console.log(`  (${mergedBM.length} Bull Moose from this scrape, ${dropped} old products dropped)`);
  console.log(`  (${nonBM.length} other stores)`);

  // Run validation to fill any remaining gaps
  console.log('\n--- Running validation ---');
  const { execSync } = await import('child_process');
  execSync('node scripts/validate-bullmoose.mjs', { cwd: join(__dirname, '..'), stdio: 'inherit' });
}

main().catch(console.error);

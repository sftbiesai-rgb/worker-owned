import { interleaveByStore } from './utils.js'

export const SECTIONS = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea',          sectionName: 'Coffee & Tea',          title: 'Worker Owned Coffee & Tea Online | Worker Owned Marketplace',                          description: 'Shop worker owned coffee roasters and tea brands online. Cooperatively owned coffee roasted and shipped direct to your door.',              image: 'https://cdn.shopify.com/s/files/1/0262/2413/files/StampedeFairTradeOrganicCoffee.png' },
  { slug: 'media-publishing', label: 'Media & Publishing',    sectionName: 'Media & Publishing',    title: 'Worker Owned Media, News & Publishers Online | Worker Owned Marketplace',              description: 'Read and support worker owned journalism, newsletters, podcasts, and book publishers. Independent media owned by the people who make it.',  image: 'https://cdn.shopify.com/s/files/1/0569/3869/2669/files/getimage_d5cc5bf7-652d-4f27-9f0a-6600b7443adb.jpg' },
  { slug: 'food-pantry',      label: 'Food & Pantry',         sectionName: 'Food & Pantry',         title: 'Worker Owned Food & Pantry Online | Worker Owned Marketplace',                         description: 'Shop worker owned food brands online. Cooperatively owned nut butters, pickles, chocolate, olive oil, and pantry staples.',                image: 'https://cdn.shopify.com/s/files/1/0251/4242/7745/files/once-again-protein-sunflower-butter-packets-10-count-1250973263.jpg' },
  { slug: 'apparel',          label: 'Apparel',               sectionName: 'Apparel',               title: 'Worker Owned Clothing & Apparel Online | Worker Owned Marketplace',                    description: 'Shop worker owned clothing and apparel brands online. Cooperatively owned, USA-made, fair labor fashion.',                                 image: 'https://cdn.shopify.com/s/files/1/0277/0239/4940/files/Sauron_2x-8.png' },
  { slug: 'art-prints',       label: 'Art & Prints',          sectionName: 'Art & Prints',          title: 'Worker Owned Art Prints & Posters Online | Worker Owned Marketplace',                  description: 'Buy art prints and posters from worker owned artist cooperatives. Political, social movement, and activist art ships worldwide.' },
  { slug: 'books',            label: 'Books',                 sectionName: 'Books',                 title: 'Worker Owned Books & Publishers Online | Worker Owned Marketplace',                    description: 'Shop books from worker owned publishers and cooperatives. Fiction, nonfiction, graphic novels, and more from independent presses.' },
  { slug: 'movies-tv',        label: 'Movies & TV',           sectionName: 'Movies & TV',           title: 'Worker Owned Movies & TV Online | Worker Owned Marketplace',                          description: 'Shop DVDs, Blu-rays, and 4K UHD from worker and employee owned companies. Movies, TV series, documentaries, anime, and more.' },
  { slug: 'music',            label: 'Music',                 sectionName: 'Music',                 title: 'Worker Owned Music Platforms | Worker Owned Marketplace',                              description: 'Stream and buy music on cooperatively owned platforms. Worker owned Bandcamp alternatives where artists keep more.' },
  { slug: 'home-goods',       label: 'Home Goods & Services', sectionName: 'Home Goods & Services', title: 'Worker Owned Home Goods & Services | Worker Owned Marketplace',                        description: 'Shop worker owned home goods and services. Cooperatively made ceramics, textiles, candles, and worker owned home services.',               image: 'https://cdn.shopify.com/s/files/1/0762/3806/1868/files/Wncgwdg3K3.jpg' },
  { slug: 'personal-care',    label: 'Personal Care',         sectionName: 'Personal Care',         title: 'Worker Owned Soap & Personal Care Online | Worker Owned Marketplace',                  description: 'Shop worker owned soaps and personal care products online. Cooperatively made with natural ingredients.',                                  image: 'https://cdn.shopify.com/s/files/1/0579/2369/8848/files/IMG_2523_2.jpg' },
  { slug: 'games',            label: 'Games',                 sectionName: 'Games',                 title: 'Worker Owned Games & Video Games Online | Worker Owned Marketplace',                   description: 'Shop video games, board games, and trading cards from worker owned companies. PS5, Switch, Xbox, and tabletop games.',                     image: 'https://cdn.shopify.com/s/files/1/0465/1991/0550/files/4055FF5688575AF11091603CAB995EBF_1.jpg' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing',        sectionName: 'Beer & Brewing',        title: 'Worker Owned Breweries & Craft Beer | Worker Owned Marketplace',                       description: 'Find worker owned and cooperatively owned breweries. Craft beer made by and for the workers who brew it.',                                 image: 'https://cdn.shopify.com/s/files/1/0696/0712/9224/files/Spigleau_SQ.png' },
  { slug: 'tech-software',    label: 'Tech & Software',       sectionName: 'Tech & Software',       title: 'Worker Owned Tech & Software | Worker Owned Marketplace',                             description: 'Worker owned technology companies, software co-ops, and platform cooperatives. Tech built by the people who make it.' },
  { slug: 'sporting-goods',   label: 'Sporting Goods',        sectionName: 'Sporting Goods & Outdoors', title: 'Worker Owned Sporting Goods & Outdoors | Worker Owned Marketplace',               description: 'Shop sporting goods and outdoor gear from worker and employee owned companies. Bikes, cycling components, and outdoor equipment.' },
]

export const SECTION_SLUGS = Object.fromEntries(
  SECTIONS.map(s => [s.sectionName, s.slug])
)

export const SECTION_NAMES = Object.fromEntries(
  SECTIONS.map(s => [s.slug, s.sectionName])
)

export const SUBCATEGORIES = {
  music: [
    { slug: 'vinyl', label: 'Vinyl Records', keywords: ['vinyl lp', 'vinyl 7"', 'vinyl 12"', 'vinyl 10"', 'vinyl 3"', 'record'] },
    { slug: 'cds', label: 'CDs', keywords: ['audio cd', 'cd'] },
    { slug: 'cassettes', label: 'Cassettes', keywords: ['audio cassette', 'cassette', 'tape'] },
  ],
  // Apparel is matched exclusively (see productInSubcategory): whole words only,
  // and the last item-type word in the title wins ("Fleece Joggers" -> pants,
  // "Party Pants T-Shirt" -> shirts). Tags are only a fallback.
  apparel: [
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'bootie', 'sandal', 'sneaker', 'clog', 'slipper', 'slide', 'mule', 'loafer', 'flat', 'heel', 'wedge', 'moccasin', 'oxford', 'trainer'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'sweater', 'sweatshirt', 'crewneck', 'fleece', 'parka', 'cardigan', 'shacket', 'anorak', 'windbreaker', 'quarter zip', '1/4 zip', 'half zip', '1/2 zip', 'hoody', 'poncho', 'blazer', 'snowsuit', 'snow suit'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee', 'top', 'blouse', 'tank', 'tank top', 'polo', 'henley', 'camisole', 'cami', 'bodysuit', 'jersey', 'overshirt', 'snapshirt', 'onesie'] },
    { slug: 'pants', label: 'Pants & Bottoms', keywords: ['pant', 'sweatpant', 'jeans', 'short', 'bottom', 'legging', 'jogger', 'trouser', 'chino', 'slack', 'overall', 'trunk', 'boardshort'] },
    { slug: 'dresses', label: 'Dresses & Skirts', keywords: ['dress', 'skirt', 'skort', 'romper', 'jumpsuit'] },
    { slug: 'swim-sleep', label: 'Swim, Sleep & Underwear', keywords: ['swimsuit', 'swimwear', 'tankini', 'bikini', 'one piece', 'one-piece', 'rash guard', 'pajama', 'pj', 'robe', 'nightgown', 'underwear', 'panties', 'panty', 'bra', 'bralette', 'brief', 'boxer', 'boxer brief', 'hipster', 'thong', 'shapewear', 'leotard'] },
    { slug: 'accessories', label: 'Hats & Accessories', keywords: ['hat', 'beanie', 'cap', 'scarf', 'scarves', 'glove', 'mitten', 'belt', 'sock', 'bag', 'backpack', 'wallet', 'pouch', 'purse', 'crossbody', 'tote', 'wristlet', 'bandana', 'headband', 'luggage', 'duffel', 'sunglasses', 'necklace', 'earring', 'bracelet', 'pendant', 'jewelry', 'watch', 'hair clip', 'hair claw', 'scrunchie', 'face mask', 'balaclava', 'gaiter', 'wristband', 'wrist band', 'necktie', 'hair tie', 'card holder', 'cardholder'] },
  ],
  'home-goods': [
    { slug: 'jewelry', label: 'Jewelry', keywords: ['jewelry', 'earring', 'necklace', 'bracelet', 'ring', 'pendant', 'body jewelry'] },
    { slug: 'art', label: 'Art & Prints', keywords: ['art', 'print', 'poster', 'painting', 'wall art', 'canvas', 'illustration'] },
    { slug: 'woodworking', label: 'Woodworking', keywords: ['wood', 'wooden', 'cutting board', 'furniture', 'shelf', 'table', 'chair'] },
    { slug: 'ceramics', label: 'Ceramics & Pottery', keywords: ['ceramic', 'pottery', 'mug', 'bowl', 'plate', 'vase'] },
    { slug: 'decor', label: 'Candles & Decor', keywords: ['candle', 'decor', 'lamp', 'pillow', 'blanket'] },
    { slug: 'paper', label: 'Paper Goods', keywords: ['paper', 'card', 'stationery', 'notebook', 'sticker'] },
  ],
  'food-pantry': [
    { slug: 'seeds', label: 'Seeds & Garden', keywords: ['seed', 'garden', 'plant', 'flower', 'herb', 'vegetable'] },
    { slug: 'cheese', label: 'Cheese & Dairy', keywords: ['cheese', 'butter', 'dairy', 'yogurt', 'cream'] },
    { slug: 'meat', label: 'Meat & Butcher', keywords: ['beef', 'chicken', 'pork', 'meat', 'sausage', 'bacon', 'steak', 'butcher'] },
    { slug: 'chocolate', label: 'Chocolate & Sweets', keywords: ['chocolate', 'candy', 'sweet', 'cocoa', 'truffle', 'toffee', 'fudge', 'caramel'] },
    { slug: 'pantry', label: 'Pantry Staples', keywords: ['olive oil', 'nut butter', 'jam', 'honey', 'spice', 'seasoning', 'sauce', 'vinegar', 'flour', 'grain', 'seaweed', 'kelp'] },
  ],
  'personal-care': [
    { slug: 'skin-care', label: 'Skin Care', keywords: ['lotion', 'moisturizer', 'cream', 'sunscreen', 'face wash', 'cleanser', 'serum', 'body butter', 'body wash', 'exfoliat', 'toner', 'skin'] },
    { slug: 'hair-care', label: 'Hair Care', keywords: ['shampoo', 'conditioner', 'hair', 'haircolor', 'styling'] },
    { slug: 'soap', label: 'Soap & Bath', keywords: ['soap', 'bar soap', 'bath', 'body bar', 'hand wash', 'bubble'] },
    { slug: 'deodorant', label: 'Deodorant', keywords: ['deodorant', 'antiperspirant'] },
    { slug: 'vitamins', label: 'Vitamins & Supplements', keywords: ['vitamin', 'supplement', 'mineral', 'probiotic', 'calcium', 'magnesium', 'iron ', 'zinc ', 'omega', 'fish oil', 'multivitamin', 'gummies'] },
    { slug: 'medicine', label: 'Medicine & First Aid', keywords: ['medicine', 'tylenol', 'advil', 'ibuprofen', 'acetaminophen', 'allergy', 'cold ', 'cough', 'bandage', 'first aid', 'thermometer', 'antibiotic', 'pain relief', 'aspirin'] },
  ],
  'coffee-tea': [
    { slug: 'coffee', label: 'Coffee', keywords: ['coffee', 'espresso', 'roast', 'blend', 'decaf', 'ground', 'whole bean'] },
    { slug: 'tea', label: 'Tea', keywords: ['tea', 'herbal', 'chai', 'matcha', 'rooibos', 'green tea', 'black tea'] },
    { slug: 'chocolate', label: 'Chocolate & Cocoa', keywords: ['chocolate', 'cocoa', 'cacao', 'hot chocolate'] },
  ],
  'games': [
    { slug: 'ps5', label: 'PlayStation 5', keywords: ['playstation 5 game'] },
    { slug: 'ps4', label: 'PlayStation 4', keywords: ['playstation 4 game'] },
    { slug: 'switch', label: 'Nintendo Switch', keywords: ['nintendo switch game', 'nintendo switch 2'] },
    { slug: 'xbox', label: 'Xbox Series', keywords: ['xbox series x game'] },
    { slug: 'retro-playstation', label: 'Retro PlayStation', keywords: ['playstation 3', 'playstation 2', 'playstation 1', 'playstation portable', 'playstation vita'] },
    { slug: 'retro-nintendo', label: 'Retro Nintendo', keywords: ['nintendo wii', 'nintendo ds', 'nintendo 3ds', 'gamecube', 'game boy advance', 'nintendo 64', 'snes', 'nes ', 'game boy'] },
    { slug: 'retro-xbox', label: 'Retro Xbox', keywords: ['xbox 360', 'xbox one', 'xbox accessories'] },
    { slug: 'retro-sega', label: 'Retro Sega', keywords: ['sega', 'dreamcast', 'genesis', 'saturn', 'gamegear'] },
    { slug: 'trading-cards', label: 'Trading Cards', keywords: ['trading cards', 'tcg', 'mtg', 'card game', 'booster', 'yugioh', 'lorcana', 'digimon', 'pokemon'] },
    { slug: 'board-games', label: 'Board Games', keywords: ['board game', 'dice', 'strategy', 'party game', 'family game', 'munchkin'] },
    { slug: 'puzzles', label: 'Puzzles', keywords: ['puzzle', 'jigsaw'] },
    { slug: 'toys', label: 'Toys & Kids', keywords: ['toy', 'plush', 'stuffed', 'figure', 'doll', 'kid', 'children', 'building'] },
  ],
  'sporting-goods': [
    { slug: 'bikes', label: 'Bikes & Cycling', keywords: ['bike', 'bicycle', 'cycling', 'cycle', 'pedal', 'handlebar', 'headset', 'crankset', 'derailleur', 'chainring', 'seatpost', 'bottom bracket'] },
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'cleat', 'hiking boot', 'trail runner', 'wading boot'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'jersey', 'tank ', 'polo', 'base layer', 'athletic top'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'fleece', 'parka', 'windbreaker', 'rain jacket'] },
    { slug: 'camping', label: 'Camping & Outdoors', keywords: ['tent', 'sleeping bag', 'camp', 'camping', 'backpack', 'hiking', 'trail', 'cooler', 'lantern', 'compass', 'knife', 'hammock'] },
    { slug: 'fishing', label: 'Fishing & Hunting', keywords: ['fishing', 'rod', 'reel', 'lure', 'tackle', 'hunting', 'ammo', 'scope', 'decoy'] },
    { slug: 'fitness', label: 'Fitness & Training', keywords: ['fitness', 'weight', 'dumbbell', 'kettlebell', 'resistance', 'yoga', 'exercise', 'training', 'gym'] },
  ],
  'books': [
    { slug: 'fiction', label: 'Fiction', keywords: ['subject-fiction', 'novel', 'fiction', 'romance', 'fantasy', 'sci-fi', 'mystery', 'thriller', 'horror', 'historical-fiction', 'poetry'] },
    { slug: 'nonfiction', label: 'Nonfiction', keywords: ['subject-history', 'subject-philosophy', 'subject-political', 'subject-economics', 'subject-anthropology', 'subject-biography', 'nonfiction', 'self-help', 'true-crime', 'science', 'cookbooks', 'health', 'nature'] },
    { slug: 'graphic-novels', label: 'Graphic Novels', keywords: ['graphic novel', 'comic'] },
    { slug: 'manga', label: 'Manga', keywords: ['manga'] },
    { slug: 'childrens', label: "Children's", keywords: ['children', 'kids', 'picture book'] },
    { slug: 'young-adult', label: 'Young Adult', keywords: ['young adult', 'ya '] },
  ],
  'movies-tv': [
    { slug: 'dvd', label: 'DVD', keywords: ['dvd'] },
    { slug: 'blu-ray', label: 'Blu-ray', keywords: ['blu-ray'] },
    { slug: '4k', label: '4K UHD', keywords: ['4k ultra hd', '4k uhd'] },
    { slug: 'anime', label: 'Anime', keywords: ['anime'] },
    { slug: 'horror', label: 'Horror', keywords: ['horror'] },
    { slug: 'comedy', label: 'Comedy', keywords: ['comedy'] },
    { slug: 'documentary', label: 'Documentary', keywords: ['documentary'] },
    { slug: 'tv-series', label: 'TV Series', keywords: ['television', 'season', 'complete series'] },
  ],
  'media-publishing': [
    { slug: 'news-journalism', label: 'News & Journalism', keywords: ['news-subscription'] },
    { slug: 'maps-prints', label: 'Maps & Prints', keywords: ['map', 'poster', 'print', 'wall map', 'sticker', 'patch', 'button'] },
  ],
}

// Categories whose subcategories are mutually exclusive: each product goes to
// the subcategory whose keyword appears last in its title (the head noun),
// or failing that the first one matching its tags.
const EXCLUSIVE_SUBCATEGORIES = new Set(['apparel'])

// Phrases that contain a keyword but don't mean that item type.
const SUBCATEGORY_NOISE = /\b(short|long|3\/4|cap)[- ]sleeved?\b|\bboot[- ]?cut\b|\btop[- ]?(rated|seller)\b|\b(blue jackets|new jersey|high[- ]top|dress (sneak|shoe|boot)\w*)\b/gi

const wordRegexCache = new Map()
function keywordsRegex(keywords) {
  const key = keywords.join('|')
  if (!wordRegexCache.has(key)) {
    const alts = keywords.map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    wordRegexCache.set(key, new RegExp(`(?<![a-z])(?:${alts})(?:s|es)?(?![a-z])`, 'gi'))
  }
  return wordRegexCache.get(key)
}

function lastMatchIndex(re, text) {
  let last = -1
  for (const m of text.matchAll(re)) last = m.index
  return last
}

// Fan gear and merch that mention a clothing word but aren't clothing
// ("Boxer Shorts Ornament", "Hoodie Sticker"). Only counts when it comes
// after the clothing word, so "Sticker Collage T-Shirt" is still a shirt.
const NON_APPAREL = /\b(?:stickers?|keychains?|key ?rings?|lanyards?|ornaments?|felt banners?|magnets?|decals?|enamel pins?|tumblers?|koozies?|slipmats?|replacement lens(es)?|bobbleheads?|figurines?|gift cards?|posters?|coins?|detergents?|steamers?|fabric softeners?|sweater (?:stones?|combs?|shavers?|pins?))\b/gi

// Stores that only sell footwear, so "High Top" or "Dress" in a title is a shoe.
const SHOE_STORES = new Set(['Tradehome Shoes', 'Dansko'])

function exclusiveSubcategory(p, subs, { titleOnly = false } = {}) {
  if (SHOE_STORES.has(p.store_name) && subs.some(s => s.slug === 'shoes')) return 'shoes'
  const title = (p.title || '').replace(SUBCATEGORY_NOISE, ' ')
  let best = null, bestIdx = -1
  for (const s of subs) {
    const i = lastMatchIndex(keywordsRegex(s.keywords), title)
    if (i > bestIdx) { best = s; bestIdx = i }
  }
  if (lastMatchIndex(NON_APPAREL, title) >= Math.max(bestIdx, 0)) return null
  if (best) return best.slug
  if (titleOnly) return null
  const tags = (p.tags || []).join(' | ').replace(SUBCATEGORY_NOISE, ' ')
  return subs.find(s => lastMatchIndex(keywordsRegex(s.keywords), tags) >= 0)?.slug || null
}

// Keywords match at the start of a word, so 'art' doesn't hit "party" and
// 'tea' doesn't hit "steam". Short keywords (4 chars or less) must be the
// whole word, plural allowed: 'card' matches "cards" but not "cardigan".
const startRegexCache = new Map()
function keywordStartRegex(keywords) {
  const key = keywords.join('|')
  if (!startRegexCache.has(key)) {
    const alts = keywords.map(k => {
      const t = k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return t.length <= 4 ? `${t}(?:s|es)?(?![a-z])` : t
    })
    startRegexCache.set(key, new RegExp(`(?<![a-z])(?:${alts.join('|')})`, 'i'))
  }
  return startRegexCache.get(key)
}

export function productInSubcategory(p, category, sub) {
  if (EXCLUSIVE_SUBCATEGORIES.has(category)) {
    return exclusiveSubcategory(p, SUBCATEGORIES[category]) === sub.slug
  }
  return keywordStartRegex(sub.keywords).test(p.title + ' ' + (p.tags || []).join(' '))
}

// Gender chips for clothing categories. Title wins over tags, since stores
// often tag a women's item with both "Mens" and "Womens" for cross-listing.
const WOMENS_RE = /(?:^|[^a-z])(?:women|womens|women's|woman's|ladies|ladies'|wmns)(?:[^a-z]|$)/i
const MENS_RE = /(?:^|[^a-z])(?:men|mens|men's|man's)(?:[^a-z]|$)/i
const UNISEX_RE = /(?:^|[^a-z])unisex(?:[^a-z]|$)/i

// Default order for the unfiltered Apparel page: everyday clothing first
// (shirts, pants, hoodies/sweaters, dresses), alternating men's and women's,
// then shoes, accessories and kids' items. Items that match no clothing type
// (stickers, books, keychains) are left off unless the visitor is searching.
const APPAREL_BASICS = new Set(['shirts', 'pants', 'outerwear', 'dresses'])
const KIDS_RE = /(?:^|[^a-z])(?:baby|infant|toddler|kids?|kid's|youth|boys|boys'|girls|girls'|children|children's|preschool|grade school)(?:[^a-z]|$)/i

// Apparel items that match no clothing type (stickers, books, keychains).
export const isApparelUnmatched = p => !exclusiveSubcategory(p, SUBCATEGORIES.apparel)

export function apparelBrowseOrder(products, { keepUnmatched = false } = {}) {
  const subs = SUBCATEGORIES.apparel
  const basics = [], rest = [], unmatched = []
  for (const p of products) {
    const sub = exclusiveSubcategory(p, subs)
    if (!sub) unmatched.push(p)
    else if (APPAREL_BASICS.has(sub) && !KIDS_RE.test(p.title || '') && exclusiveSubcategory(p, subs, { titleOnly: true })) basics.push({ p, sub })
    else rest.push(p)
  }
  // Familiar brands (Carhartt, Levi's, Patagonia...) lead, rotating brand and
  // gender; then each store rotates item type and gender so a store's turn
  // shows e.g. a men's shirt then women's pants, not ten tees in a row.
  const genderOf = p => WOMENS_RE.test(p.title) ? 'w' : MENS_RE.test(p.title) ? 'm' : 'u'
  const brandBasics = basics.filter(b => popularName('apparel', b.p)).map(b => b.p)
  const brandOrdered = roundRobinStores(brandBasics, q => rotate(q, p => popularName('apparel', p) + '|' + genderOf(p)))
  const byStore = new Map()
  for (const b of basics.filter(b => !popularName('apparel', b.p))) {
    const key = b.p.store_name || b.p.store_url || ''
    if (!byStore.has(key)) byStore.set(key, new Map())
    const bucket = `${b.sub}|${genderOf(b.p)}`
    const buckets = byStore.get(key)
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket).push(b.p)
  }
  const storeQueues = []
  for (const buckets of byStore.values()) {
    const qs = [...buckets.values()], queue = []
    for (let i = 0; qs.some(q => i < q.length); i++) {
      for (const q of qs) if (i < q.length) queue.push(q[i])
    }
    storeQueues.push(queue)
  }
  // Stores with the widest clothing range lead each round; every store still
  // gets two items per round, so small shops show up on page one.
  storeQueues.sort((a, b) => b.length - a.length)
  const basicsOrdered = []
  for (let i = 0; storeQueues.some(q => i < q.length); i += 2) {
    for (const q of storeQueues) basicsOrdered.push(...q.slice(i, i + 2))
  }
  return [
    ...mixSmallMakers([...brandOrdered, ...basicsOrdered]),
    ...interleaveByStore(rest),
    ...(keepUnmatched ? interleaveByStore(unmatched) : []),
  ]
}

export const GENDER_FILTER_CATEGORIES = new Set(['apparel', 'sporting-goods'])
export const GENDER_FILTERS = [
  { slug: 'mens', label: "Men's" },
  { slug: 'womens', label: "Women's" },
]

export function productMatchesGender(p, gender) {
  const own = gender === 'mens' ? MENS_RE : WOMENS_RE
  const other = gender === 'mens' ? WOMENS_RE : MENS_RE
  const title = p.title || ''
  if (UNISEX_RE.test(title)) return true
  if (own.test(title)) return true
  if (other.test(title)) return false
  const tags = (p.tags || []).join(' | ')
  return own.test(tags) || UNISEX_RE.test(tags)
}

// Format/tag filters that appear as a secondary filter row on category pages.
// These work independently from subcategories — users can combine them.
export const FILTERS = {
  music: [
    { label: 'Vinyl', tag: 'vinyl lp' },
    { label: 'CD', tag: 'audio cd' },
    { label: 'Cassette', tag: 'audio cassette' },
  ],
  books: [
    { label: 'Paperback', tag: 'book - paperback' },
    { label: 'Hardcover', tag: 'book - hardcover' },
  ],
  'movies-tv': [
    { label: 'DVD', tag: 'dvd' },
    { label: 'Blu-ray', tag: 'blu-ray' },
    { label: '4K UHD', tag: '4k ultra hd' },
  ],
  games: [
    { label: 'PS5', tag: 'playstation 5 game' },
    { label: 'PS4', tag: 'playstation 4 game' },
    { label: 'Switch', tag: 'nintendo switch game' },
    { label: 'Xbox Series', tag: 'xbox series x game' },
  ],
}

// On a category's unfiltered page, list its core products before merch,
// equipment and accessories. Categories not listed here keep store order.
const MERCH = /\b(t-?shirts?|tees?|tank tops?|long sleeve|hoodies?|sweatshirts?|sweatpants|crewneck|beanies?|hats?|caps?|socks?|totes?|mugs?|tumblers?|glass|stickers?|magnets?|gift cards?|aprons?|napkins?|pins?|patch(es)?|ornaments?|keychains?|koozies?|postcards?|greeting cards?|plush|toys?|lip balm|gloves|mittens)\b|wholesale|display shipper/i
const BREW_GEAR = /\b(dripper|filters?|grinder|kettle|scale|aeropress|chemex|brewer|carafe|french press|lighter|growler|cans?|pan|rolling pin|pastry wheel|oven gloves|peppermill)\b|cold brew filter|k-cup holder/i
const NON_BOOK_TAGS = /^(posters|enamel-pins|magnets|patches|cards|other|gift\/lifestyle item|incense|sticker|audio cd|vinyl lp|blu-ray|dvd|4k ultra hd|news-subscription)$/i
const GAME_GEAR = /\b(cables?|controllers?|chargers?|adapters?|cases?|stands?|memory card|headsets?|skins?|grips?|acc)\b|\bav cable|^[^/]+ acc\//i

// Store logo merch and team-logo fan gear (Scheels' "fan shop" paths).
const SHOP_MERCH = /\b(t-?shirts?|tees?|hoodies?|sweatshirts?|totes?|stickers?|keychains?|lanyards?|gift cards?|can coolers?|decals?)\b|^donate\b/i
const isFanGear = p => (p.tags || []).some(t => /^fan shop >/i.test(t))

const BEER_WEAR = /\b(t-?shirts?|shirts?|tees?|hoodies?|hats?|caps?|beanies?|flannel|shacket|crewneck|sweatshirts?|polo|jersey|tanks?|long sleeve|bandana|sunglasses|fanny pack|scarf|mittens?|socks?|stickers?|koozies?|playing cards|lens cloth|tackers?|poop bag|collar|leash|coin|bags?|tops?|ornaments?|toys?|gift cards?)\b/i
const BAR_GEAR = /\b(glass(es)?|goblet|stein|mugs?|growlers?|tap handles?|bottle openers?|can coolers?|tumblers?|corkscrew|water ?bottles?)\b/i
const BEER_STYLE = /\b(ipa|ale|lager|stout|porter|pilsner|cider|sour|quad|saison|shandy|hard lemonade|750ml)\b/i
// Deschutes ships its beer; its beer names (Jubelale, Dissident) don't say "beer".
const isBeer = p => !BEER_WEAR.test(p.title) && !BAR_GEAR.test(p.title) &&
  (BEER_STYLE.test(p.title) || (p.store_name === 'Deschutes Brewery' && !/membership|society -|gift card|barrel|staves/i.test(p.title)))
// Replacement bolts, springs and service kits that bury whole bikes and gear.
const SMALL_PARTS = /\b(bolts?|screws?|springs?|washers?|bearings?|replacement|service kits?|rebuild kits?|hardware|valve stems?|spacers?|seals?|o-?rings?|end caps?|pistons?|bushings?|knobs?|clamps?|brackets?|adaptors?|adapters?|axles?|lever blades|mounts?)\b/i

const TECH_ACCESSORY = /\b(batter(y|ies)|chargers?|mounts?|cases?|sleeves?|cables?|bands?|lens mod|sd card|map card|transducers?|replacement|floaty|adapters?|kits?)\b|^prime brands group|^actionheat/i

const CORE_ITEM = {
  books: p => !(p.tags || []).some(t => NON_BOOK_TAGS.test(t)) && !/gift card/i.test(p.title),
  'coffee-tea': p => !MERCH.test(p.title) && !BREW_GEAR.test(p.title),
  'food-pantry': p => !MERCH.test(p.title) && !BREW_GEAR.test(p.title),
  games: p => !GAME_GEAR.test(p.title),
  'home-goods': p => !isFanGear(p) && !SHOP_MERCH.test(p.title),
  // Records, CDs and tapes before band shirts, posters and slipmats.
  music: p => !MERCH.test((p.title || '').split('/')[0]),
  'movies-tv': p => !MERCH.test((p.title || '').split('/')[0]) && !/sticky note|masking tape/i.test(p.title),
  // Beer first, then glassware, growlers and tap handles, then apparel.
  'beer-brewing': p => isBeer(p) ? 0 : BAR_GEAR.test(p.title) ? 1 : 2,
  'sporting-goods': p => !isFanGear(p) && !SMALL_PARTS.test(p.title),
  // Co-op services, then devices, then accessories and team-logo gadgets.
  'tech-software': p => (p.tags || []).includes('service') ? 0 : (TECH_ACCESSORY.test(p.title) || isFanGear(p)) ? 2 : 1,
  'personal-care': p => !SHOP_MERCH.test(p.title) && !/\b(mugs?|candle holders?|t-?shirts?)\b/i.test(p.title),
}

// Everyday staples (toothpaste, coffee, flour, skillets) and the brands,
// artists, authors and franchises people already shop for. On a category's
// unfiltered page these lead the first pages, so the marketplace reads like a
// store with the things you'd otherwise buy on Amazon rather than only
// handmade goods. Matched as whole words anywhere in the title.
const POPULAR_NAMES = {
  apparel: ['carhartt', "levi's", 'patagonia', 'the north face', 'columbia', 'nike', 'adidas', 'under armour', 'kuhl', 'wrangler', 'champion', 'vans', 'converse', 'birkenstock', 'ugg', 'crocs', 'new balance', 'brooks', 'hoka', 'asics', 'dansko', 'smartwool', 'darn tough', 'dickies', 'free people', 'prana', "arc'teryx", 'ariat', 'oakley', 'ray-ban', 'costa', 'keen', 'merrell', 'teva', 'chaco', 'timberland', 'dr. martens', 'filson', 'duluth', 'vuori'],
  music: ['the beatles', 'taylor swift', 'fleetwood mac', 'pink floyd', 'radiohead', 'kendrick lamar', 'nirvana', 'prince', 'michael jackson', 'bob marley', 'amy winehouse', 'stevie wonder', 'marvin gaye', 'joni mitchell', 'daft punk', 'sabrina carpenter', 'wu-tang clan', 'beyonce', 'david bowie', 'outkast', 'phoebe bridgers', 'johnny cash', 'john coltrane', 'arctic monkeys', 'sza', 'miles davis', 'led zeppelin', 'the rolling stones', 'bob dylan', 'bruce springsteen', 'billie eilish', 'olivia rodrigo', 'chappell roan', 'lana del rey', 'tyler, the creator', 'harry styles', 'adele', 'dolly parton', 'willie nelson', 'elton john', 'queen', 'the cure', 'the smiths', 'talking heads', 'neil young', 'grateful dead', 'pearl jam', 'foo fighters', 'metallica', 'red hot chili peppers', 'gorillaz', 'tame impala', 'mac miller', 'noah kahan', 'zach bryan', 'gracie abrams', 'boygenius', 'mitski', 'fiona apple', 'kate bush', 'bjork', 'lorde', 'hozier', 'nina simone', 'aretha franklin', 'tom petty', 'creedence clearwater revival', 'eagles', 'steely dan', 'simon & garfunkel', 'carole king', 'abba', 'whitney houston', 'lauryn hill', 'a tribe called quest', 'nas', 'the notorious b.i.g.', 'vampire weekend', 'the strokes', 'lcd soundsystem', 'bon iver', 'sufjan stevens', 'system of a down', 'green day', 'the white stripes', 'paramore', 'weezer', 'beastie boys', 'the clash', 'ramones', 'black sabbath', 'ac/dc', 'the doors', 'jimi hendrix', 'janis joplin', 'frank sinatra', 'louis armstrong', 'ella fitzgerald', 'vince guaraldi', 'mariah carey', 'charli xcx', 'dua lipa', 'lady gaga', 'kacey musgraves', 'chris stapleton', 'tyler childers', 'sturgill simpson'],
  'movies-tv': ['studio ghibli', 'spirited away', 'totoro', 'mononoke', 'star wars', 'mandalorian', 'lord of the rings', 'hobbit', 'harry potter', 'marvel', 'avengers', 'batman', 'spider-man', 'jurassic', 'indiana jones', 'back to the future', 'godfather', 'criterion', 'seinfeld', 'the office', 'friends', 'breaking bad', 'better call saul', 'twin peaks', 'simpsons', 'futurama', 'star trek', 'doctor who', 'toy story', 'pixar', 'disney', 'yellowstone', 'stranger things', 'game of thrones', 'sopranos', 'the wire', 'alien', 'terminator', 'die hard', 'ghostbusters', 'big lebowski', 'fargo', 'pulp fiction', 'kill bill', 'the shining', '2001', 'psycho', 'vertigo', 'wizard of oz', 'casablanca', 'dune', 'blade runner', 'mad max', 'top gun', 'rocky', 'halloween', 'scream', 'nightmare before christmas', 'elf', 'home alone', "it's a wonderful life", 'christmas vacation', 'a christmas story', 'grinch', 'charlie brown', 'muppet', 'princess bride', 'monty python', 'schitt', 'parks and recreation', 'the bear', 'succession', 'ted lasso', 'bluey', 'avatar', 'oppenheimer', 'barbie', 'wicked', 'john wick', 'mission: impossible', 'james bond', '007'],
  books: ['stephen king', 'colleen hoover', 'rebecca yarros', 'sarah j. maas', 'brandon sanderson', 'j. r. r. tolkien', 'j.r.r. tolkien', 'frank herbert', 'octavia butler', 'octavia e. butler', 'ursula k. le guin', 'toni morrison', 'barbara kingsolver', 'percival everett', 'kazuo ishiguro', 'andy weir', 'taylor jenkins reid', 'emily henry', 'freida mcfadden', 'james clear', 'michelle obama', 'yuval noah harari', 'robin wall kimmerer', 'howard zinn', 'angela y. davis', 'naomi klein', 'david graeber', 'noam chomsky', 'mariame kaba', 'bell hooks', 'james baldwin', 'george orwell', 'kurt vonnegut', 'terry pratchett', 'douglas adams', 'agatha christie', 'jane austen', 'dr. seuss', 'mo willems', 'dav pilkey', 'jeff kinney', 'rick riordan', 'suzanne collins', 'eiichiro oda', 'tatsuki fujimoto', 'gege akutami', 'kohei horikoshi', 'alison bechdel', 'pierce brown', 'adrian tchaikovsky', 'martha wells', 'n. k. jemisin', 'becky chambers', 'ann patchett', 'sally rooney', 'gabrielle zevin', 'delia owens', 'tara westover', 'matt haig', 'john green', 'rick rubin', 'malcolm gladwell', 'mary roach', 'erik larson', 'david sedaris', 'anthony bourdain', 'ina garten', 'samin nosrat', 'j. kenji lopez-alt', 'cormac mccarthy', 'haruki murakami', 'gabriel garcia marquez', 'margaret atwood', 'ray bradbury', 'philip k. dick', 'isaac asimov', 'arthur c. clarke', 'william gibson', 'neal stephenson'],
  games: ['mario', 'zelda', 'pokemon', 'kirby', 'animal crossing', 'metroid', 'donkey kong', 'smash bros', 'splatoon', 'minecraft', 'elden ring', 'final fantasy', 'spider-man', 'god of war', 'sonic', 'catan', 'ticket to ride', 'wingspan', 'codenames', 'pandemic', 'magic: the gathering', 'mtg', 'lorcana', 'lego', 'dungeons & dragons', 'monopoly', 'scrabble', 'uno', 'exploding kittens', 'jenga', 'clue', 'chess', 'baldur', 'hades', 'stardew', 'hollow knight', 'resident evil', 'metal gear', 'persona', 'yakuza', 'like a dragon', 'street fighter', 'mortal kombat', 'tetris', 'pac-man'],
  'home-goods': ['cast iron skillet', 'skillet', 'dutch oven', 'coffee mug', 'kitchen towel', 'bath towel', 'tea towel', 'sheet set', 'wool blanket', 'throw blanket', 'throw pillow', 'cutting board', 'chef\'s knife', 'tumbler', 'water bottle', 'mixing bowl', 'baking sheet', 'cookware', 'dog bed', 'planter', 'grow light', 'yeti rambler', 'yeti tumbler', 'lodge', 'stanley', 'hydro flask', 'zwilling', 'oxo', 'cuisinart', 'ninja', 'le creuset', 'pyrex', 'big green egg', 'traeger', 'weber', 'solo stove', 'owala', 'contigo', 'kong', 'blackstone', 'ooni', 'staub', 'henckels', 'wusthof', 'victorinox', 'bodum', 'chemex', 'hario'],
  'personal-care': ['toothpaste', 'deodorant', 'shampoo', 'conditioner', 'body wash', 'bar soap', 'hand soap', 'lotion', 'moisturizer', 'sunscreen', 'lip balm', 'floss', 'mouthwash', 'razor', 'multivitamin', 'face wash', 'shea butter', 'cerave', 'cetaphil', 'aveeno', 'neutrogena', "burt's bees", 'dr. bronner', "dr. bronner's", "tom's of maine", 'native deodorant', 'dr. squatch', 'olay', 'dove', 'colgate', 'crest', 'oral-b', 'nivea', 'aquaphor', 'vaseline', 'eucerin', 'la roche-posay', 'vanicream', "nature's bounty", 'centrum', 'olly', 'advil', 'tylenol', 'zyrtec', 'claritin', 'banana boat', 'sun bum', 'duke cannon', 'tree hut', 'mitchum', 'old spice', 'gillette', 'listerine', 'sensodyne', 'differin', 'thayers', 'alaffia', 'chapstick', 'blistex', 'carmex', 'emergen-c', 'airborne', 'miralax', 'metamucil', 'theraflu', 'mucinex', 'vicks'],
  'sporting-goods': ['water bottle', 'backpack', 'running shoes', 'yoga mat', 'dumbbell', 'sleeping bag', 'tent', 'headlamp', 'cooler', 'hammock', 'bike helmet', 'basketball', 'football', 'soccer ball', 'pocket knife', 'trek', 'yeti', 'osprey', 'patagonia', 'brooks', 'hoka', 'garmin', 'black diamond', 'big agnes', 'msr', 'jetboil', 'eno', 'wilson', 'spalding', 'coleman', 'stanley', 'hydro flask', 'camelbak', 'under armour', 'nike', 'adidas', 'oakley', 'smith', 'titleist', 'callaway', 'taylormade', 'bushnell', 'vortex', 'shimano', 'penn', 'rapala', 'the north face', 'columbia', 'salomon', 'merrell', 'keen', 'thule', 'rei', 'kelty', 'nemo', 'therm-a-rest', 'sea to summit', 'leatherman', 'gerber', 'benchmade', 'opinel', 'swiss army', 'otterbox', 'hoyt', 'bear archery', 'yakima', 'peloton', 'bowflex', 'rogue', 'everlast', 'franklin', 'rawlings', 'easton', 'bauer', 'ccm', 'burton', 'k2', 'rossignol'],
  'tech-software': ['headphones', 'earbuds', 'bluetooth speaker', 'smartwatch', 'action camera', 'binoculars', 'garmin', 'gopro', 'jbl', 'bose', 'sony', 'whoop', 'apple', 'anker', 'bushnell', 'zeiss', 'swarovski', 'vortex', 'nikon', 'skullcandy', 'tile', 'theragun', 'hyperice', 'oura', 'mdr-7506', 'ath-m50x', 'ath-m40x', 'se215', 'hd 280 pro', 'dt-770 pro', 'sm7b', 'sm58', 'scarlett solo', 'scarlett 2i2', 'elgato wave', 'c920s', 'c922', 'h1essential', 'h4essential', 'at2020'],
  'coffee-tea': ['whole bean', 'ground coffee', 'espresso', 'decaf', 'dark roast', 'medium roast', 'light roast', 'french roast', 'cold brew', 'earl grey', 'green tea', 'black tea', 'chai', 'matcha', 'hot cocoa', 'equal exchange'],
  'food-pantry': ['peanut butter', 'almond butter', 'flour', 'pasta', 'olive oil', 'honey', 'maple syrup', 'cheddar', 'butter', 'chocolate bar', 'granola', 'oats', 'rice', 'salsa', 'hot sauce', 'jerky', 'pickles', 'sauerkraut', 'bread', 'bagels', 'ice cream', 'broth', 'beef', 'chicken', 'bacon', 'spices', 'seasoning', 'haribo', 'jelly belly', 'ghirardelli', 'lindt', "hershey's", "reese's", 'kind', 'clif', 'cabot', 'king arthur', 'frontier', "bob's red mill", 'stonewall kitchen', 'moon ?pie', 'cheerwine', 'goo goo', 'big green egg', "stubb's", 'traeger', "sweet baby ray's", 'tabasco', 'cholula', 'jack link', 'divine', 'once again', 'real pickles', 'taharka'],
}
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\?/g, '?')
const POPULAR = Object.fromEntries(Object.entries(POPULAR_NAMES).map(([cat, names]) =>
  [cat, new RegExp(`(?<![a-z])(${names.map(escapeRe).join('|')})(?![a-z])`, 'i')]))
// Music and books from Bull Moose and Zia are titled "Artist/Album" or
// "Author/Title": match the artist or author exactly, so "Fairy Queen" isn't
// Queen and "Becoming Dr. Seuss" isn't Dr. Seuss. Other titles can't tell an
// author apart, so they only count when they name the item itself.
const BYLINE_CATEGORIES = new Set(['music', 'books'])
const popularCache = new WeakMap()
function popularName(category, p) {
  if (popularCache.has(p)) return popularCache.get(p)
  const re = POPULAR[category]
  let name = null
  if (re) {
    const title = p.title || ''
    if (BYLINE_CATEGORIES.has(category)) {
      if (title.includes('/')) {
        const byline = title.split('/')[0].trim()
        const m = re.exec(byline)
        if (m && m[0].length >= byline.replace(/^the /i, '').length - 1) name = m[1].toLowerCase()
      }
    } else {
      name = re.exec(title)?.[1]?.toLowerCase() || null
    }
  }
  popularCache.set(p, name)
  return name
}

// Round-robin through groups so one brand or artist doesn't fill a page.
function rotate(items, keyOf) {
  const groups = new Map()
  for (const p of items) {
    const k = keyOf(p)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  const qs = [...groups.values()], out = []
  for (let i = 0; qs.some(q => i < q.length); i++) for (const q of qs) if (i < q.length) out.push(q[i])
  return out
}

// Two per store per round, stores with the widest range first, so big
// general stores lead but every store appears on the first page.
function roundRobinStores(products, orderWithinStore) {
  const byStore = new Map()
  for (const p of products) {
    const k = p.store_name || p.store_url || ''
    if (!byStore.has(k)) byStore.set(k, [])
    byStore.get(k).push(p)
  }
  const queues = [...byStore.values()].map(orderWithinStore).sort((a, b) => b.length - a.length)
  const out = []
  for (let i = 0; queues.some(q => i < q.length); i += 2) for (const q of queues) out.push(...q.slice(i, i + 2))
  return out
}

function subcategoryOf(category, p) {
  const subs = SUBCATEGORIES[category]
  return subs?.find(s => productInSubcategory(p, category, s))?.slug || ''
}

// Worker co-ops, collectives and union shops: the small makers. They fill about
// one slot in five on the first pages; the rest goes to familiar brands and
// staples from the big employee-owned stores.
const SMALL_MAKER = /worker|collective|union|volunteer|multi-stakeholder|cooperative affiliated|journalist/i
const isSmallMaker = p => SMALL_MAKER.test(p.ownership_type || '')

export function mixSmallMakers(list, every = 5) {
  const makers = list.filter(isSmallMaker), others = list.filter(p => !isSmallMaker(p))
  const out = []
  let m = 0, o = 0
  while (m < makers.length || o < others.length) {
    for (let i = 0; i < every - 1 && o < others.length; i++) out.push(others[o++])
    if (m < makers.length) out.push(makers[m++])
    if (o >= others.length) { out.push(...makers.slice(m)); break }
  }
  return out
}

// Unfiltered category page order: core products before merch and parts
// (CORE_ITEM tiers), and within the core tier, popular brands and titles
// first (rotating brands), then everything else rotating subcategories, with
// small co-op makers mixed in at about one in five.
export function browseOrder(category, products) {
  const test = CORE_ITEM[category] || (() => true)
  const tiers = new Map()
  for (const p of products) {
    const v = test(p)
    const tier = v === true ? 0 : v === false ? 1 : v
    if (!tiers.has(tier)) tiers.set(tier, [])
    tiers.get(tier).push(p)
  }
  return [...tiers.keys()].sort((a, b) => a - b).flatMap(tier => {
    const items = tiers.get(tier)
    if (tier !== 0) return interleaveByStore(items)
    const popular = items.filter(p => popularName(category, p))
    const rest = items.filter(p => !popularName(category, p))
    return mixSmallMakers([
      ...roundRobinStores(popular, q => rotate(q, p => popularName(category, p))),
      ...roundRobinStores(rest, q => rotate(q, p => subcategoryOf(category, p))),
    ])
  })
}


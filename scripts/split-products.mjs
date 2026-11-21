import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SUBCATEGORIES, productInSubcategory } from '../src/lib/categories.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Title normalization ──

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
  '&lsquo;': '\u2018', '&rsquo;': '\u2019', '&ldquo;': '\u201C', '&rdquo;': '\u201D',
  '&trade;': '\u2122', '&reg;': '\u00AE', '&copy;': '\u00A9',
}

function decodeEntities(s) {
  // Named entities
  s = s.replace(/&\w+;/g, m => HTML_ENTITIES[m] || m)
  // Numeric decimal &#123;
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
  // Numeric hex &#x1F;
  s = s.replace(/&#x([\da-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
  return s
}

// Words that should stay lowercase in title case (unless first/last)
const TITLE_LOWER = new Set(['a','an','the','and','but','or','nor','for','yet','so','in','on','at','to','by','of','up','as','is','if','it','no','vs'])

function toTitleCase(s) {
  return s.toLowerCase().replace(/\b\w+/g, (word, i) => {
    if (i > 0 && TITLE_LOWER.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
}

function normalizeTitle(title) {
  if (!title) return title
  // Decode HTML entities
  title = decodeEntities(title)
  // Convert ALL CAPS to Title Case (only if entire title is uppercase and > 5 chars)
  if (title.length > 5 && title === title.toUpperCase() && /[A-Z]/.test(title)) {
    title = toTitleCase(title)
  }
  // Collapse whitespace
  title = title.replace(/\s+/g, ' ').trim()
  return title
}

const REMAP = {
  'Home & Garden': 'Home Goods & Services',
  'Home Goods': 'Home Goods & Services',
  'Chocolate & Sweets': 'Food & Pantry',
  'Food & Pantry': 'Food & Pantry',
  'Books & Media': 'Books',
  'Sporting Goods': 'Sporting Goods & Outdoors',
  'Beauty & Personal Care': 'Personal Care',
  'Home & Kitchen': 'Home Goods & Services',
  'Clothing & Shoes': 'Apparel',
  'Clothing': 'Apparel',
  'Accessories': 'Apparel',
  'Art': 'Art & Prints',
}

// Store category paths (e.g. Scheels' "accessories > bath & body > soap")
// that say more than the store-level section does. First matching prefix wins.
const CATEGORY_PATH_RULES = [
  ['accessories > bath & body', 'Personal Care'],
  ['home & yard > food & drink', 'Food & Pantry'],
  ['home & yard > toys & games > game room', 'Sporting Goods & Outdoors'],
  ['home & yard > toys & games > outdoor play', 'Sporting Goods & Outdoors'],
  ['home & yard > toys & games', 'Games'],
  ['home & yard > outdoor cooking > seasonings, spices & sauces', 'Food & Pantry'],
  ['home & yard > food processing > seasonings & kits', 'Food & Pantry'],
  ['home & yard > outdoor cooking', 'Home Goods & Services'],
  ['home & yard > electronics', 'Tech & Software'],
]

// Scheels files a lot of non-clothing under Apparel (strollers, saw blades,
// coolers, keychains). Route it by the store's category path. Only applied to
// products in Apparel; first match wins, and the keep-in-Apparel rules come
// first because hiking clothes and boots live under "activities > camp & hike".
const APPAREL_PATH_RULES = [
  [/^activities > (workwear|camp & hike > hiking (clothing|footwear)|climbing gear > climbing shoes|track & field equipment > track & field shoes|padel gear > padel shoes)/, 'Apparel'],
  [/^accessories > (stickers & patches|lanyards & keychains|clothing wash|umbrellas|jewelry)/, 'Home Goods & Services'],
  [/^accessories > hair accessories > hair care/, 'Personal Care'],
  [/^accessories > (swim accessories|cooling gear)/, 'Sporting Goods & Outdoors'],
  [/^activities > /, 'Sporting Goods & Outdoors'],
  [/^baby clothing & accessories > nursery & gear/, 'Home Goods & Services'],
  [/^home & yard > /, 'Home Goods & Services'],
  [/^fan shop > [^>]+ > [^>]*home & yard/, 'Home Goods & Services'],
  [/^pheasants forever/, 'Sporting Goods & Outdoors'],
]

// Fan shop "accessories" mix hats and scarves with lanyards and car emblems.
const FAN_ACCESSORIES = /^fan shop > [^>]+ > [^>]*accessories/

// Mast General's feed has no category paths, so anything left in Apparel that
// isn't a clothing item is sorted by title, defaulting to Home Goods.
const MAST_TITLE_RULES = [
  [/\b(cookbooks?|books?|guide|handbook|almanac|calendar)\b/i, 'Books'],
  [/\b(toys?|putty|slinky|puzzles?|playing cards|kites?|yo-?yo)\b/i, 'Games'],
  [/\b(knife|knives|axe|hatchet|flashlights?|headlamps?|tents?|hammocks?|trekking|hiking|poles?|carabiners?|stoves?|coolers?|compass|whistle|sharpeners?|multi-?tool|maps?|binoculars?|fishing)\b/i, 'Sporting Goods & Outdoors'],
  [/\b(pancake|mix|preserves|grits|salsa|gum|mints|cornmeal)\b/i, 'Food & Pantry'],
  [/\b(cologne|perfume|razor|shave|lip balm)\b/i, 'Personal Care'],
]

const isClothing = p => SUBCATEGORIES.apparel.some(sub => productInSubcategory(p, 'apparel', sub))

const SECTIONS = {
  'Coffee & Tea': 'coffee-tea',
  'Media & Publishing': 'media-publishing',
  'Books': 'books',
  'Movies & TV': 'movies-tv',
  'Food & Pantry': 'food-pantry',
  'Apparel': 'apparel',
  'Art & Prints': 'art-prints',
  'Music': 'music',
  'Home Goods & Services': 'home-goods',
  'Personal Care': 'personal-care',
  'Games': 'games',
  'Beer & Brewing': 'beer-brewing',
  'Tech & Software': 'tech-software',
  'Sporting Goods & Outdoors': 'sporting-goods',
}

// Product-level category detection for multi-category stores
// Overrides the store-level site_section based on product title keywords
// Whole words only, so "Flip Sip Mug" isn't lip care and "Cast Iron Lid" isn't
// an iron supplement. Medicine comes first (vitamin gummies aren't candy), then
// dishware and cookware so a "Coffee Mug" or "Candle Holder" doesn't land in
// Food or Personal Care.
const PRODUCT_CATEGORY_RULES = [
  { match: /\b(multivitamins?|vitamins?|multi ?gummies|gummies(?![^]*\bcandy)|dietary|wound|dressings|elderberry|immune|supplements?|probiotics?|omega|calcium|zinc|magnesium|biotin|melatonin|collagen|fiber|medicines?|ear candles?|tylenol|advil|ibuprofen|aspirin|antacids?|allergy|cough|pain relief|first aid|bandages?|gauze|thermometers?)\b/i, section: 'Personal Care' },
  { match: /\b(mugs?|tumblers?|cups?|(shot|wine|pint|drinking) glass(es)?|glassware|plates?|bowls?|cast iron|skillets?|pans?|dutch ovens?|candles?|candle holders?|ornaments?|magnets?|stickers?|signs?|frames?|coasters?|towels?|blankets?|pillows?|vases?|planters?|decor)\b/i, section: 'Home Goods & Services' },
  { match: /\b(cand(y|ies)|gumm(y|ies)|chocolates?|pez|snacks?|jerky|cookies?|fudge|jams?|jell(y|ies)|honey|sauces?|seasonings?|spices?|syrups?|maple (syrup|cream|candy|sugar)|butter|pretzels?|chips|popcorn|salt|sugar|pickles?|relish|mustard|dressing|vinegar|nuts|trail mix|granola|cereal|food|baking|flour|olive oil|bbq|rubs?|marinades?|coffee|teas?)\b/i, section: 'Food & Pantry' },
  { match: /\b(soaps?|lotions?|creams?|shampoos?|conditioners?|balms?|lip (balm|gloss|butter)|sunscreen|deodorants?|bath|body wash|moisturi\w+|cleansers?|serums?|toners?|face wash|skin ?care|shav(e|ing))\b/i, section: 'Personal Care' },
  { match: /\b(toys?|games?|puzzles?|dolls?|stuffed|plush|lego|playsets?|action figures?)\b/i, section: 'Games' },
  { match: /\b(books?|journals?|notebooks?|novels?)\b/i, section: 'Books' },
  { match: /\b(diapers?|formula|pacifiers?|sippy)\b/i, section: 'Personal Care' },
]

// Stores that need product-level categorization (large multi-category stores)
const MULTI_CATEGORY_STORES = new Set(['Mast General Store', 'Thrifty White Pharmacy'])

// Human-readable format labels from raw tag values
const FORMAT_LABELS = {
  'vinyl lp': 'Vinyl', 'vinyl 7"': 'Vinyl 7"', 'vinyl 12"': 'Vinyl 12"',
  'vinyl 10"': 'Vinyl 10"', 'vinyl 3" mini record': 'Vinyl 3"',
  'audio cd': 'CD', 'audio cd single': 'CD Single', 'audio cd box set': 'CD Box Set',
  'audio cd-r (made on demand)': 'CD-R', 'audio cassette': 'Cassette',
  'audio sacd': 'SACD', 'audio blu-ray': 'Blu-ray Audio',
  'dvd': 'DVD', 'dvd audio': 'DVD Audio', 'dvd/cd combo': 'DVD/CD',
  'blu-ray': 'Blu-ray', 'blu-ray 3d': 'Blu-ray 3D', 'blu-ray 3d combo': 'Blu-ray 3D',
  'blu-ray made-on-demand': 'Blu-ray MOD', 'blu-ray/dvd combo': 'Blu-ray/DVD',
  '4k ultra hd': '4K UHD', 'vhs video cassette': 'VHS', 'laserdisc': 'Laserdisc',
  'book - paperback': 'Paperback', 'book - hardcover': 'Hardcover',
  'book - mass market paperback': 'Mass Market', 'book - paperback box set': 'Paperback Box Set',
  'book - hardcover box set': 'Hardcover Box Set', 'book - spiral paperback': 'Spiral',
}

// Tags that represent formats (not genres/categories)
const FORMAT_TAGS = new Set(Object.keys(FORMAT_LABELS))

function getFormatLabel(tags) {
  if (!tags) return null
  for (const t of tags) {
    if (FORMAT_LABELS[t]) return FORMAT_LABELS[t]
  }
  return null
}

function groupProducts(products) {
  const groups = new Map()

  for (const p of products) {
    // Group key: normalized title + store
    const key = (p.title || '').toLowerCase().trim() + '||' + (p.store_name || '')
    const format = getFormatLabel(p.tags)

    if (!groups.has(key)) {
      groups.set(key, {
        ...p,
        formats: format ? [{ label: format, price: p.price, url: p.url }] : [],
        _prices: [parseFloat(p.price) || 0],
      })
    } else {
      const g = groups.get(key)
      if (format && !g.formats.some(f => f.label === format)) {
        g.formats.push({ label: format, price: p.price, url: p.url })
      }
      g._prices.push(parseFloat(p.price) || 0)
      // Keep best image (prefer non-null)
      if (!g.image && p.image) g.image = p.image
      // Merge tags
      if (p.tags) {
        const existing = new Set(g.tags || [])
        for (const t of p.tags) {
          if (!existing.has(t)) { g.tags = [...(g.tags || []), t]; existing.add(t) }
        }
      }
      // Keep available if any format is available
      if (p.available !== false) g.available = true
    }
  }

  // Finalize groups
  const result = []
  for (const g of groups.values()) {
    // Sort formats by price
    if (g.formats.length > 1) {
      g.formats.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
      g.price = g.formats[0].price // lowest price
    }
    delete g._prices
    if (g.formats.length <= 1) delete g.formats // no need for single-format entries
    result.push(g)
  }

  return result
}

// ── Main ──

const productsPath = resolve(root, 'public/data/products.json')
if (!existsSync(productsPath)) {
  console.log('products.json not found — skipping split (using pre-built data files)')
  process.exit(0)
}

const products = JSON.parse(readFileSync(productsPath, 'utf-8'))

// Normalize titles: decode HTML entities, fix ALL CAPS
let normalized = 0
for (const p of products) {
  const orig = p.title
  p.title = normalizeTitle(p.title)
  if (p.title !== orig) normalized++
}
if (normalized > 0) console.log(`Normalized ${normalized} product titles`)

let remapped = 0
for (const p of products) {
  if (REMAP[p.site_section]) {
    p.site_section = REMAP[p.site_section]
    remapped++
  }
}

if (remapped > 0) {
  console.log(`Remapped ${remapped} products to correct sections`)
}

// Tech co-ops sell services, not products. Give each Tech & Software company in
// the directory a service listing (linking to its site) so the category shows
// services next to the Scheels gadgets.
const SERVICE_DETAILS = {
  'JMP.chat': { label: 'Phone Number Service', price: '4.99', priceSuffix: '/mo' },
  'Loomio': { label: 'Group Decision-Making Software' },
  'ReVision Energy': { label: 'Solar, Heat Pumps & Batteries' },
}
const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase())
const directory = JSON.parse(readFileSync(resolve(root, 'src/data/marketplace.json'), 'utf-8'))
let servicesAdded = 0
for (const e of directory.filter(e => e.site_section === 'Tech & Software')) {
  const id = 'synth-svc-' + e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const detail = SERVICE_DETAILS[e.name] || {}
  const listing = {
    id, title: `${e.name} — ${detail.label || titleCase(e.category || 'Services')}`,
    price: detail.price || null, ...(detail.priceSuffix && { priceSuffix: detail.priceSuffix }),
    available: true, image: null, url: e.url, store_name: e.name, store_url: e.url,
    ownership_type: e.ownership_type, site_section: 'Tech & Software', tags: ['service'],
  }
  const i = products.findIndex(p => p.id === id)
  if (i === -1) { products.push(listing); servicesAdded++ }
  else if (JSON.stringify(products[i]) !== JSON.stringify(listing)) { products[i] = listing; servicesAdded++ }
}
if (servicesAdded > 0) console.log(`Added or updated ${servicesAdded} tech service listings`)

// Hand-made subscription entries (news sites, podcasts, Means TV) belong with
// the other independent media, not on the Books shelf.
let mediaMoved = 0
for (const p of products) {
  const isMediaSub = (p.tags || []).includes('news-subscription') || String(p.id).startsWith('synth-maxfunstudio')
  if (isMediaSub && p.site_section !== 'Media & Publishing') {
    p.site_section = 'Media & Publishing'
    mediaMoved++
  }
}
if (mediaMoved > 0) console.log(`Moved ${mediaMoved} subscriptions to Media & Publishing`)

let pathRemapped = 0
for (const p of products) {
  const path = (p.tags || []).find(t => t.includes(' > '))?.toLowerCase()
  if (!path) continue
  const rule = CATEGORY_PATH_RULES.find(([prefix]) => path.startsWith(prefix))
  if (rule && p.site_section !== rule[1]) {
    p.site_section = rule[1]
    pathRemapped++
  }
}
if (pathRemapped > 0) console.log(`Remapped ${pathRemapped} products by store category path`)

// Scheels commemorative coins, signed photos and plaques are keepsakes, not gear.
let collectiblesMoved = 0
for (const p of products) {
  const path = (p.tags || []).find(t => t.includes(' > '))?.toLowerCase()
  if (path && /^fan shop > ([^>]+ > )?[^>]*collectibles/.test(path) && p.site_section !== 'Home Goods & Services') {
    p.site_section = 'Home Goods & Services'
    collectiblesMoved++
  }
}
if (collectiblesMoved > 0) console.log(`Moved ${collectiblesMoved} fan collectibles to Home Goods`)

// Coffee roasters whose whole catalog was filed under Food.
const COFFEE_STORES = new Set(['Gimme! Coffee', 'Just Us! Coffee Roasters'])
let coffeeMoved = 0
for (const p of products) {
  if (COFFEE_STORES.has(p.store_name) && p.site_section === 'Food & Pantry') {
    p.site_section = 'Coffee & Tea'
    coffeeMoved++
  }
}
if (coffeeMoved > 0) console.log(`Moved ${coffeeMoved} coffee roaster products to Coffee & Tea`)

// Product-level categorization for multi-category stores
let recategorized = 0
for (const p of products) {
  if (!MULTI_CATEGORY_STORES.has(p.store_name)) continue
  const title = p.title || ''
  for (const rule of PRODUCT_CATEGORY_RULES) {
    if (rule.match.test(title)) {
      if (p.site_section !== rule.section) {
        p.site_section = rule.section
        recategorized++
      }
      break
    }
  }
}
if (recategorized > 0) {
  console.log(`Recategorized ${recategorized} products from multi-category stores`)
}

let apparelMoved = 0
for (const p of products) {
  if (p.site_section !== 'Apparel') continue
  const path = (p.tags || []).find(t => t.includes(' > '))?.toLowerCase()
  let section = null
  if (path) {
    section = APPAREL_PATH_RULES.find(([re]) => re.test(path))?.[1] || null
    if (!section && FAN_ACCESSORIES.test(path) && !isClothing(p)) section = 'Home Goods & Services'
  } else if (p.store_name === 'Mast General Store' && !isClothing(p)) {
    section = MAST_TITLE_RULES.find(([re]) => re.test(p.title || ''))?.[1] || 'Home Goods & Services'
  }
  if (section && section !== p.site_section) {
    p.site_section = section
    apparelMoved++
  }
}
if (apparelMoved > 0) console.log(`Moved ${apparelMoved} non-clothing products out of Apparel`)

if (remapped > 0 || servicesAdded > 0 || mediaMoved > 0 || coffeeMoved > 0 || collectiblesMoved > 0 || pathRemapped > 0 || recategorized > 0 || apparelMoved > 0) {
  writeFileSync(resolve(root, 'public/data/products.json'), JSON.stringify(products))
}

// ── Per-category files (grouped) ──

let totalGrouped = 0
let totalOriginal = 0

for (const [sectionName, slug] of Object.entries(SECTIONS)) {
  const sectionProducts = products.filter(p => p.site_section === sectionName)
  const grouped = groupProducts(sectionProducts)
  writeFileSync(
    resolve(root, `public/data/products-${slug}.json`),
    JSON.stringify(grouped)
  )
  totalOriginal += sectionProducts.length
  totalGrouped += grouped.length
  const saved = sectionProducts.length - grouped.length
  const suffix = saved > 0 ? ` (${saved} grouped)` : ''
  console.log(`products-${slug}.json: ${grouped.length} products${suffix}`)
}

if (totalOriginal > totalGrouped) {
  console.log(`Format grouping: ${totalOriginal} → ${totalGrouped} (${totalOriginal - totalGrouped} duplicates merged)`)
}

// ── Compact search index ──
// Two-tier: lightweight index for matching (small), full data for display (loaded on demand).

// Build store index — group products by store to compute URL prefixes
const storeMap = new Map()
const storeList = []
const storeProducts = new Map() // storeKey -> [products]
for (const p of products) {
  const key = `${p.store_name}||${p.store_url}||${p.ownership_type}`
  if (!storeMap.has(key)) {
    storeMap.set(key, storeList.length)
    storeList.push({ n: p.store_name, u: p.store_url, o: p.ownership_type })
    storeProducts.set(key, [])
  }
  storeProducts.get(key).push(p)
}

// Compute common URL and image prefixes per store
function commonPrefix(strings) {
  const valid = strings.filter(Boolean)
  if (valid.length === 0) return ''
  let prefix = valid[0]
  for (let i = 1; i < valid.length; i++) {
    while (!valid[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (!prefix) return ''
    }
  }
  // Trim to last slash for clean prefix
  const lastSlash = prefix.lastIndexOf('/')
  return lastSlash > 8 ? prefix.slice(0, lastSlash + 1) : ''
}

for (const [key, prods] of storeProducts) {
  const idx = storeMap.get(key)
  const urlPrefix = commonPrefix(prods.map(p => p.url))
  const imgPrefix = commonPrefix(prods.filter(p => p.image).map(p => p.image))
  if (urlPrefix.length > 10) storeList[idx].up = urlPrefix
  if (imgPrefix.length > 10) storeList[idx].ip = imgPrefix
}

// Group for search
const searchGrouped = groupProducts(products)

// Build tag dictionary — frequency-sorted for compact IDs
const tagFreq = new Map()
for (const p of searchGrouped) {
  for (const t of (p.tags || []).filter(t => !FORMAT_TAGS.has(t))) {
    tagFreq.set(t, (tagFreq.get(t) || 0) + 1)
  }
}
const tagDict = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
const tagToId = new Map(tagDict.map((t, i) => [t, i]))

// Full product data — used to hydrate search results for display
// Format: [title, price, image, url, storeIdx, sectionIdx, tagIds, available?, formats?]
// - ID is implicit (array index)
// - Tags are numeric IDs into searchData.t dictionary
// - Section is numeric index into searchData.c dictionary
// - Price is a number (not string)
// - Available field omitted when true (default)
// - URLs/images have store prefix stripped (reconstructed client-side)
const sectionDict = [...new Set(searchGrouped.map(p => p.site_section))]
const sectionToIdx = new Map(sectionDict.map((s, i) => [s, i]))

const fullProducts = searchGrouped.map(p => {
  const storeKey = `${p.store_name}||${p.store_url}||${p.ownership_type}`
  const storeIdx = storeMap.get(storeKey)
  const store = storeList[storeIdx]
  const url = store.up && p.url?.startsWith(store.up) ? p.url.slice(store.up.length) : (p.url || '')
  const img = store.ip && p.image?.startsWith(store.ip) ? p.image.slice(store.ip.length) : (p.image || '')
  const price = parseFloat(p.price) || 0
  const tags = (p.tags || []).filter(t => !FORMAT_TAGS.has(t)).map(t => tagToId.get(t)).filter(id => id !== undefined)
  const entry = [
    p.title,
    price,
    img,
    url,
    storeIdx,
    sectionToIdx.get(p.site_section),
    tags.length > 0 ? tags : 0,
  ]
  if (p.available === false) entry.push(0)
  if (p.formats) {
    if (entry.length < 8) entry.push(1) // available placeholder
    entry.push(p.formats)
  }
  return entry
})

const searchData = { s: storeList, t: tagDict, c: sectionDict, p: fullProducts }
const searchJson = JSON.stringify(searchData)
writeFileSync(resolve(root, 'public/data/search.json'), searchJson)

const sizeMB = (Buffer.byteLength(searchJson) / 1024 / 1024).toFixed(1)
console.log(`search.json: ${searchGrouped.length} products (${sizeMB} MB), ${tagDict.length} unique tags`)

// ── Store summary files for large stores ──
// Group products by store, and for stores with 500+ products generate a
// representative cross-section organized by subcategory.

const byStore = new Map()
for (const p of products) {
  const key = slugify(p.store_name)
  if (!byStore.has(key)) byStore.set(key, [])
  byStore.get(key).push(p)
}

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Pick representative products: sample across subcategories, prefer items with images
function inferCategory(p) {
  // Use category path from tags if it looks like a category (contains >)
  const catTag = (p.tags || []).find(t => t.includes(' > ') || t.includes(' › '))
  if (catTag) return catTag.split(' > ').pop().split(' › ').pop().trim()

  // Use site_section + title keywords to infer subcategory
  const title = (p.title || '').toLowerCase()
  const section = p.site_section || ''

  if (section.includes('Apparel') || section.includes('Clothing')) {
    if (/\bboot|shoe|sneaker|sandal|clog|slipper|loafer/i.test(title)) return 'Shoes & Footwear'
    if (/\bjacket|coat|vest|parka|fleece/i.test(title)) return 'Jackets & Outerwear'
    if (/\bshirt|tee |t-shirt|polo|tank |blouse|top /i.test(title)) return 'Shirts & Tops'
    if (/\bpant|jean|short|legging|bottom/i.test(title)) return 'Pants & Bottoms'
    if (/\bhat|cap |beanie|visor/i.test(title)) return 'Hats & Caps'
    if (/\bsock|underwear|bra /i.test(title)) return 'Undergarments'
    if (/\bdress|skirt|romper/i.test(title)) return 'Dresses & Skirts'
    if (/\bhoodie|sweatshirt|pullover|sweater/i.test(title)) return 'Hoodies & Sweaters'
    return 'Apparel'
  }
  if (section.includes('Sporting')) {
    if (/\bfish|rod|reel|lure|tackle/i.test(title)) return 'Fishing'
    if (/\bgolf|putter|driver|wedge|iron /i.test(title)) return 'Golf'
    if (/\bbike|cycling|helmet|pedal/i.test(title)) return 'Cycling'
    if (/\btent|camp|hike|backpack|sleeping/i.test(title)) return 'Camp & Hike'
    if (/\bbaseball|bat |glove|mitt/i.test(title)) return 'Baseball & Softball'
    if (/\bbasketball|soccer|football|volleyball|hockey/i.test(title)) return 'Team Sports'
    if (/\brunning|trail/i.test(title)) return 'Running'
    if (/\bski|snowboard|snow /i.test(title)) return 'Winter Sports'
    if (/\bkayak|paddle|swim|water/i.test(title)) return 'Water Sports'
    if (/\bfitness|weight|yoga|exercise|dumbbell/i.test(title)) return 'Fitness'
    if (/\bgun|ammo|rifle|pistol|shotgun|holster/i.test(title)) return 'Shooting & Hunting'
    return 'Sporting Goods'
  }
  if (section.includes('Home')) {
    if (/\btoy|lego|puzzle|game|plush/i.test(title)) return 'Toys & Games'
    if (/\bgrill|smoker|charcoal|bbq/i.test(title)) return 'Outdoor Cooking'
    if (/\bdog|cat|pet /i.test(title)) return 'Pet Supplies'
    if (/\bmug|cup|tumbler|water bottle|drinkware/i.test(title)) return 'Drinkware'
    return 'Home & Yard'
  }
  // For other stores, use the first non-brand tag
  const tag = (p.tags || []).find(t => t.length > 3 && !['esop', 'worker co-op', 'cooperative'].includes(t))
  return tag || section || 'Other'
}

function buildStoreSummary(storeProducts) {
  const byCat = new Map()
  for (const p of storeProducts) {
    const cat = inferCategory(p)
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(p)
  }

  // Sort categories by size (biggest first)
  const sortedCats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)

  // Build sections: take top categories, sample products from each
  const sections = []
  const usedIds = new Set()
  const TARGET_TOTAL = 144
  const MAX_SECTIONS = 12
  const MIN_PER_SECTION = 4

  const topCats = sortedCats.slice(0, MAX_SECTIONS)
  // Round to multiple of 4 so the grid has no gaps on 2/3/4 column layouts
  const rawPerSection = Math.max(MIN_PER_SECTION, Math.floor(TARGET_TOTAL / topCats.length))
  const perSection = Math.floor(rawPerSection / 4) * 4 || 4

  for (const [catName, catProducts] of topCats) {
    // Prefer products with images, then sort by price (show range)
    const withImage = catProducts.filter(p => p.image)
    const pool = withImage.length >= perSection ? withImage : catProducts

    // Sample evenly: sort by price, pick evenly spaced
    const sorted = [...pool].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))
    const step = Math.max(1, Math.floor(sorted.length / perSection))
    const picked = []
    for (let i = 0; i < sorted.length && picked.length < perSection; i += step) {
      if (!usedIds.has(sorted[i].id)) {
        picked.push(sorted[i])
        usedIds.add(sorted[i].id)
      }
    }

    if (picked.length > 0) {
      // Clean up category name for display
      const label = catName.replace(/^all > /i, '').replace(/ > /g, ' › ')
      sections.push({ label, count: catProducts.length, products: picked })
    }
  }

  return sections
}

let storeSummaryCount = 0
const storeDir = resolve(root, 'public/data/stores')
import { mkdirSync } from 'fs'
try { mkdirSync(storeDir, { recursive: true }) } catch {}

const STORE_PAGE_SIZE = 100
const MAX_STORE_PAGES_PER_SECTION = 10

for (const [storeSlug, storeProducts] of byStore) {
  if (storeProducts.length < 500) continue
  const summary = buildStoreSummary(storeProducts)
  const totalShown = summary.reduce((n, s) => n + s.products.length, 0)

  // Generate per-section paginated files for "View all" pages
  const sectionIndex = []
  const storeSubdir = resolve(storeDir, storeSlug)
  try { mkdirSync(storeSubdir, { recursive: true }) } catch {}

  // Group all products by their inferred category
  const allByCat = new Map()
  for (const p of storeProducts) {
    const cat = inferCategory(p)
    if (!allByCat.has(cat)) allByCat.set(cat, [])
    allByCat.get(cat).push(p)
  }

  for (const section of summary) {
    const sectionSlug = section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const allProducts = allByCat.get(section.label) || allByCat.get(
      [...allByCat.keys()].find(k => k.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === sectionSlug)
    ) || []

    const totalPages = Math.min(Math.ceil(allProducts.length / STORE_PAGE_SIZE), MAX_STORE_PAGES_PER_SECTION)
    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * STORE_PAGE_SIZE
      const pageProducts = allProducts.slice(start, start + STORE_PAGE_SIZE)
      writeFileSync(
        resolve(storeSubdir, `${sectionSlug}-${page}.json`),
        JSON.stringify({ products: pageProducts, total: allProducts.length, page, totalPages })
      )
    }
    sectionIndex.push({ slug: sectionSlug, label: section.label, count: section.count, totalPages })
  }

  writeFileSync(
    resolve(storeDir, `${storeSlug}.json`),
    JSON.stringify({ total: storeProducts.length, sections: summary, sectionIndex })
  )
  storeSummaryCount++
  console.log(`store/${storeSlug}.json: ${totalShown} featured across ${summary.length} categories (${storeProducts.length} total), ${sectionIndex.reduce((n,s) => n + s.totalPages, 0)} pages`)
}
if (storeSummaryCount > 0) {
  console.log(`Generated ${storeSummaryCount} store summary files`)
}

console.log('Split complete.')

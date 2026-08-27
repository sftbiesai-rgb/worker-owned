import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const REMAP = {
  'Home & Garden': 'Home Goods & Services',
  'Chocolate & Sweets': 'Food & Pantry',
  'Books & Media': 'Books',
}

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
const PRODUCT_CATEGORY_RULES = [
  { match: /candy|gummy|chocolate|pez|snack|jerky|cookie|fudge|jam|jelly|honey|sauce|seasoning|spice|syrup|butter|pretzel|chip|popcorn|salt |sugar|pickle|relish|mustard|dressing|vinegar|nuts|trail mix|granola|cereal|food|baking|flour|olive oil|hot sauce|bbq|rub |marinade|coffee|tea /i, section: 'Food & Pantry' },
  { match: /soap|lotion|cream|shampoo|conditioner|balm|lip |sunscreen|deodorant|bath|body wash|candle|moistur|cleanser|serum|toner|face |skin/i, section: 'Personal Care' },
  { match: /vitamin|supplement|probiotic|mineral|omega|calcium|iron|zinc|magnesium|biotin|melatonin|collagen|fiber|medicine|tylenol|advil|ibuprofen|aspirin|antacid|allergy|cough|cold |pain relief|first aid|bandage|gauze|thermometer/i, section: 'Personal Care' },
  { match: /toy |toys|game|puzzle|doll|stuffed|plush|lego|playset|action figure/i, section: 'Games' },
  { match: /book |books|journal|notebook|novel /i, section: 'Books' },
  { match: /mug|cup |glass |plate|bowl|towel|blanket|pillow|ornament|magnet|sticker|sign |frame|decor|pot |planter|vase|coaster/i, section: 'Home Goods & Services' },
  { match: /diaper|baby|infant|formula|pacifier|sippy/i, section: 'Personal Care' },
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

const products = JSON.parse(readFileSync(resolve(root, 'public/data/products.json'), 'utf-8'))

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

if (remapped > 0 || recategorized > 0) {
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

// Build store index
const storeMap = new Map()
const storeList = []
for (const p of products) {
  const key = `${p.store_name}||${p.store_url}||${p.ownership_type}`
  if (!storeMap.has(key)) {
    storeMap.set(key, storeList.length)
    storeList.push({ n: p.store_name, u: p.store_url, o: p.ownership_type })
  }
}

// Group for search
const searchGrouped = groupProducts(products)

// Full product data — used to hydrate search results for display
// Format: [id, title, price, image, url, storeIdx, sectionName, tags, available, formats?]
const fullProducts = searchGrouped.map(p => {
  const storeKey = `${p.store_name}||${p.store_url}||${p.ownership_type}`
  const entry = [
    p.id,
    p.title,
    p.price || '',
    p.image || '',
    p.url,
    storeMap.get(storeKey),
    p.site_section,
    (p.tags || []).filter(t => !FORMAT_TAGS.has(t)),
    p.available === false ? 0 : 1,
  ]
  if (p.formats) entry.push(p.formats)
  return entry
})

const searchData = { s: storeList, p: fullProducts }
const searchJson = JSON.stringify(searchData)
writeFileSync(resolve(root, 'public/data/search.json'), searchJson)

const sizeMB = (Buffer.byteLength(searchJson) / 1024 / 1024).toFixed(1)
console.log(`search.json: ${searchGrouped.length} products (${sizeMB} MB)`)

console.log('Split complete.')

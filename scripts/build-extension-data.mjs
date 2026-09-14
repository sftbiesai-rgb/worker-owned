// Generates category-map.json for the Chrome extension.
// Maps Amazon breadcrumb categories to WorkerOwned sections with product counts and store names.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const productsPath = resolve(root, 'public/data/products.json')
if (!existsSync(productsPath)) {
  console.log('products.json not found — skipping extension data build')
  process.exit(0)
}

const products = JSON.parse(readFileSync(productsPath, 'utf-8'))

// Amazon breadcrumb text → WorkerOwned section slug
// Multiple Amazon categories can map to the same section
const AMAZON_TO_SECTION = {
  // Books
  'Books': 'books',
  'Kindle Store': 'books',
  'Kindle eBooks': 'books',
  'Audible Books & Originals': 'books',
  // Music
  'CDs & Vinyl': 'music',
  'Digital Music': 'music',
  // Movies & TV
  'Movies & TV': 'movies-tv',
  'Blu-ray': 'movies-tv',
  'DVD': 'movies-tv',
  'Prime Video': 'movies-tv',
  // Games
  'Video Games': 'games',
  'Toys & Games': 'games',
  'Board Games': 'games',
  'Card Games': 'games',
  // Sporting Goods
  'Sports & Outdoors': 'sporting-goods',
  'Exercise & Fitness': 'sporting-goods',
  'Cycling': 'sporting-goods',
  'Hunting & Fishing': 'sporting-goods',
  // Apparel
  'Clothing, Shoes & Jewelry': 'apparel',
  'Women\'s Fashion': 'apparel',
  'Men\'s Fashion': 'apparel',
  'Girls\' Fashion': 'apparel',
  'Boys\' Fashion': 'apparel',
  'Luggage': 'apparel',
  // Food & Pantry
  'Grocery & Gourmet Food': 'food-pantry',
  'Pantry Staples': 'food-pantry',
  // Coffee & Tea
  'Coffee': 'coffee-tea',
  'Tea': 'coffee-tea',
  'Coffee, Tea & Espresso': 'coffee-tea',
  // Personal Care
  'Beauty & Personal Care': 'personal-care',
  'Health & Household': 'personal-care',
  'Vitamins & Dietary Supplements': 'personal-care',
  'Health, Household & Baby Care': 'personal-care',
  // Home Goods
  'Home & Kitchen': 'home-goods',
  'Kitchen & Dining': 'home-goods',
  'Arts, Crafts & Sewing': 'home-goods',
  'Handmade Products': 'home-goods',
  'Garden & Outdoor': 'home-goods',
  // Beer & Brewing
  'Beer, Wine & Spirits': 'beer-brewing',
  // Tech & Software
  'Software': 'tech-software',
  'Apps & Games': 'tech-software',
}

// Section slug → display label
const SECTION_LABELS = {
  'coffee-tea': 'Coffee & Tea',
  'media-publishing': 'Media & Publishing',
  'books': 'Books',
  'movies-tv': 'Movies & TV',
  'food-pantry': 'Food & Pantry',
  'apparel': 'Apparel',
  'art-prints': 'Art & Prints',
  'music': 'Music',
  'home-goods': 'Home Goods & Services',
  'personal-care': 'Personal Care',
  'games': 'Games',
  'beer-brewing': 'Beer & Brewing',
  'tech-software': 'Tech & Software',
  'sporting-goods': 'Sporting Goods & Outdoors',
}

// Section slug → section name in products.json
const SECTION_NAMES = {
  'coffee-tea': 'Coffee & Tea',
  'media-publishing': 'Media & Publishing',
  'books': 'Books',
  'movies-tv': 'Movies & TV',
  'food-pantry': 'Food & Pantry',
  'apparel': 'Apparel',
  'art-prints': 'Art & Prints',
  'music': 'Music',
  'home-goods': 'Home Goods & Services',
  'personal-care': 'Personal Care',
  'games': 'Games',
  'beer-brewing': 'Beer & Brewing',
  'tech-software': 'Tech & Software',
  'sporting-goods': 'Sporting Goods & Outdoors',
}

// Build section stats from products
const sectionStats = {}

for (const p of products) {
  const sectionName = p.site_section
  // Find the slug for this section name
  const slug = Object.entries(SECTION_NAMES).find(([, name]) => name === sectionName)?.[0]
  if (!slug) continue

  if (!sectionStats[slug]) {
    sectionStats[slug] = { count: 0, stores: new Map() }
  }
  sectionStats[slug].count++

  const storeName = p.store_name
  if (!sectionStats[slug].stores.has(storeName)) {
    sectionStats[slug].stores.set(storeName, { count: 0, ownershipType: p.ownership_type })
  }
  sectionStats[slug].stores.get(storeName).count++
}

// Build the sections object
const sections = {}
for (const [slug, stats] of Object.entries(sectionStats)) {
  // Sort stores by product count, take top 6
  const sortedStores = [...stats.stores.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)

  sections[slug] = {
    label: SECTION_LABELS[slug],
    count: stats.count,
    storeCount: stats.stores.size,
    stores: sortedStores.map(([name, info]) => ({
      name,
      ownershipType: info.ownershipType,
    })),
    url: `/marketplace/${slug}`,
  }
}

const categoryMap = {
  amazonCategories: AMAZON_TO_SECTION,
  sections,
}

// Write to both extension bundle (fallback) and public/data (live, fetched by extension)
const outPaths = [
  resolve(root, 'extension/data/category-map.json'),
  resolve(root, 'public/data/category-map.json'),
]
for (const p of outPaths) {
  writeFileSync(p, JSON.stringify(categoryMap, null, 2))
}

const sizeKB = (Buffer.byteLength(JSON.stringify(categoryMap)) / 1024).toFixed(1)
console.log(`category-map.json: ${sizeKB} KB`)
for (const [slug, s] of Object.entries(sections)) {
  console.log(`  ${s.label}: ${s.count.toLocaleString()} products from ${s.storeCount} stores`)
}
console.log('Extension data build complete.')

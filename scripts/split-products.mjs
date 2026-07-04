import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const REMAP = {
  'Home & Garden': 'Home Goods',
  'Chocolate & Sweets': 'Food & Pantry',
  'Sporting Goods & Outdoors': 'Apparel',
}

const SECTIONS = {
  'Coffee & Tea': 'coffee-tea',
  'Media & Publishing': 'media-publishing',
  'Food & Pantry': 'food-pantry',
  'Apparel': 'apparel',
  'Art & Prints': 'art-prints',
  'Music': 'music',
  'Home Goods': 'home-goods',
  'Personal Care': 'personal-care',
  'Games': 'games',
  'Beer & Brewing': 'beer-brewing',
  'Tech & Software': 'tech-software',
}

const products = JSON.parse(readFileSync(resolve(root, 'public/data/products.json'), 'utf-8'))

let remapped = 0
for (const p of products) {
  if (REMAP[p.site_section]) {
    p.site_section = REMAP[p.site_section]
    remapped++
  }
}

if (remapped > 0) {
  writeFileSync(resolve(root, 'public/data/products.json'), JSON.stringify(products))
  console.log(`Remapped ${remapped} products to correct sections`)
}

for (const [sectionName, slug] of Object.entries(SECTIONS)) {
  const sectionProducts = products.filter(p => p.site_section === sectionName)
  writeFileSync(
    resolve(root, `public/data/products-${slug}.json`),
    JSON.stringify(sectionProducts)
  )
  console.log(`products-${slug}.json: ${sectionProducts.length} products`)
}

console.log('Split complete.')

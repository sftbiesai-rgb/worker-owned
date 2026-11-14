#!/usr/bin/env node
// One-time migration: BigCommerce products used positional IDs (115-bc-608),
// which shifted on every re-scrape. This rewrites them to the slug-based IDs
// that scrape-products.mjs now generates, and remaps the hand-picked IDs in
// build-gift-guide.mjs and featured.json by matching product URLs against a
// pre-rescrape backup of products.json.
//
// Usage: node scripts/migrate-bc-ids.mjs <old-products-backup.json> [--dry-run]

import { readFileSync, writeFileSync } from 'fs'

const BACKUP = process.argv[2]
const DRY_RUN = process.argv.includes('--dry-run')
if (!BACKUP) { console.error('Usage: node scripts/migrate-bc-ids.mjs <old-products-backup.json> [--dry-run]'); process.exit(1) }

const PRODUCTS = 'public/data/products.json'
const REFS = ['scripts/build-gift-guide.mjs', 'public/data/featured.json']
const BC = /^(\d+)-bc-\d+$/

// Same as bcId() in scrape-products.mjs
function bcId(storeId, productUrl, used) {
  const slug = new URL(productUrl).pathname.split('/').filter(Boolean).pop()
    ?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item'
  let id = `${storeId}-bc-${slug}`
  for (let n = 2; used.has(id); n++) id = `${storeId}-bc-${slug}-${n}`
  used.add(id)
  return id
}

// Rewrite current products in scrape order, per store, so numbering of
// duplicate slugs matches what the scraper will produce next time
const products = JSON.parse(readFileSync(PRODUCTS, 'utf8'))
const usedByStore = new Map()
const newIdByUrl = new Map()
let rewritten = 0
for (const p of products) {
  const m = String(p.id ?? "").match(BC)
  if (!m) continue
  if (!usedByStore.has(m[1])) usedByStore.set(m[1], new Set())
  p.id = bcId(m[1], p.url, usedByStore.get(m[1]))
  newIdByUrl.set(p.url, p.id)
  rewritten++
}
console.log(`Rewrote ${rewritten} BigCommerce IDs across ${usedByStore.size} stores`)

// Old positional ID -> URL, from the backup taken before the re-scrape
const oldUrlById = new Map()
for (const p of JSON.parse(readFileSync(BACKUP, "utf8"))) if (BC.test(String(p.id ?? ""))) oldUrlById.set(p.id, p.url)

for (const file of REFS) {
  let text = readFileSync(file, 'utf8')
  text = text.replace(/\b\d+-bc-\d+\b/g, oldId => {
    const url = oldUrlById.get(oldId)
    const newId = url && newIdByUrl.get(url)
    console.log(`  ${file}: ${oldId} -> ${newId || 'NOT FOUND (left as is)'}`)
    return newId || oldId
  })
  if (!DRY_RUN) writeFileSync(file, text)
}

if (DRY_RUN) console.log('(dry run, nothing written)')
else { writeFileSync(PRODUCTS, JSON.stringify(products)); console.log(`Wrote ${PRODUCTS}`) }

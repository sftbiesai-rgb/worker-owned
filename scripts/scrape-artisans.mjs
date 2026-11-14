#!/usr/bin/env node
/**
 * scrape-artisans.mjs
 * Scraper for Artisans Cooperative, which moved from Shopify (artisans.coop)
 * to CS-Cart (shop.artisans.coop) in fall 2026. Old /products/<handle> links
 * now 301 to the new shop and mostly 404, so the whole store is replaced.
 *
 * Walks the CS-Cart product search listing (96 per page) and reads each grid
 * card: product id, title, link, image, price, and out-of-stock flag.
 *
 * Usage:
 *   node scripts/scrape-artisans.mjs            # scrape + replace Artisans products in products.json
 *   node scripts/scrape-artisans.mjs --dry-run  # scrape and report only
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json')
const DRY_RUN = process.argv.includes('--dry-run')

const BASE = 'https://shop.artisans.coop'
const STORE = {
  store_name: 'Artisans Cooperative',
  store_url: BASE,
  ownership_type: 'multi-stakeholder co-op',
  site_section: 'Home Goods & Services',
}
// Refuse to replace the old catalog if the scrape comes back suspiciously small
const MIN_PRODUCTS = 500
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const decode = s => s
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

function parsePage(html) {
  const products = []
  const blocks = html.split(/name="product_form_(\d+)"/)
  // split() with a capture group alternates [before, id, block, id, block, ...]
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i]
    const b = blocks[i + 1]
    const link = b.match(/class="ty-grid-list__item-name">[\s\S]*?<a href="([^"]+)"[^>]*title="([^"]*)"/)
    if (!link) continue
    const price = b.match(new RegExp(`sec_discounted_price_${id}"[^>]*>([0-9.,]+)<`))?.[1]?.replace(/,/g, '')
    const image = b.match(/srcset="([^" ]+) 2x"/)?.[1] || b.match(/<img[^>]+src="([^"]+)"/)?.[1]
    if (!price || !(parseFloat(price) > 0) || !image) continue
    products.push({
      id: `41-cs-${id}`,
      title: decode(link[2]),
      price: parseFloat(price).toFixed(2),
      available: !new RegExp(`out_of_stock_info_${id}"`).test(b),
      image,
      url: link[1],
      ...STORE,
      tags: [],
    })
  }
  return { products, total: parseInt(html.match(/Products found: ([0-9,]+)/)?.[1]?.replace(/,/g, '') || '0', 10) }
}

const seen = new Map()
let total = 0
for (let page = 1; page < 200; page++) {
  const url = `${BASE}/index.php?dispatch=products.search&search_performed=Y&q=&items_per_page=96&page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) { console.log(`page ${page}: HTTP ${res.status}, stopping`); break }
  const { products, total: found } = parsePage(await res.text())
  total ||= found
  const before = seen.size
  for (const p of products) seen.set(p.id, p)
  console.log(`page ${page}: ${products.length} cards, ${seen.size - before} new (${seen.size}/${total})`)
  if (!products.length || seen.size === before || seen.size >= total) break
  await sleep(1500)
}

const scraped = [...seen.values()]
const inStock = scraped.filter(p => p.available).length
console.log(`\nScraped ${scraped.length} of ${total} listed (${inStock} in stock)`)

if (DRY_RUN) {
  console.log(scraped.slice(0, 3))
  process.exit(0)
}
if (scraped.length < MIN_PRODUCTS || scraped.length < total * 0.8) {
  console.log(`Only ${scraped.length} products (expected ~${total}). Not replacing the existing catalog.`)
  process.exit(1)
}

const all = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'))
const kept = all.filter(p => p.store_name !== STORE.store_name)
console.log(`Replacing ${all.length - kept.length} old Artisans products with ${scraped.length}`)
writeFileSync(PRODUCTS_FILE, JSON.stringify([...kept, ...scraped]))
console.log('Wrote products.json. Run npm run build to regenerate split files.')

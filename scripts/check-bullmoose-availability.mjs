#!/usr/bin/env node
/**
 * check-bullmoose-availability.mjs
 * Checks all Bull Moose products against their product pages for current
 * availability using the schema.org/availability meta tag in static HTML.
 * Marks out-of-stock products as available:false in products.json.
 *
 * Usage:
 *   node scripts/check-bullmoose-availability.mjs              # check and update
 *   node scripts/check-bullmoose-availability.mjs --dry-run    # report only
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRODUCTS_FILE = join(__dirname, '..', 'public', 'data', 'products.json')
const DRY_RUN = process.argv.includes('--dry-run')
const CONCURRENCY = 15
const TIMEOUT_MS = 10000

const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'))
const bmProducts = products.filter(p => p.store_name === 'Bull Moose')
console.log(`Checking ${bmProducts.length} Bull Moose products for availability...`)

let checked = 0
let outOfStock = 0
let errors = 0

async function checkAvailability(product) {
  const pid = product.id.replace('176-bm-', '')
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(`https://www.bullmoose.com/p/${pid}/x`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) {
      // 404 = product removed entirely
      if (res.status === 404) {
        product.available = false
        outOfStock++
      } else {
        errors++
      }
    } else {
      const html = await res.text()
      const match = html.match(/itemprop="availability"\s+href="https:\/\/schema\.org\/(\w+)"/)
      if (match) {
        if (match[1] === 'OutOfStock' || match[1] === 'Discontinued') {
          product.available = false
          outOfStock++
        }
        // InStock, PreOrder, etc. → keep available: true
      } else {
        // No schema tag found — keep as-is, count as error
        errors++
      }
    }
  } catch (e) {
    errors++
  }

  checked++
  if (checked % 500 === 0) {
    console.log(`  ${checked}/${bmProducts.length} checked (${outOfStock} out of stock, ${errors} errors)`)
  }
}

// Process in batches
for (let i = 0; i < bmProducts.length; i += CONCURRENCY) {
  const batch = bmProducts.slice(i, i + CONCURRENCY)
  await Promise.all(batch.map(p => checkAvailability(p)))
}

console.log(`\nDone: ${checked} checked, ${outOfStock} out of stock, ${errors} errors`)

if (outOfStock > 0 && !DRY_RUN) {
  writeFileSync(PRODUCTS_FILE, JSON.stringify(products))
  console.log(`Updated products.json (${outOfStock} products marked unavailable)`)
} else if (DRY_RUN) {
  console.log('Dry run — no changes written')
}

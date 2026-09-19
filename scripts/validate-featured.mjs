#!/usr/bin/env node
/**
 * validate-featured.mjs
 * Checks all featured product image URLs and removes items with broken images.
 * Run before deploy: node scripts/validate-featured.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FEATURED_FILE = join(__dirname, '..', 'public', 'data', 'featured.json')
const TIMEOUT_MS = 8000
const dryRun = process.argv.includes('--dry-run')

const items = JSON.parse(readFileSync(FEATURED_FILE, 'utf8'))
console.log(`Checking ${items.length} featured product images...`)

async function checkImage(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeout)
    const ct = res.headers.get('content-type') || ''
    return res.status === 200 && ct.startsWith('image/')
  } catch {
    clearTimeout(timeout)
    return false
  }
}

const results = await Promise.all(items.map(async item => {
  const ok = item.image ? await checkImage(item.image) : false
  return { item, ok }
}))

const broken = results.filter(r => !r.ok)
const valid = results.filter(r => r.ok).map(r => r.item)

if (broken.length === 0) {
  console.log('All images OK.')
  process.exit(0)
}

console.log(`\nBroken images (${broken.length}):`)
for (const { item } of broken) {
  console.log(`  ${item.pick} | ${item.store_name} | ${item.title}`)
}

// Show remaining bucket counts
const buckets = {}
for (const item of valid) buckets[item.pick] = (buckets[item.pick] || 0) + 1
console.log('\nRemaining by bucket:', buckets)

if (!dryRun) {
  writeFileSync(FEATURED_FILE, JSON.stringify(valid, null, 2))
  console.log(`\nRemoved ${broken.length} items. ${valid.length} remaining.`)
} else {
  console.log(`\n[dry run] Would remove ${broken.length} items.`)
}

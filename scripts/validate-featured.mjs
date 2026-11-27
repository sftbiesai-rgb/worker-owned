#!/usr/bin/env node
/**
 * validate-featured.mjs
 * Checks all featured product image URLs and removes items whose images are
 * missing (404/410 or not an image). Unreachable or bot-blocked images are kept.
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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

// Returns 'ok', 'broken' (the server answered: missing or not an image), or
// 'unknown' (timeout, network error, or a bot block like 403/429). Many shops
// reject HEAD requests and scripted clients, so this uses GET with a browser
// user agent, and only 'broken' images get removed.
async function fetchImage(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*' }, signal: controller.signal, redirect: 'follow' })
    res.body?.cancel()
    const ct = res.headers.get('content-type') || ''
    if (res.ok) return ct.startsWith('image/') || ct.includes('octet-stream') ? 'ok' : 'broken'
    return [404, 410].includes(res.status) ? 'broken' : 'unknown'
  } catch {
    return 'unknown'
  } finally {
    clearTimeout(timeout)
  }
}

async function checkImage(url) {
  const first = await fetchImage(url)
  return first === 'unknown' ? fetchImage(url) : first
}

const results = await Promise.all(items.map(async item => {
  const status = item.image ? await checkImage(item.image) : 'broken'
  return { item, status, ok: status !== 'broken' }
}))

const unknown = results.filter(r => r.status === 'unknown')
if (unknown.length) {
  console.log(`\nCould not verify (${unknown.length}), keeping:`)
  for (const { item } of unknown) console.log(`  ${item.pick} | ${item.store_name} | ${item.title}`)
}

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

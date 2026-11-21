#!/usr/bin/env node
// Builds public/data/featured-categories.json: a row of well-known, in-stock
// picks for the top of category pages, from the curated lists in
// featured-picks.mjs. Bull Moose and Zia picks must ship In Stock (av10/av11),
// not Special Order. Run after split-products.mjs:
//   node scripts/build-category-featured.mjs [category ...]
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PICKS, EXCLUDE } from './featured-picks.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SECTION_NAMES = { music: 'Music', 'movies-tv': 'Movies & TV', books: 'Books', 'coffee-tea': 'Coffee & Tea', 'food-pantry': 'Food & Pantry', games: 'Games', 'personal-care': 'Personal Care', 'home-goods': 'Home Goods & Services' }
const MAX_PER_CATEGORY = 16

// Preferred format per category, best first.
const FORMAT_RANK = {
  music: [/vinyl|@lp|lp$|2lp/i, /cd/i],
  'movies-tv': [/blu-?ray|4k/i, /dvd/i],
  books: [/paperback/i, /hardcover/i],
}

// Format preference first, then the everyday size (cheapest listing) so a
// coffee pick is a 12oz bag rather than a 5lb bulk sack.
function rank(p, cat) {
  const text = p.title + ' ' + (p.tags || []).join(' ')
  const i = (FORMAT_RANK[cat] || []).findIndex(re => re.test(text))
  const price = parseFloat(String(p.price).replace(/^\$/, '')) || 0
  return (i === -1 ? 99 : i) * 100000 + price
}

const FIELDSTACK = [
  [/bullmoose\.com\/p\/(\d+)\//, 'https://www.bullmoose.com'],
  [/ziarecords\.com\/pid\/(\d+)\//, 'https://www.ziarecords.com'],
]

async function shipsInStock(url) {
  const hit = FIELDSTACK.map(([re, base]) => [url.match(re), base]).find(([m]) => m)
  if (!hit) return true // not a FieldStack store; trust the scraped availability
  const [[, id], base] = hit
  try {
    const res = await fetch(`${base}/availabilitydetail/${id}/0`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
    })
    const html = (await res.json())?.data?.data || ''
    const ship = [...html.matchAll(/class="store-ship"[\s\S]*?<span class="av\s+([^"]+)"/g)]
    return ship.some(m => /av10|av11/.test(m[1]))
  } catch {
    return false
  }
}

async function imageLoads(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(10000) })
      await res.body?.cancel() // free the connection; unread bodies stall later requests
      if (res.ok) return (res.headers.get('content-type') || '').startsWith('image/')
      if (process.env.DEBUG) console.log(`  image ${res.status} ${url}`)
      if (res.status === 404 || res.status === 410) return false
      // 403/429 here means the image host is rate-limiting this script, not
      // that the image is missing (it loads fine in a browser).
      if (res.status === 403 || res.status === 429) return true
    } catch (e) {
      if (process.env.DEBUG) console.log(`  image error ${e.name} ${e.cause?.code || ''} ${url}`)
    }
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
  }
  return false
}

// Image hosts sometimes throttle a long run, so a category that comes up short
// keeps its previous picks instead of shrinking.
const MIN_PER_CATEGORY = 12
const outPath = resolve(root, 'public/data/featured-categories.json')
const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {}

// Optional: rebuild only some categories, e.g.
//   node scripts/build-category-featured.mjs personal-care home-goods
const only = process.argv.slice(2)

const out = { ...previous }
for (const [cat, patterns] of Object.entries(PICKS)) {
  if (only.length && !only.includes(cat)) continue
  const products = JSON.parse(readFileSync(resolve(root, `public/data/products-${cat}.json`), 'utf8'))
    .filter(p => p.site_section === SECTION_NAMES[cat] && p.available !== false && p.image && !EXCLUDE.test(p.title))
  const picks = []
  for (const pattern of patterns) {
    if (picks.length >= MAX_PER_CATEGORY) break
    const re = new RegExp(pattern, 'i')
    const candidates = products.filter(p => re.test(p.title)).sort((a, b) => rank(a, cat) - rank(b, cat))
    let chosen = null
    for (const c of candidates.slice(0, 6)) {
      if (await imageLoads(c.image) && await shipsInStock(c.url)) { chosen = c; break }
    }
    console.log(`${cat.padEnd(10)} ${chosen ? 'OK  ' : 'MISS'} ${pattern}${chosen ? '  ->  ' + chosen.title : ` (${candidates.length} candidates, no in-stock match with a working image)`}`)
    if (chosen) picks.push(chosen)
  }
  if (picks.length < MIN_PER_CATEGORY && (previous[cat]?.length || 0) > picks.length) {
    console.warn(`WARNING: ${cat} found only ${picks.length} picks; keeping the previous ${previous[cat].length}. Rerun later.`)
    out[cat] = previous[cat]
  } else {
    out[cat] = picks
  }
}

writeFileSync(outPath, JSON.stringify(out))
console.log('Wrote featured-categories.json:', Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', '))

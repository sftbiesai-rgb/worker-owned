#!/usr/bin/env node
// Audits every product in src/data/gift-guide.json against the live store page:
// the link must resolve, the item must be for sale, and the price must match.
//
// Shopify stores are checked through their /products/<handle>.js endpoint.
// Bull Moose and Zia (FieldStack) use the /availabilitydetail shipping status.
// Everything else reads schema.org JSON-LD and price meta tags, falling back to
// a real Chrome (puppeteer-core) for sites that block plain requests (Scheels).
//
// Usage: node scripts/audit-gift-guide.mjs   (writes /tmp/gift-audit.json)

import { readFileSync, writeFileSync } from 'fs'
import puppeteer from 'puppeteer-core'

const guide = JSON.parse(readFileSync('src/data/gift-guide.json', 'utf8'))
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const num = v => parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  return { status: res.status, finalUrl: res.url, text: await res.text() }
}

async function checkShopify(url) {
  const u = new URL(url)
  const m = u.pathname.match(/\/products\/([^/?#]+)/)
  if (!m) return null
  const r = await get(`${u.origin}/products/${m[1]}.js`)
  if (r.status !== 200) return { status: r.status }
  let j
  try { j = JSON.parse(r.text) } catch { return null }
  const variantId = u.searchParams.get('variant')
  const variants = j.variants || []
  const v = variants.find(x => String(x.id) === variantId) || variants.find(x => x.available) || variants[0]
  return {
    status: 200,
    available: variantId ? !!v?.available : !!j.available,
    price: v ? v.price / 100 : j.price / 100,
    prices: [...new Set(variants.map(x => x.price / 100))],
  }
}

function parseHtml(text) {
  const out = { prices: [] }
  for (const m of text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let data
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const nodes = [].concat(data, data['@graph'] || [])
    for (const n of nodes) {
      if (!n || !/Product/.test([].concat(n['@type']).join())) continue
      for (const o of [].concat(n.offers || [])) {
        for (const off of [].concat(o.offers || o)) {
          const p = num(off.price ?? off.lowPrice)
          if (p) out.prices.push(p)
          if (off.availability) out.availability = String(off.availability)
        }
      }
    }
  }
  for (const m of text.matchAll(/<meta[^>]+>/g)) {
    const tag = m[0]
    if (!/(?:property|itemprop)="(?:product:price:amount|og:price:amount|price)"/.test(tag)) continue
    const p = num(tag.match(/content="([^"]+)"/)?.[1])
    if (p) out.prices.push(p)
  }
  out.prices = [...new Set(out.prices)]
  out.soldOutText = /sold out|out of stock|currently unavailable|no longer available/i.test(text.replace(/<script[\s\S]*?<\/script>/g, ''))
  return out
}

// FieldStack stores: In Stock to ship is av10/av11. Special Order (av21) and
// Out of Stock (av50) don't count, matching the featured-items rule.
async function fieldStackInStock(url) {
  const u = new URL(url)
  const id = u.pathname.match(/\/p\/(\d+)/)?.[1]
  const res = await fetch(`${u.origin}/availabilitydetail/${id}/0`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' },
  })
  const html = (await res.json()).data?.data || ''
  const ship = [...html.matchAll(/class="store-ship"[\s\S]*?<span class="av\s+([^"]+)"/g)]
  return ship.some(m => /av10|av11/.test(m[1]))
}

let browser
// Hosts that refused the browser too. We don't retry or work around bot
// protection; their items are reported as BLOCKED for a manual check.
const blockedHosts = new Set()

async function browserCheck(url) {
  browser ??= await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
  const page = await browser.newPage()
  await page.setUserAgent(UA)
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(3500)
    const html = await page.content()
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase()
    return { status: res.status(), finalUrl: page.url(), html, body }
  } finally {
    await page.close()
  }
}

const results = []
for (const section of guide) {
  for (const p of section.products) {
    const listed = num(p.price)
    let r = { section: section.id, id: p.id, store: p.store_name, title: p.title, url: p.url, listed }
    try {
      const shop = await checkShopify(p.url)
      if (shop && shop.status === 200) {
        Object.assign(r, { method: 'shopify', status: 200, available: shop.available, live: shop.price, livePrices: shop.prices })
      } else {
        let page = await get(p.url)
        let h = parseHtml(page.text)
        let body = null
        const fieldStack = /bullmoose\.com|ziarecords\.com/.test(p.url)
        const host = new URL(p.url).host
        if (blockedHosts.has(host)) {
          r.verdict = 'BLOCKED'
        } else if (!fieldStack && (page.status === 403 || page.status === 429 || !h.prices.length || !h.availability)) {
          const b = await browserCheck(p.url)
          if (b.status === 403 || b.status === 429) blockedHosts.add(host)
          page = { status: b.status, finalUrl: b.finalUrl, text: b.html }
          h = parseHtml(b.html)
          body = b.body
        }
        let available = h.availability ? /InStock|PreOrder|LimitedAvailability/i.test(h.availability) : null
        if (fieldStack && page.status === 200) available = await fieldStackInStock(p.url)
        else if (available == null && body) {
          if (/add to cart|add to bag/.test(body)) available = true
          else if (/sold out|out of stock|unavailable/.test(body)) available = false
        }
        Object.assign(r, {
          method: fieldStack ? 'fieldstack' : body ? 'browser' : 'html', status: page.status,
          finalUrl: page.finalUrl !== p.url ? page.finalUrl : undefined,
          available, availability: h.availability,
          live: h.prices.length ? (h.prices.includes(listed) ? listed : h.prices[0]) : null, livePrices: h.prices,
        })
      }
    } catch (e) {
      r.error = e.message
    }
    const priceOk = r.live == null ? null : Math.abs(r.live - listed) < 0.01
    r.verdict = r.verdict === 'BLOCKED' || r.status === 403 || r.status === 429 ? 'BLOCKED'
      : r.error || (r.status && r.status >= 400) ? 'BROKEN'
      : r.available === false ? 'UNAVAILABLE'
      : priceOk === false ? 'PRICE'
      : r.live == null || r.available == null ? 'UNVERIFIED'
      : 'OK'
    results.push(r)
    console.log(`${r.verdict.padEnd(11)} ${section.id.padEnd(17)} $${listed} -> ${r.live ?? '?'} | ${p.store_name} | ${p.title.slice(0, 50)}`)
    await sleep(250)
  }
}

await browser?.close()
writeFileSync('/tmp/gift-audit.json', JSON.stringify(results, null, 2))
const counts = results.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] || 0) + 1 }), {})
console.log('\n', counts, '\nFull results in /tmp/gift-audit.json')

#!/usr/bin/env node
// Checks which Scheels products are in stock for some search terms, using the
// same search API scheels-api-search.mjs scrapes (inStock:true filter).
// Usage: node scripts/check-scheels.mjs "term" ["term" ...]
import puppeteer from 'puppeteer-core'

const terms = process.argv.slice(2)
if (!terms.length) {
  console.log('Usage: node scripts/check-scheels.mjs "term" ["term" ...]')
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--disable-blink-features=AutomationControlled'],
})
try {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')
  await page.goto('https://www.scheels.com/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  for (let i = 0; i < 30 && (await page.content()).includes('Just a moment'); i++) await new Promise(r => setTimeout(r, 1000))

  for (const term of terms) {
    const hits = await page.evaluate(async q => {
      const resp = await fetch('https://search.scheels.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: [{ indexName: 'commercetools_products', query: q, page: 1, pageSize: 8, filters: 'inStock:true' }] }),
      })
      if (!resp.ok) return `HTTP ${resp.status}`
      const data = await resp.json()
      return (data.results?.[0]?.hits || []).map(h => {
        const d = h.data || {}
        const sale = d.pricing?.groups?.default?.onSale ? ` (sale $${d.pricing.groups.default.minSale})` : ''
        return `${d.objectID} | ${d.title} | $${d.pricing?.minRetail}${sale}`
      })
    }, term)
    console.log(`## ${term} (in stock)`)
    console.log(Array.isArray(hits) ? (hits.length ? hits.map(h => '   ' + h).join('\n') : '   none') : '   ' + hits)
  }
} finally {
  await browser.close()
}

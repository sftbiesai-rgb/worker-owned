#!/usr/bin/env node
/**
 * discover-coops.mjs
 * Finds .coop domains via Certificate Transparency logs, checks liveness,
 * fetches homepage content, and deduplicates against existing data.
 * Outputs a report for manual classification in Claude Code.
 *
 * Usage:
 *   node scripts/discover-coops.mjs
 *
 * Output: candidates/coop-discovery.json
 * No API keys required. Classification done manually in conversation.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'candidates')

const TIMEOUT_MS = 10000
const CONCURRENCY = 5
const DELAY_MS = 200

// Domains/patterns to exclude early (not worker co-ops)
const EXCLUDE_PATTERNS = [
  /credit/i, /\.cu\./i, /electric/i, /power\b/i, /energy/i,
  /housing/i, /\bphone\b/i, /telecom/i, /insurance/i, /\bbank\b/i,
  /mutual/i, /savings/i, /federal/i,
  // Country-code subdomains (non-US/CA)
  /\.uk\.coop$/i, /\.es\.coop$/i, /\.it\.coop$/i, /\.fr\.coop$/i,
  /\.de\.coop$/i, /\.jp\.coop$/i, /\.kr\.coop$/i, /\.br\.coop$/i,
  /\.ar\.coop$/i, /\.au\.coop$/i, /\.nz\.coop$/i, /\.za\.coop$/i,
  /\.in\.coop$/i, /\.ph\.coop$/i, /\.mx\.coop$/i,
  // Infrastructure subdomains
  /^mail\./i, /^smtp\./i, /^ftp\./i, /^vpn\./i, /^cpanel\./i,
  /^webmail\./i, /^autodiscover\./i, /^api\./i, /^staging\./i,
  /^dev\./i, /^test\./i, /^ns\d?\./i, /^mx\d?\./i,
]

// Extra seed domains to check even if crt.sh misses them
const SEED_DOMAINS = [
  'justcoffee.coop', 'equalexchange.coop', 'palestiniansoap.coop',
  'worxprinting.coop', 'artisans.coop', 'woodshop.coop', 'handwork.coop',
  'thegrainshed.coop', 'bathtubrowbrewing.coop', 'artbev.coop',
  'radix.coop', 'resonate.coop', 'goodpress.coop', 'nycworker.coop',
  'cheeseboardcollective.coop', 'wooden.coop', 'maydaycafe.coop',
  'firestorm.coop', 'boyfriend.coop', 'bluescorcher.coop',
  'flatiron.coop', 'pattypan.coop', 'bol.coop', 'rainbow.coop',
  'otheravenues.coop', 'mandelagrocery.coop', 'weaverstreetmarket.coop',
  'flyingbike.coop', 'wildland.coop',
  // Known co-ops to discover
  'arizmendi.coop', 'greencity.coop', 'isthmus.coop',
  'evergreen.coop', 'seed.coop', 'data.coop', 'platform.coop',
  'start.coop', 'techworker.coop', 'hypha.coop', 'loomio.coop',
  'open.coop', 'colab.coop', 'sassafras.coop', 'agaric.coop',
  'cosol.coop', 'diva.coop', 'animorph.coop', 'autonomic.coop',
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function ensureOutDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
}

function normalizeDomain(raw) {
  let d = raw.toLowerCase().trim()
  d = d.replace(/^\*\./, '')       // strip wildcard
  d = d.replace(/^www\./, '')      // strip www
  d = d.replace(/\/.*$/, '')       // strip paths
  d = d.replace(/:\d+$/, '')       // strip port
  return d
}

function shouldExclude(domain) {
  return EXCLUDE_PATTERNS.some(p => p.test(domain))
}

function isBareDotCoop(domain) {
  const parts = domain.split('.')
  return parts.length === 2 && parts[1] === 'coop'
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function processQueue(items, concurrency, fn) {
  const results = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx, items.length)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

function extractText(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''

  const snippet = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500)

  return { title, description, snippet }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.error('Discovering .coop domains...\n')
  ensureOutDir()

  // ── Step 1: Get .coop domains from crt.sh ──

  let domains = new Set()
  let source = 'crt.sh'

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.error(`Querying crt.sh (attempt ${attempt}/3)...`)
      const res = await fetchWithTimeout(
        'https://crt.sh/?q=%25.coop&output=json',
        { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerOwnedDir/1.0)' } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const certs = await res.json()
      console.error(`Got ${certs.length} certificate entries`)

      for (const cert of certs) {
        for (const field of [cert.common_name, cert.name_value]) {
          if (!field) continue
          for (const raw of field.split('\n')) {
            const d = normalizeDomain(raw)
            if (d.endsWith('.coop') && isBareDotCoop(d) && !shouldExclude(d)) {
              domains.add(d)
            }
          }
        }
      }
      console.error(`${domains.size} unique .coop domains after filtering\n`)
      break
    } catch (e) {
      console.error(`crt.sh attempt ${attempt} failed: ${e.message}`)
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000
        console.error(`Retrying in ${delay / 1000}s...\n`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  if (domains.size === 0) {
    console.error('crt.sh unavailable, using seed list only\n')
    source = 'seed_list'
  }

  // Merge seeds
  for (const d of SEED_DOMAINS) {
    if (!shouldExclude(d)) domains.add(d)
  }

  // ── Step 2: Dedup against existing data ──

  const marketplace = JSON.parse(readFileSync(resolve(ROOT, 'src/data/marketplace.json'), 'utf-8'))
  const shops = JSON.parse(readFileSync(resolve(ROOT, 'src/data/shops.json'), 'utf-8'))
  let bars = []
  const barsPath = resolve(ROOT, 'src/data/bars.json')
  if (existsSync(barsPath)) bars = JSON.parse(readFileSync(barsPath, 'utf-8'))

  const existingDomains = new Set()
  for (const e of marketplace) {
    if (e.url) existingDomains.add(normalizeDomain(e.url.replace(/^https?:\/\//, '')))
  }
  for (const e of [...shops, ...bars]) {
    if (e.website) existingDomains.add(normalizeDomain(e.website.replace(/^https?:\/\//, '')))
  }

  const allDomains = [...domains].sort()
  const newDomains = allDomains.filter(d => !existingDomains.has(d))
  const knownDomains = allDomains.filter(d => existingDomains.has(d))

  console.error(`${allDomains.length} total .coop domains`)
  console.error(`${knownDomains.length} already in dataset`)
  console.error(`${newDomains.length} new domains to check\n`)

  // ── Step 3: Check liveness + fetch content for new domains ──

  console.error(`Checking ${newDomains.length} new domains...\n`)

  const results = await processQueue(newDomains, CONCURRENCY, async (domain, idx, total) => {
    try {
      const res = await fetchWithTimeout(`https://${domain}`, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerOwnedDir/1.0)' },
        redirect: 'follow',
      })

      if (!res.ok) {
        console.error(`  \x1b[33m-\x1b[0m [${idx + 1}/${total}] ${domain} HTTP ${res.status}`)
        return { domain, alive: false, httpStatus: res.status }
      }

      const html = await res.text()
      const { title, description, snippet } = extractText(html)
      const finalUrl = res.url || `https://${domain}`

      console.error(`  \x1b[32m+\x1b[0m [${idx + 1}/${total}] ${domain} "${title.slice(0, 60)}"`)

      return {
        domain,
        alive: true,
        httpStatus: res.status,
        redirectsTo: finalUrl !== `https://${domain}` ? finalUrl : null,
        title,
        description,
        snippet,
      }
    } catch (e) {
      const reason = e.name === 'AbortError' ? 'TIMEOUT' : (e.cause?.code || e.message)
      console.error(`  \x1b[31mx\x1b[0m [${idx + 1}/${total}] ${domain} ${reason}`)
      return { domain, alive: false, error: reason }
    }
  })

  const alive = results.filter(r => r.alive)
  const dead = results.filter(r => !r.alive)

  // ── Step 4: Write output ──

  const output = {
    generated_at: new Date().toISOString(),
    source,
    stats: {
      total_coop_domains: allDomains.length,
      already_in_dataset: knownDomains.length,
      new_domains_checked: newDomains.length,
      new_alive: alive.length,
      new_dead: dead.length,
    },
    already_in_dataset: knownDomains,
    new_alive: alive,
    new_dead: dead,
  }

  const outPath = resolve(OUT_DIR, 'coop-discovery.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))

  // Print summary
  console.error(`\n${'='.repeat(60)}`)
  console.error(`Discovery complete`)
  console.error(`  Source: ${source}`)
  console.error(`  Total .coop domains found: ${allDomains.length}`)
  console.error(`  Already in dataset: ${knownDomains.length}`)
  console.error(`  New + alive: ${alive.length}`)
  console.error(`  New + dead: ${dead.length}`)
  console.error(`\nOutput: ${outPath}`)
  console.error(`\nNext: review candidates/coop-discovery.json in Claude Code`)

  // Quick summary to stdout
  if (alive.length > 0) {
    console.log(`\n${alive.length} new .coop domains to review:\n`)
    for (const r of alive) {
      console.log(`  ${r.domain}`)
      if (r.title) console.log(`    "${r.title}"`)
      if (r.description) console.log(`    ${r.description.slice(0, 120)}`)
      console.log()
    }
  }
}

main().catch(e => {
  console.error(`\nFatal: ${e.message}`)
  process.exit(1)
})

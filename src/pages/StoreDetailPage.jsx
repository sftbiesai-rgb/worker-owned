import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function displayTags(tags) {
  if (!tags?.length) return null
  return tags
    .map(t => t.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .filter(t => t.length > 2 && t.length < 40 && !/^\d+$/.test(t) && !t.includes('_') && !/wholesale/i.test(t))
    .slice(0, 3)
}

function thumbUrl(url, size = 300) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'cdn.shopify.com') {
      u.searchParams.set('width', String(size))
      return u.toString()
    }
  } catch {}
  return url
}

function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

function dedupeByUrl(entries) {
  const seen = new Map()
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (!seen.has(e.url)) seen.set(e.url, e)
  }
  return entries.filter(e => seen.get(e.url) === e)
}

const ALL_STORES = dedupeByUrl(marketplaceData)
const STORE_BY_SLUG = Object.fromEntries(
  ALL_STORES.map(s => [slugify(s.name), s])
)

function ownershipBadge(type) {
  if (!type) return null
  const clean = type.toLowerCase()
  let color = 'bg-gray-100 text-gray-500'
  if (clean.includes('worker co-op') || clean === 'worker owned') color = 'bg-blue-50 text-[#004cb9]'
  else if (clean.includes('esop') || clean.includes('employee')) color = 'bg-green-50 text-green-700'
  else if (clean.includes('multi-stakeholder') || clean.includes('consumer')) color = 'bg-purple-50 text-purple-700'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {type}
    </span>
  )
}

const SECTION_SLUGS = {
  'Coffee & Tea': 'coffee-tea',
  'Media & Publishing': 'media-publishing',
  'Food & Pantry': 'food-pantry',
  'Apparel': 'apparel',
  'Art & Prints': 'art-prints',
  'Music': 'music',
  'Home Goods & Services': 'home-goods',
  'Personal Care': 'personal-care',
  'Games': 'games',
  'Beer & Brewing': 'beer-brewing',
}

function StoreDetailPage() {
  const { store } = useParams()
  const entry = STORE_BY_SLUG[store]
  const [products, setProducts] = useState([])
  const categorySlug = entry ? SECTION_SLUGS[entry.site_section] : null

  useEffect(() => {
    if (!entry) return
    const file = categorySlug ? `/data/products-${categorySlug}.json` : '/data/products.json'
    fetch(file)
      .then(r => r.json())
      .then(data => setProducts(data.filter(p => p.store_url === entry.url).slice(0, 100)))
      .catch(() => {})
  }, [entry, categorySlug])

  useEffect(() => {
    if (!entry) return
    const title = `${entry.name} — Worker Owned | Worker Owned`
    const desc = entry.notes || `Shop ${entry.name}, a ${entry.ownership_type} selling ${entry.category}.`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    const canonical = `https://www.workerowned.info/marketplace/store/${store}`
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc)
  }, [entry, store])

  if (!entry) return <Navigate to="/marketplace" replace />

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link>
          </div>

          <p className="text-center text-sm text-gray-500 mb-5">Shop worker owned online</p>

          {/* Store header */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h1 className="flex items-center gap-2">
                {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-5 h-5 shrink-0" loading="lazy" />}
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener"
                  className="text-lg font-bold text-[#004cb9] hover:text-[#003a8c] transition-colors leading-snug"
                >
                  {entry.name} ↗
                </a>
              </h1>
              {ownershipBadge(entry.ownership_type)}
            </div>
            {entry.category && (
              <p className="text-xs text-gray-500 mb-2">{entry.category}</p>
            )}
            {entry.notes && (
              <p className="text-sm text-gray-600 leading-relaxed">{entry.notes}</p>
            )}
            {entry.ships && entry.ships !== 'US' && (
              <p className="text-xs text-gray-400 mt-1">Ships: {entry.ships}</p>
            )}
          </div>

          {/* Products */}
          {products.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-700 mb-3">{products.length} products</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map(p => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener"
                    className="bg-[#f5f5f7] rounded-xl overflow-hidden hover:ring-1 hover:ring-[#004cb9] transition-all group"
                  >
                    {p.image && (
                      <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src={thumbUrl(p.image)} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                        {p.available === false && (
                          <span className="absolute top-1.5 left-1.5 bg-gray-800/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold out</span>
                        )}
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title}</p>
                      {p.price && <p className="text-xs font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
                    </div>
                    {displayTags(p.tags)?.length > 0 && (
                      <div className="px-3 pb-2 hidden group-hover:block">
                        <p className="text-[10px] text-gray-400 leading-snug line-clamp-1">{displayTags(p.tags).join(' · ')}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </>
          )}

          {products.length === 0 && (
            <div className="bg-[#f5f5f7] rounded-xl px-4 py-4 text-center">
              <a
                href={entry.url}
                target="_blank"
                rel="noopener"
                className="text-sm font-semibold text-[#004cb9] hover:text-[#003a8c] transition-colors"
              >
                Visit {entry.name} →
              </a>
            </div>
          )}
        </div>

        <div className="mt-3 text-center flex flex-col gap-1">
          {categorySlug && (
            <Link to={`/marketplace/${categorySlug}`} className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
              ← {entry.site_section}
            </Link>
          )}
          <Link to="/marketplace" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            ← All categories
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400 mb-1">
          <a href="https://yourfairshare.info" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
            <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
            Your Fair Share
          </a>
        </p>
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      </footer>
    </div>
  )
}

export default StoreDetailPage

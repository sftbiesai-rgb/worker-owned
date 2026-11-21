import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'
import { slugify, displayTags, faviconUrl, dedupeByUrl, displayTitle, formatPrice } from '../lib/utils'
import { SECTION_SLUGS } from '../lib/categories'
import OwnershipBadge from '../components/OwnershipBadge'
import ProductImage from '../components/ProductImage'
import Footer from '../components/Footer'
import Pagination from '../components/Pagination'
import Breadcrumbs from '../components/Breadcrumbs'

const ALL_STORES = dedupeByUrl(marketplaceData)
// Build slug lookup from ALL entries (before dedup) so that every name variant resolves.
// Earlier entries win — the base "Equal Exchange" beats "Equal Exchange — Food".
const STORE_BY_SLUG = Object.fromEntries(
  [...marketplaceData].reverse().map(s => [slugify(s.name), s])
)

function ProductCard({ p }) {
  const { name, byline, format } = displayTitle(p)
  const detail = [byline, format].filter(Boolean).join(' · ')
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener"
      className="bg-[#f5f5f7] rounded-xl overflow-hidden hover:ring-1 hover:ring-[#003580] transition-all group"
    >
      {p.image && (
        <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
          <ProductImage src={p.image} alt={p.title} />
          {p.available === false && (
            <span className="absolute top-1.5 left-1.5 bg-gray-800/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold out</span>
          )}
        </div>
      )}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{name}</p>
        {detail && <p className="text-[11px] text-gray-500 leading-snug truncate mt-0.5">{detail}</p>}
        {p.price && <p className="text-xs font-semibold text-[#003580] mt-0.5">{formatPrice(p.price)}</p>}
      </div>
      {displayTags(p.tags)?.length > 0 && (
        <div className="px-3 pb-2 hidden group-hover:block">
          <p className="text-[10px] text-gray-400 leading-snug line-clamp-1">{displayTags(p.tags).join(' · ')}</p>
        </div>
      )}
    </a>
  )
}

function StoreDetailPage() {
  const { store } = useParams()
  const entry = STORE_BY_SLUG[store]
  // Loaded data is keyed by store (and page) so navigating between stores
  // never shows the previous store's products.
  const [loadedIndex, setLoadedIndex] = useState({ store: null, data: null, missing: false })
  const [loadedPage, setLoadedPage] = useState({ key: null, data: null })
  const [pageByStore, setPageByStore] = useState({})
  const page = pageByStore[store] || 1
  const setPage = n => setPageByStore(prev => ({ ...prev, [store]: n }))
  const storeIndex = loadedIndex.store === store ? loadedIndex.data : null
  const missing = loadedIndex.store === store && loadedIndex.missing
  const pageData = loadedPage.key === `${store}|${page}` ? loadedPage.data : null
  const categorySlug = entry ? SECTION_SLUGS[entry.site_section] : null

  // stores/<slug>.json has the product total and section shortcuts;
  // stores/<slug>/all-<n>.json holds each page of all the store's products.
  useEffect(() => {
    if (!entry) return
    fetch(`/data/stores/${store}.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setLoadedIndex({ store, data, missing: false }))
      .catch(() => setLoadedIndex({ store, data: null, missing: true }))
  }, [entry, store])

  useEffect(() => {
    if (!storeIndex?.totalPages) return
    fetch(`/data/stores/${store}/all-${page}.json`)
      .then(r => r.json())
      .then(data => setLoadedPage({ key: `${store}|${page}`, data }))
      .catch(() => {})
  }, [storeIndex, store, page])

  useEffect(() => {
    if (!entry) return
    const title = `${entry.name} — Worker Owned | Worker Owned`
    const desc = entry.notes || `Shop ${entry.name}, a ${entry.ownership_type} selling ${entry.category}.`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    const canonical = `https://www.workerowned.info/store/${store}`
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc)
  }, [entry, store])

  if (!entry) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto w-full px-5 py-8 flex flex-col">
        <Breadcrumbs items={[
          { label: 'Marketplace', to: '/' },
          ...(categorySlug ? [{ label: entry.site_section, to: `/${categorySlug}` }] : []),
          { label: entry.name },
        ]} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link>
          </div>

          <p className="text-center text-sm text-gray-500 mb-5">Shop worker and employee owned online</p>

          {/* Store header */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h1 className="flex items-center gap-2">
                {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-5 h-5 shrink-0" loading="lazy" />}
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener"
                  className="text-lg font-bold text-[#003580] hover:text-[#002660] transition-colors leading-snug"
                >
                  {entry.name} ↗
                </a>
              </h1>
              <OwnershipBadge type={entry.ownership_type} />
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
          {storeIndex ? (
            <>
              <p className="text-sm text-gray-500 mb-3">{storeIndex.total.toLocaleString()} products available</p>
              {storeIndex.sectionIndex?.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {storeIndex.sectionIndex.map(s => (
                    <Link
                      key={s.slug}
                      to={`/store/${store}/${s.slug}`}
                      className="px-3 py-1 rounded-full text-xs font-medium border bg-white text-gray-500 border-gray-200 hover:text-[#003580] hover:border-[#003580] transition-colors capitalize"
                    >
                      {s.label} <span className="text-gray-400">({s.count.toLocaleString()})</span>
                    </Link>
                  ))}
                </div>
              )}
              {pageData ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {pageData.products.map(p => (
                      <ProductCard key={p.id} p={p} />
                    ))}
                  </div>
                  <Pagination page={page} totalPages={storeIndex.totalPages} onPageChange={setPage} />
                </>
              ) : (
                <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
              )}
            </>
          ) : missing ? (
            <div className="bg-[#f5f5f7] rounded-xl px-4 py-4 text-center">
              <a
                href={entry.url}
                target="_blank"
                rel="noopener"
                className="text-sm font-semibold text-[#003580] hover:text-[#002660] transition-colors"
              >
                Visit {entry.name} →
              </a>
            </div>
          ) : null}
        </div>

        <div className="mt-3 text-center flex flex-col gap-1">
          {categorySlug && (
            <Link to={`/${categorySlug}`} className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
              ← {entry.site_section}
            </Link>
          )}
          <Link to="/" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            ← All categories
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

export default StoreDetailPage

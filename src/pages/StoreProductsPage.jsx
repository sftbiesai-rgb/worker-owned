import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'
import { slugify, displayTags, faviconUrl, dedupeByUrl } from '../lib/utils'
import OwnershipBadge from '../components/OwnershipBadge'
import ProductImage from '../components/ProductImage'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'
import Breadcrumbs from '../components/Breadcrumbs'

const STORE_BY_SLUG = Object.fromEntries(
  [...marketplaceData].reverse().map(s => [slugify(s.name), s])
)

function ProductCard({ p }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener"
      className="bg-[#f5f5f7] rounded-xl overflow-hidden hover:ring-1 hover:ring-[#004cb9] transition-all group"
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
        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title}</p>
        {p.price && <p className="text-xs font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
      </div>
      {displayTags(p.tags)?.length > 0 && (
        <div className="px-3 pb-2 hidden group-hover:block">
          <p className="text-[10px] text-gray-400 leading-snug line-clamp-1">{displayTags(p.tags).join(' · ')}</p>
        </div>
      )}
    </a>
  )
}

function StoreProductsPage() {
  const { store, section } = useParams()
  const entry = STORE_BY_SLUG[store]
  const [products, setProducts] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sectionLabel, setSectionLabel] = useState(section)

  useEffect(() => {
    if (!entry) return
    // Load section info from store summary to get the display label
    fetch(`/data/stores/${store}.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const si = (data.sectionIndex || []).find(s => s.slug === section)
        if (si) setSectionLabel(si.label)
      })
      .catch(() => {})
  }, [entry, store, section])

  useEffect(() => {
    if (!entry) return
    fetch(`/data/stores/${store}/${section}-${page}.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setProducts(data.products)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      })
      .catch(() => setProducts([]))
  }, [entry, store, section, page])

  useEffect(() => {
    if (!entry) return
    const label = sectionLabel || section
    document.title = `${entry.name} — ${label} | Worker Owned Marketplace`
  }, [entry, sectionLabel, section])

  if (!entry) return <Navigate to="/marketplace" replace />

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">
        <Breadcrumbs items={[
          { label: 'Marketplace', to: '/marketplace' },
          { label: entry.name, to: `/marketplace/store/${store}` },
          { label: sectionLabel },
        ]} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link>
          </div>
          <p className="text-center text-sm text-gray-500 mb-5">Shop worker and employee owned online</p>

          <div className="mb-4">
            <h1 className="flex items-center gap-2 mb-1">
              {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-5 h-5 shrink-0" loading="lazy" />}
              <Link
                to={`/marketplace/store/${store}`}
                className="text-lg font-bold text-[#004cb9] hover:text-[#003a8c] transition-colors leading-snug"
              >
                {entry.name}
              </Link>
            </h1>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide capitalize">
              {sectionLabel} <span className="text-gray-400 font-normal">({total.toLocaleString()} products)</span>
            </h2>
          </div>

          {products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map(p => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          )}
        </div>

        <div className="mt-3 text-center flex flex-col gap-1">
          <Link to={`/marketplace/store/${store}`} className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            ← {entry.name}
          </Link>
          <Link to="/marketplace" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            ← All categories
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

export default StoreProductsPage

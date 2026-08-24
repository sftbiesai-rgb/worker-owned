import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'
import { slugify, faviconUrl, dedupeByUrl, interleaveByStore } from '../lib/utils'
import { SECTIONS, SUBCATEGORIES, FILTERS } from '../lib/categories'
import OwnershipBadge from '../components/OwnershipBadge'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'
import Breadcrumbs from '../components/Breadcrumbs'

const PER_PAGE = 40

function MarketplacePage() {
  const { category, subcategory } = useParams()
  const section = SECTIONS.find(s => s.slug === category)
  const subs = SUBCATEGORIES[category]
  const activeSub = subs?.find(s => s.slug === subcategory) || null
  const [products, setProducts] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [showStores, setShowStores] = useState(category === 'tech-software' || category === 'art-prints' || category === 'music')
  const [filter, setFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState(null)
  const categoryFilters = FILTERS[category] || null

  useEffect(() => {
    if (!section) return
    setLoaded(false)
    setShowStores(category === 'tech-software' || category === 'art-prints' || category === 'music')
    fetch(`/data/products-${section.slug}.json`)
      .then(r => r.json())
      .then(d => { setProducts(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [section])

  useEffect(() => {
    if (!section) return
    const title = activeSub
      ? `${activeSub.label} — ${section.label} | Worker Owned Marketplace`
      : section.title
    const desc = activeSub
      ? `Browse ${activeSub.label.toLowerCase()} from worker owned businesses. Shop cooperatively made products.`
      : section.description
    const canonical = `https://www.workerowned.info/marketplace/${section.slug}${activeSub ? '/' + activeSub.slug : ''}`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc)
  }, [section, activeSub])

  useEffect(() => { setPage(1); setFilter(''); setActiveFilter(null) }, [category, subcategory])

  if (!section) return <Navigate to="/marketplace" replace />
  if (subcategory && subs && !activeSub) return <Navigate to={`/marketplace/${category}`} replace />

  const sectionProducts = products.filter(p => p.site_section === section.sectionName)

  const subFiltered = activeSub
    ? sectionProducts.filter(p => {
        const text = p.title.toLowerCase() + ' ' + (p.tags || []).join(' ').toLowerCase()
        return activeSub.keywords.some(kw => text.includes(kw))
      })
    : sectionProducts

  const tagFiltered = activeFilter
    ? subFiltered.filter(p => (p.tags || []).some(t => t.toLowerCase().includes(activeFilter.toLowerCase())))
    : subFiltered

  const filterWords = filter.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = filterWords.length
    ? tagFiltered.filter(p => {
        const text = p.title.toLowerCase() + ' ' + (p.tags || []).join(' ').toLowerCase() + ' ' + (p.store_name || '').toLowerCase()
        return filterWords.every(w => text.includes(w))
      })
    : tagFiltered

  const available = filtered.filter(p => p.available !== false)
  const soldOut = filtered.filter(p => p.available === false)
  const sorted = [...interleaveByStore(available), ...soldOut]
  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const entries = dedupeByUrl(
    marketplaceData.filter(e => e.site_section === section.sectionName)
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <Breadcrumbs items={[
          { label: 'Marketplace', to: '/marketplace' },
          ...(activeSub
            ? [{ label: section.label, to: `/marketplace/${category}` }, { label: activeSub.label }]
            : [{ label: section.label }]
          ),
        ]} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker and employee owned businesses online</p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
            {SECTIONS.map(s => (
              <Link
                key={s.slug}
                to={`/marketplace/${s.slug}`}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  s.slug === category
                    ? 'bg-[#004cb9] text-white'
                    : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* Subcategory chips */}
          {subs && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              <Link
                to={`/marketplace/${category}`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  !activeSub
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-white text-gray-500 border-gray-200 hover:text-[#004cb9] hover:border-[#004cb9]'
                }`}
              >
                All
              </Link>
              {subs.map(s => (
                <Link
                  key={s.slug}
                  to={`/marketplace/${category}/${s.slug}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    s.slug === subcategory
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-white text-gray-500 border-gray-200 hover:text-[#004cb9] hover:border-[#004cb9]'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          )}

          {/* Format filters */}
          {categoryFilters && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {categoryFilters.map(f => (
                <button
                  key={f.tag}
                  onClick={() => { setActiveFilter(activeFilter === f.tag ? null : f.tag); setPage(1) }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                    activeFilter === f.tag
                      ? 'bg-[#004cb9] text-white border-[#004cb9]'
                      : 'bg-white text-gray-400 border-gray-200 hover:text-[#004cb9] hover:border-[#004cb9]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3 text-xs mt-3">
            <span className="px-3 py-1 rounded-full bg-gray-700 text-white font-medium">
              Products
            </span>
            <Link
              to={`/marketplace/${category}/directory`}
              className="px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:text-[#004cb9] hover:border-[#004cb9] transition-colors"
            >
              Directory
            </Link>
          </div>
        </div>

        {/* Products grid */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">{activeSub ? activeSub.label : section.label}</h2>
            <p className="text-xs text-gray-400">
              {!loaded ? 'Loading…' : products.length > 0 ? `${filtered.length} product${filtered.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          {loaded && subFiltered.length > 20 && (
            <input
              type="text"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1) }}
              placeholder={`Filter ${(activeSub ? activeSub.label : section.label).toLowerCase()}…`}
              className="w-full mb-4 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-[#f5f5f7] focus:outline-none focus:border-[#004cb9] focus:ring-1 focus:ring-[#004cb9] placeholder-gray-400"
            />
          )}

          {paged.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {paged.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : loaded ? (
            <p className="text-sm text-gray-500 text-center py-4">To see products and services offered, visit company sites below.</p>
          ) : null}
        </div>

        {/* Stores section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
          <button
            onClick={() => setShowStores(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-sm font-bold text-gray-700">{entries.length} {section.label} stores</h2>
            <span className="text-xs text-gray-400">{showStores ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showStores && (
            <div className="space-y-3 mt-4">
              {entries.map(entry => (
                <Link key={entry.id} to={`/marketplace/store/${slugify(entry.name)}`} className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#004cb9] transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-[#004cb9] leading-snug flex items-center gap-1.5">
                      {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                      {entry.name}
                    </span>
                    <OwnershipBadge type={entry.ownership_type} />
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-gray-500 leading-relaxed">{entry.notes}</p>
                  )}
                  {entry.ships && entry.ships !== 'US' && (
                    <p className="text-xs text-gray-400 mt-1">Ships: {entry.ships}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-center">
          <Link to="/marketplace" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; All categories
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

export default MarketplacePage

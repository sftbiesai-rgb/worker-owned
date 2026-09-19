import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Search, ArrowUpDown, Grid3X3, List, SlidersHorizontal, X } from 'lucide-react'
import { CATEGORIES, categoryBySlug } from '../lib/categories'
import { slugify, faviconUrl } from '../lib/utils'
import ProductCard from '../components/ProductCard'
import ProductListItem from '../components/ProductListItem'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'bg-emerald-100 text-emerald-700', F: 'bg-blue-100 text-blue-700', P: 'bg-amber-100 text-amber-700', S: 'bg-purple-100 text-purple-700', '1': 'bg-rose-100 text-rose-700' }

const PRICE_RANGES = [
  { key: 'under25', label: 'Under $25', min: 0, max: 25 },
  { key: '25-50', label: '$25 – $50', min: 25, max: 50 },
  { key: '50-100', label: '$50 – $100', min: 50, max: 100 },
  { key: '100-250', label: '$100 – $250', min: 100, max: 250 },
  { key: 'over250', label: '$250+', min: 250, max: Infinity },
]

export default function CategoryPage() {
  const { category: slug } = useParams()
  const cat = categoryBySlug(slug)

  const [allProducts, setAllProducts] = useState([])
  const [allStores, setAllStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('relevance')
  const [filter, setFilter] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPrice, setFilterPrice] = useState('')
  const [desktopView, setDesktopView] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)
  const PER_PAGE = 40

  useEffect(() => {
    fetch('/data/search.json')
      .then(r => r.json())
      .then(data => {
        const stores = data.s
        const tagDict = data.t || []
        const typeDict = data.y || []
        setAllStores(stores)
        const hydrated = data.p
          .map((p, i) => {
            const store = stores[p[0]]
            const img = p[3] ? (store.ip || '') + p[3] : null
            const tags = p[7] === 0 ? [] : (p[7] || []).map(id => tagDict[id])
            return {
              id: i, title: p[1], price: p[2] > 0 ? p[2] : null,
              image: img,
              url: (store.up || '') + p[4],
              store_name: store.n, store_url: store.u,
              store_industry: store.i,
              product_type: typeof p[6] === 'number' ? (typeDict[p[6]] || '') : (p[6] || ''),
              tags, available: p[5] !== 0,
              ownership_types: store.t || [],
            }
          })
          .filter(p => p.image)
        setAllProducts(hydrated)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (cat) document.title = `${cat.label} — Purpose Owned`
  }, [cat])

  // Reset filters when category changes
  useEffect(() => { setPage(1); setFilter(''); setFilterStore(''); setFilterType(''); setFilterPrice('') }, [slug])

  // Products in this category (base set)
  const categoryProducts = useMemo(() => {
    if (!cat) return []
    return allProducts
      .filter(p => p.available !== false)
      .filter(p => cat.industries.includes(p.store_industry))
  }, [allProducts, cat])

  // Facet counts (computed on unfiltered category products)
  const typeFacets = useMemo(() => {
    const counts = new Map()
    for (const p of categoryProducts) {
      for (const t of (p.ownership_types || [])) {
        counts.set(t, (counts.get(t) || 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [categoryProducts])

  const priceFacets = useMemo(() => {
    return PRICE_RANGES.map(pr => {
      const count = categoryProducts.filter(p => {
        const price = parseFloat(p.price)
        return !isNaN(price) && price >= pr.min && price < pr.max
      }).length
      return { ...pr, count }
    }).filter(pr => pr.count > 0)
  }, [categoryProducts])

  const storeFacets = useMemo(() => {
    const counts = new Map()
    for (const p of categoryProducts) {
      counts.set(p.store_name, (counts.get(p.store_name) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [categoryProducts])

  // Filtered + sorted products
  const displayProducts = useMemo(() => {
    let r = categoryProducts
    if (filterStore) r = r.filter(p => p.store_name === filterStore)
    if (filterType) r = r.filter(p => (p.ownership_types || []).includes(filterType))
    if (filterPrice) {
      const range = PRICE_RANGES.find(pr => pr.key === filterPrice)
      if (range) r = r.filter(p => {
        const price = parseFloat(p.price)
        return !isNaN(price) && price >= range.min && price < range.max
      })
    }
    const terms = filter.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length > 0) {
      r = r.filter(p => {
        const text = (p.title || '') + ' ' + (p.product_type || '') + ' ' + (p.store_name || '')
        return terms.every(t => text.toLowerCase().includes(t))
      })
    }
    if (sort === 'price-asc') r = [...r].sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
    else if (sort === 'price-desc') r = [...r].sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0))
    else if (sort === 'store') r = [...r].sort((a, b) => (a.store_name || '').localeCompare(b.store_name || ''))
    return r
  }, [categoryProducts, sort, filter, filterStore, filterType, filterPrice])

  const totalPages = Math.ceil(displayProducts.length / PER_PAGE)
  const paged = displayProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const activeFilterCount = [filterType, filterPrice, filterStore].filter(Boolean).length

  // Directory: all stores in this category
  const directoryStores = useMemo(() => {
    if (!cat) return []
    const storesInCat = allStores.filter(s => cat.industries.includes(s.i))
    const productCounts = new Map()
    for (const p of categoryProducts) {
      productCounts.set(p.store_name, (productCounts.get(p.store_name) || 0) + 1)
    }
    return storesInCat
      .map(s => ({
        name: s.n, url: s.u, types: s.t || [],
        productCount: productCounts.get(s.n) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allStores, cat, categoryProducts])

  if (!cat) return <Navigate to="/" replace />

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  const clearFilter = (key) => {
    if (key === 'store') setFilterStore('')
    if (key === 'type') setFilterType('')
    if (key === 'price') setFilterPrice('')
    setPage(1)
  }

  // Active filter chips
  const activeFilters = (filterType || filterPrice || filterStore) ? (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {filterType && (
        <button onClick={() => clearFilter('type')} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {TYPE_LABELS[filterType] || filterType} <X size={10} />
        </button>
      )}
      {filterPrice && (
        <button onClick={() => clearFilter('price')} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {PRICE_RANGES.find(pr => pr.key === filterPrice)?.label} <X size={10} />
        </button>
      )}
      {filterStore && (
        <button onClick={() => clearFilter('store')} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {filterStore} <X size={10} />
        </button>
      )}
    </div>
  ) : null

  // Desktop sidebar
  const sidebar = (
    <div className="hidden lg:block w-56 shrink-0 space-y-3">
      {typeFacets.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ownership type</p>
          {typeFacets.map(([code, count]) => {
            const active = filterType === code
            return (
              <button key={code} onClick={() => { setFilterType(active ? '' : code); setPage(1) }}
                className={`block w-full text-left text-xs py-0.5 transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}>
                {TYPE_LABELS[code] || code} <span className="text-gray-300">({count})</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Price</p>
        {priceFacets.map(pr => {
          const active = filterPrice === pr.key
          return (
            <button key={pr.key} onClick={() => { setFilterPrice(active ? '' : pr.key); setPage(1) }}
              className={`block w-full text-left text-xs py-0.5 transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}>
              {pr.label} <span className="text-gray-300">({pr.count})</span>
            </button>
          )
        })}
      </div>
      {storeFacets.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Store</p>
          {storeFacets.map(([store, count]) => {
            const active = filterStore === store
            return (
              <button key={store} onClick={() => { setFilterStore(active ? '' : store); setPage(1) }}
                className={`block w-full text-left text-xs py-0.5 truncate transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}>
                {store} <span className="text-gray-300">({count})</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // Mobile filter drawer
  const filterDrawer = showFilters && (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
      <div className="relative mt-auto bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Filters</p>
          <button onClick={() => setShowFilters(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {typeFacets.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ownership type</p>
              <div className="flex flex-wrap gap-2">
                {typeFacets.map(([code, count]) => {
                  const active = filterType === code
                  return (
                    <button key={code} onClick={() => { setFilterType(active ? '' : code); setPage(1) }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                      {TYPE_LABELS[code] || code} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Price</p>
            <div className="flex flex-wrap gap-2">
              {priceFacets.map(pr => {
                const active = filterPrice === pr.key
                return (
                  <button key={pr.key} onClick={() => { setFilterPrice(active ? '' : pr.key); setPage(1) }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                    {pr.label} ({pr.count})
                  </button>
                )
              })}
            </div>
          </div>
          {storeFacets.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Store</p>
              <div className="flex flex-wrap gap-2">
                {storeFacets.map(([store, count]) => {
                  const active = filterStore === store
                  return (
                    <button key={store} onClick={() => { setFilterStore(active ? '' : store); setPage(1) }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                      {store} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-gray-100">
          <button onClick={() => setShowFilters(false)}
            className="w-full py-2.5 bg-[#1a6847] text-white text-sm font-medium rounded-lg hover:bg-[#145236] transition-colors">
            Show {displayProducts.length.toLocaleString()} results
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      {filterDrawer}
      <main className="flex-1 max-w-xl lg:max-w-5xl mx-auto w-full px-4 lg:px-5 py-6 lg:py-8 flex flex-col">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 lg:px-6 py-5 lg:py-6 mb-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a6847] transition-colors mb-3">
            <ArrowLeft size={12} /> All categories
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900 mb-1">{cat.label}</h1>
          <p className="text-xs lg:text-sm text-gray-500 mb-4">
            {categoryProducts.length.toLocaleString()} products from {directoryStores.length} purpose-driven companies
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <Link key={c.slug} to={`/${c.slug}`}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  c.slug === slug ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-500 hover:text-[#1a6847]'
                }`}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Main content: sidebar + products */}
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-start">

          {/* Mobile: toolbar */}
          <div className="lg:hidden flex items-center gap-2">
            <button onClick={() => setShowFilters(true)}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${activeFilterCount > 0 ? 'bg-[#1a6847] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              <SlidersHorizontal size={13} />
              Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </button>
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}
              className="py-2 px-3 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 outline-none">
              <option value="relevance">Default</option>
              <option value="price-asc">Price: Low</option>
              <option value="price-desc">Price: High</option>
              <option value="store">Store A-Z</option>
            </select>
            <p className="text-xs text-gray-400 ml-auto">{displayProducts.length.toLocaleString()}</p>
          </div>

          {/* Mobile: active filter chips */}
          <div className="lg:hidden">{activeFilters}</div>

          {/* Desktop: sidebar */}
          {sidebar}

          {/* Results area */}
          <div className="flex-1 min-w-0">
            {/* Desktop: filter/refine bar */}
            <div className="hidden lg:flex bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-3 mb-3 items-center gap-2 flex-wrap">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input type="text" value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
                placeholder={`Filter ${cat.label.toLowerCase()} products...`}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder-gray-400" />
              {filter && (
                <button onClick={() => { setFilter(''); setPage(1) }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Clear</button>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown size={12} className="text-gray-400" />
                <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}
                  className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer">
                  <option value="relevance">Default</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="store">Store A-Z</option>
                </select>
              </div>
            </div>

            {/* Desktop: active filters */}
            <div className="hidden lg:block">{activeFilters}</div>

            {/* Results card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 lg:px-6 py-4 lg:py-5 mb-3">
              {/* Desktop header */}
              <div className="hidden lg:flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">
                  {displayProducts.length === categoryProducts.length
                    ? `${categoryProducts.length.toLocaleString()} products`
                    : `${displayProducts.length.toLocaleString()} of ${categoryProducts.length.toLocaleString()} products`}
                </p>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => setDesktopView('grid')}
                    className={`p-1.5 transition-colors ${desktopView === 'grid' ? 'bg-[#1a6847] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Grid3X3 size={14} />
                  </button>
                  <button onClick={() => setDesktopView('list')}
                    className={`p-1.5 transition-colors ${desktopView === 'list' ? 'bg-[#1a6847] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                    <List size={14} />
                  </button>
                </div>
              </div>

              {/* Mobile: 2-col grid */}
              <div className="lg:hidden grid grid-cols-2 gap-3">
                {paged.map(p => <ProductCard key={p.id} product={p} />)}
              </div>

              {/* Desktop: 4-col grid or list */}
              <div className="hidden lg:block">
                {desktopView === 'grid' ? (
                  <div className="grid grid-cols-4 gap-3">
                    {paged.map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                ) : (
                  <div>
                    {paged.map(p => <ProductListItem key={p.id} product={p} />)}
                  </div>
                )}
              </div>

              {displayProducts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No products found.</p>
              )}

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>

            {/* Directory section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 lg:px-6 py-5">
              <h2 className="text-sm font-bold text-gray-800 mb-1">{cat.label} Directory</h2>
              <p className="text-xs text-gray-400 mb-4">{directoryStores.length} purpose-driven companies</p>

              <div className="space-y-2">
                {directoryStores.map(store => (
                  <Link key={store.name} to={`/store/${slugify(store.name)}`}
                    className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#1a6847] transition-all">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-[#1a6847] leading-snug flex items-center gap-1.5">
                        {faviconUrl(store.url) && <img src={faviconUrl(store.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                        {store.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {store.productCount > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-[#1a6847] whitespace-nowrap">
                            {store.productCount} product{store.productCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {store.types.map(t => (
                          <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[t] || 'bg-gray-100 text-gray-500'}`}>
                            {TYPE_LABELS[t] || t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3">
          <Link to="/" className="hover:text-[#1a6847] transition-colors">&larr; All categories</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}

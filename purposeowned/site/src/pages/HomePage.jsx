import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { CATEGORIES } from '../lib/categories'
import { searchProducts, buildProductIndex } from '../lib/search'
import { slugify, faviconUrl } from '../lib/utils'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sort = searchParams.get('sort') || 'relevance'
  const filterCat = searchParams.get('cat') || ''
  const filterStore = searchParams.get('store') || ''
  const filterRefine = searchParams.get('refine') || ''
  const [products, setProducts] = useState([])
  const [searchIndex, setSearchIndex] = useState(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [inputValue, setInputValue] = useState(query)
  const [localRefine, setLocalRefine] = useState(filterRefine)
  const refineDebounceRef = useRef(null)

  const updateParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (!v || (v === '1' && k === 'page') || (v === 'relevance' && k === 'sort')) next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleSearchSubmit = useCallback((e) => {
    e?.preventDefault()
    updateParams({ q: inputValue, page: '1', cat: '', store: '', refine: '' })
    setLocalRefine('')
  }, [inputValue, updateParams])

  useEffect(() => { setInputValue(query) }, [query])
  useEffect(() => { setLocalRefine(filterRefine) }, [filterRefine])

  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    if (!query.trim()) return
    fetchedRef.current = true
    setLoadingProducts(true)
    fetch('/data/search.json')
      .then(r => r.json())
      .then(data => {
        const stores = data.s
        const hydrated = data.p.map(p => ({
          id: p[0], title: p[1], price: p[2] || null, image: p[3] || null,
          url: p[4], store_name: stores[p[5]].n, store_url: stores[p[5]].u,
          store_industry: stores[p[5]].i, product_type: p[6],
          tags: p[7], available: p[8] !== 0,
        }))
        setProducts(hydrated)
        setSearchIndex(buildProductIndex(hydrated))
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [query])

  const results = useMemo(() => searchProducts(query, products, searchIndex), [query, products, searchIndex])

  const filteredResults = useMemo(() => {
    let r = results
    if (filterCat) {
      const cat = CATEGORIES.find(c => c.slug === filterCat)
      if (cat) r = r.filter(p => p.store_industry === cat.industry)
    }
    if (filterStore) r = r.filter(p => p.store_name === filterStore)
    const terms = localRefine.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length > 0) {
      r = r.filter(p => {
        const text = (p.title || '') + ' ' + (p.tags || []).join(' ')
        return terms.every(t => text.toLowerCase().includes(t))
      })
    }
    return r
  }, [results, filterCat, filterStore, localRefine])

  const PER_PAGE = 40

  const sortedResults = useMemo(() => {
    if (sort === 'relevance') return filteredResults
    const sorted = [...filteredResults]
    if (sort === 'price-asc') sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
    if (sort === 'price-desc') sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0))
    if (sort === 'store') sorted.sort((a, b) => (a.store_name || '').localeCompare(b.store_name || ''))
    return sorted
  }, [filteredResults, sort])

  const totalPages = Math.ceil(sortedResults.length / PER_PAGE)
  const pagedResults = sortedResults.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const storeCount = useMemo(() => new Set(products.map(p => p.store_url)).size, [products])
  const searching = query.trim().length > 0

  const handleRefineChange = useCallback((refine) => {
    setLocalRefine(refine)
    clearTimeout(refineDebounceRef.current)
    refineDebounceRef.current = setTimeout(() => {
      updateParams({ refine, page: '1' })
    }, 300)
  }, [updateParams])

  // Facets for sidebar
  const storeFacets = useMemo(() => {
    const counts = new Map()
    for (const p of results) {
      counts.set(p.store_name, (counts.get(p.store_name) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
  }, [results])

  const industryFacets = useMemo(() => {
    const counts = new Map()
    for (const p of results) {
      if (p.store_industry) counts.set(p.store_industry, (counts.get(p.store_industry) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
  }, [results])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl xl:max-w-5xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Purpose Owned</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop B Corps, benefit corporations, and steward-owned businesses</p>

          <form onSubmit={handleSearchSubmit} className="flex gap-0">
            <input
              type="text"
              placeholder="Search 25,000+ products from B Corps..."
              className="w-full border border-gray-300 rounded-l-lg px-3 py-2.5 text-sm outline-none focus:border-[#1a6847] transition-colors bg-white"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="bg-[#1a6847] hover:bg-[#145236] text-white px-4 rounded-r-lg border border-[#1a6847] transition-colors shrink-0"
            >
              <Search size={16} />
            </button>
          </form>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Results link to company sites. We don't sell anything or earn a commission.</p>
        </div>

        {searching ? (
          loadingProducts ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Loading products...</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">No results for "{query}"</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Browse by industry</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.slug}
                      onClick={() => updateParams({ q: cat.label, page: '1' })}
                      className="py-1.5 px-3 rounded-lg text-xs font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#1a6847] hover:bg-emerald-50 transition-colors"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
              {/* Sidebar */}
              <div className="hidden xl:block w-56 shrink-0 space-y-3">
                {industryFacets.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Industry</p>
                    {industryFacets.map(([ind, count]) => {
                      const cat = CATEGORIES.find(c => c.industry === ind)
                      const active = cat && filterCat === cat.slug
                      return (
                        <button
                          key={ind}
                          onClick={() => updateParams({ cat: active ? '' : (cat?.slug || ''), page: '1' })}
                          className={`block w-full text-left text-xs py-0.5 transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}
                        >
                          {cat?.label || ind} <span className="text-gray-300">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {storeFacets.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Store</p>
                    {storeFacets.map(([store, count]) => {
                      const active = filterStore === store
                      return (
                        <button
                          key={store}
                          onClick={() => updateParams({ store: active ? '' : store, page: '1' })}
                          className={`block w-full text-left text-xs py-0.5 truncate transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}
                        >
                          {store} <span className="text-gray-300">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Results */}
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-3 mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={localRefine}
                    onChange={e => handleRefineChange(e.target.value)}
                    placeholder="Narrow results (e.g. organic, vegan, large)..."
                    className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                  />
                  {localRefine && (
                    <button onClick={() => handleRefineChange('')} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Clear</button>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">
                      {filteredResults.length === results.length
                        ? `${results.length} result${results.length !== 1 ? 's' : ''}`
                        : `${filteredResults.length} of ${results.length} results`}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown size={12} className="text-gray-400" />
                      <select
                        value={sort}
                        onChange={e => updateParams({ sort: e.target.value, page: '1' })}
                        className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="store">Store A-Z</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {pagedResults.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={p => updateParams({ page: String(p) })} />
                </div>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by industry</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => { setInputValue(cat.label); updateParams({ q: cat.label, page: '1' }) }}
                    className="py-2 px-4 rounded-lg text-sm font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#1a6847] hover:bg-emerald-50 transition-colors"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mt-3">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">What is this?</p>
              <div className="text-sm text-gray-600 space-y-2 max-w-lg mx-auto">
                <p>Purpose Owned is a searchable directory of products from businesses that have made a <strong>verifiable commitment</strong> to a mission beyond profit:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
                  <li><strong>Certified B Corps</strong> &mdash; verified social and environmental performance</li>
                  <li><strong>Benefit corporations &amp; L3Cs</strong> &mdash; legal structure that supports a purpose</li>
                  <li><strong>Steward-owned &amp; purpose trusts</strong> &mdash; legally committed to a mission (e.g. Newman's Own)</li>
                </ul>
                <p>Search for what you need, and buy directly from the company's own website.</p>
                <p className="text-xs text-gray-400 pt-1">Currently indexing 25,000+ products from 80+ purpose-driven companies, with more being added.</p>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-3">
          {products.length > 0
            ? <>{products.length.toLocaleString()} products from {storeCount} purpose-driven companies</>
            : <>25,000+ products from 80+ purpose-driven companies</>}
        </p>

      </main>

      <Footer />
    </div>
  )
}

export default HomePage

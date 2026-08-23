import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpDown, ChevronDown } from 'lucide-react'
import { SECTIONS, SECTION_SLUGS } from '../lib/categories'
import { searchProducts, searchCompanies } from '../lib/search'
import marketplaceData from '../data/marketplace.json'
import { slugify, faviconUrl, dedupeByUrl } from '../lib/utils'
import OwnershipBadge from '../components/OwnershipBadge'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'
import FilterSidebar from '../components/FilterSidebar'

const PICK_LABELS = { hits: 'The Hits', staff: 'Staff', cool: 'Cool', movement: 'Movement' }
const PICK_COLORS = { hits: 'text-[#004cb9]', staff: 'text-emerald-600', cool: 'text-purple-600', movement: 'text-[#BF0A30]' }
const PICK_BORDER_COLORS = { hits: '#BFC9E8', staff: '#B8E2D3', cool: '#DCCFF7', movement: '#EFC2CB' }
const PICK_ORDER = ['hits', 'staff', 'cool', 'movement']

function pickFeatured(items) {
  // Pick 2 per bucket from pre-curated pool
  // Rules: one per store globally, prefer different categories within each bucket
  // Pick order: most constrained buckets first (movement has fewest stores)
  const usedStores = new Set()
  const pickOrder = ['movement', 'cool', 'staff', 'hits']
  const result = {}
  for (const bucket of pickOrder) {
    const pool = items.filter(i => i.pick === bucket && i.available !== false && !usedStores.has(i.store_name))
      .sort(() => Math.random() - 0.5)
    const picked = []
    const bucketSections = new Set()
    // First pass: prefer different sections
    for (const item of pool) {
      if (picked.length >= 2) break
      if (bucketSections.has(item.site_section)) continue
      usedStores.add(item.store_name)
      bucketSections.add(item.site_section)
      picked.push(item)
    }
    // Second pass: drop section constraint if needed
    if (picked.length < 2) {
      for (const item of pool) {
        if (picked.length >= 2) break
        if (picked.some(p => p.id === item.id)) continue
        if (usedStores.has(item.store_name)) continue
        usedStores.add(item.store_name)
        picked.push(item)
      }
    }
    result[bucket] = picked
  }
  return PICK_ORDER.map(b => result[b])
}

function MarketplaceIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sort = searchParams.get('sort') || 'relevance'
  const filterCat = searchParams.get('cat') || ''
  const filterStore = searchParams.get('store') || ''
  const filterPmin = searchParams.get('pmin') || ''
  const filterPmax = searchParams.get('pmax') || ''
  const filterRefine = searchParams.get('refine') || ''
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [featured, setFeatured] = useState([])
  const [inputValue, setInputValue] = useState(query)
  const [searchCat, setSearchCat] = useState('')
  const [companiesExpanded, setCompaniesExpanded] = useState(false)
  const priceDebounceRef = useRef(null)
  const refineDebounceRef = useRef(null)
  const [localPmin, setLocalPmin] = useState(filterPmin)
  const [localPmax, setLocalPmax] = useState(filterPmax)
  const [localRefine, setLocalRefine] = useState(filterRefine)

  const updateParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === '1' && k === 'page' || v === 'relevance' && k === 'sort') next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleSearchSubmit = useCallback((e) => {
    e?.preventDefault()
    updateParams({ q: inputValue, page: '1', cat: searchCat, store: '', pmin: '', pmax: '', refine: '' })
    setLocalPmin('')
    setLocalPmax('')
    setLocalRefine('')
  }, [inputValue, searchCat, updateParams])

  useEffect(() => { setInputValue(query); setCompaniesExpanded(false) }, [query])
  useEffect(() => { setLocalPmin(filterPmin) }, [filterPmin])
  useEffect(() => { setLocalPmax(filterPmax) }, [filterPmax])
  useEffect(() => { setLocalRefine(filterRefine) }, [filterRefine])

  const fetchedRef = useRef(false)

  useEffect(() => {
    fetch('/data/featured.json')
      .then(r => r.json())
      .then(items => setFeatured(pickFeatured(items)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.title = 'Market Place | Shop worker and employee owned online stores for apparel, home goods, food and more'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse worker and employee owned online stores by category or search thousands of products from cooperatives and employee-owned companies.')
    const canonical = 'https://www.workerowned.info/marketplace'
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    if (!query.trim()) return
    fetchedRef.current = true
    setLoadingProducts(true)
    fetch('/data/search.json')
      .then(r => r.json())
      .then(data => {
        // Hydrate compact format: [id, title, price, image, url, storeIdx, section, tags, available, formats?]
        const stores = data.s
        const hydrated = data.p.map(p => {
          const store = stores[p[5]]
          const product = {
            id: p[0], title: p[1], price: p[2] || null, image: p[3] || null,
            url: p[4], store_name: store.n, store_url: store.u, ownership_type: store.o,
            site_section: p[6], tags: p[7], available: p[8] !== 0,
          }
          if (p[9]) product.formats = p[9]
          return product
        })
        setProducts(hydrated)
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [query])

  const allCompanies = useMemo(() => dedupeByUrl(marketplaceData), [])
  const scrapedStores = useMemo(() => new Set(products.map(p => p.store_name)), [products])
  const companyResults = useMemo(() =>
    searchCompanies(query, allCompanies).filter(c => !scrapedStores.has(c.name)),
    [query, allCompanies, scrapedStores])
  const results = useMemo(() => searchProducts(query, products).filter(p => p.available !== false), [query, products])

  // Apply filters: category → store → price → refine keywords
  const filteredResults = useMemo(() => {
    let r = results
    if (filterCat) r = r.filter(p => p.site_section === filterCat)
    if (filterStore) r = r.filter(p => p.store_name === filterStore)
    if (filterPmin) r = r.filter(p => p.price && parseFloat(p.price) >= parseFloat(filterPmin))
    if (filterPmax) r = r.filter(p => p.price && parseFloat(p.price) <= parseFloat(filterPmax))
    const terms = filterRefine.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length > 0) {
      r = r.filter(p => {
        const title = (p.title || '').toLowerCase()
        return terms.every(t => title.includes(t) || (p.tags || []).some(tag => tag.toLowerCase().includes(t)))
      })
    }
    return r
  }, [results, filterCat, filterStore, filterPmin, filterPmax, filterRefine])

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

  const handlePriceChange = useCallback((pmin, pmax) => {
    setLocalPmin(pmin)
    setLocalPmax(pmax)
    clearTimeout(priceDebounceRef.current)
    priceDebounceRef.current = setTimeout(() => {
      updateParams({ pmin, pmax, page: '1' })
    }, 300)
  }, [updateParams])

  const handleRefineChange = useCallback((refine) => {
    setLocalRefine(refine)
    clearTimeout(refineDebounceRef.current)
    refineDebounceRef.current = setTimeout(() => {
      updateParams({ refine, page: '1' })
    }, 300)
  }, [updateParams])

  const handleClearFilters = useCallback(() => {
    setLocalPmin('')
    setLocalPmax('')
    setLocalRefine('')
    updateParams({ cat: '', store: '', pmin: '', pmax: '', refine: '', page: '1' })
  }, [updateParams])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl xl:max-w-5xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker and employee owned businesses online</p>

          <form onSubmit={handleSearchSubmit} className="flex">
            <select
              value={searchCat}
              onChange={e => setSearchCat(e.target.value)}
              className="border border-gray-300 border-r-0 rounded-l-lg px-2 py-2.5 text-xs text-gray-600 bg-gray-50 outline-none focus:border-[#004cb9] shrink-0 cursor-pointer"
            >
              <option value="">All</option>
              {SECTIONS.map(s => (
                <option key={s.slug} value={s.sectionName}>{s.label}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search products or stores…"
                className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="bg-[#004cb9] hover:bg-[#003a8c] text-white px-4 rounded-r-lg border border-[#004cb9] transition-colors shrink-0"
            >
              <Search size={16} />
            </button>
          </form>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Results are links to company sites. We don't sell anything or earn a commission.</p>
        </div>

        {searching ? (
          loadingProducts ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Searching...</p>
              </div>
            </div>
          ) : results.length === 0 && companyResults.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">No results for "{query}"</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Browse by category</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SECTIONS.map(cat => (
                    <Link
                      key={cat.slug}
                      to={`/marketplace/${cat.slug}`}
                      className="py-1.5 px-3 rounded-lg text-xs font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 transition-colors"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
              <FilterSidebar
                products={results}
                activeCategory={filterCat}
                activeStore={filterStore}
                priceMin={localPmin}
                priceMax={localPmax}
                refine={localRefine}
                onCategoryChange={cat => updateParams({ cat, page: '1', store: '' })}
                onStoreChange={store => updateParams({ store, page: '1' })}
                onPriceChange={handlePriceChange}
                onRefineChange={handleRefineChange}
                onClear={handleClearFilters}
              />
              <div className="flex-1 min-w-0">
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
                        <option value="store">Store A–Z</option>
                      </select>
                    </div>
                  </div>
                  {filteredResults.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-2">No results match your filters.</p>
                      <button onClick={handleClearFilters} className="text-xs text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {pagedResults.map(p => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>
                      <Pagination page={page} totalPages={totalPages} onPageChange={p => updateParams({ page: String(p) })} />
                    </>
                  )}
                </div>
                {companyResults.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full mt-4">
                    <button
                      onClick={() => setCompaniesExpanded(e => !e)}
                      className="w-full px-6 py-4 flex items-center justify-between"
                    >
                      <p className="text-xs text-gray-400 text-left">You may find similar items at these worker or employee owned companies — visit their sites too</p>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${companiesExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {companiesExpanded && (
                      <div className="px-6 pb-5 space-y-2">
                        {companyResults.slice(0, 10).map(c => (
                          <Link key={c.id} to={`/marketplace/store/${slugify(c.name)}`} className="flex items-center gap-3 bg-[#f5f5f7] rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors">
                            {c.url && <img src={faviconUrl(c.url)} alt="" width="16" height="16" className="shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                                <OwnershipBadge type={c.ownership_type} />
                              </div>
                              {c.notes && <p className="text-xs text-gray-500 truncate">{c.notes}</p>}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{c.site_section}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by category</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SECTIONS.map(cat => (
                  <Link
                    key={cat.slug}
                    to={`/marketplace/${cat.slug}`}
                    className="py-2 px-4 rounded-lg text-sm font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>

            {featured.some(col => col.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mt-3">
                <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Featured Products</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {featured.map((col, i) => (
                    <div key={PICK_ORDER[i]}>
                      <p className={`text-xs font-bold mb-2 text-center ${PICK_COLORS[PICK_ORDER[i]]}`}>{PICK_LABELS[PICK_ORDER[i]]}</p>
                      <div className="space-y-3">
                        {col.map(p => (
                          <div key={p.id} className="flex flex-col">
                            <div className="flex-1">
                              <ProductCard product={p} compact borderColor={PICK_BORDER_COLORS[PICK_ORDER[i]]} />
                            </div>
                            {p.site_section && SECTION_SLUGS[p.site_section] && (
                              <Link to={`/marketplace/${SECTION_SLUGS[p.site_section]}`} className="text-[10px] text-[#004cb9] hover:text-[#BF0A30] transition-colors mt-1 text-center block">
                                Browse more {p.site_section.toLowerCase()} &rarr;
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link to="/coffee" className="block bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-4 mt-3 hover:border-[#004cb9] transition-colors">
              <div className="flex items-center justify-center gap-2.5">
                <img src="/logo-coffee.png" alt="" width="28" height="28" className="shrink-0" />
                <span className="text-sm text-[#004cb9] font-semibold"><strong>Quick Tool:</strong> worker owned coffee shops, bars, restaurants, and groceries near you!</span>
              </div>
            </Link>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-3">
          {products.length > 0
            ? <>{products.length.toLocaleString()} products from {storeCount} worker and employee owned companies</>
            : <>70,000+ products from 175+ worker and employee owned companies</>}
        </p>

        <div className="mt-2 text-center space-y-1">
          <div>
            <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
              Submit a worker or employee owned business &rarr;
            </Link>
          </div>
          <div>
            <Link to="/faq" className="text-xs text-gray-400 hover:text-[#004cb9] transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

export default MarketplaceIndexPage

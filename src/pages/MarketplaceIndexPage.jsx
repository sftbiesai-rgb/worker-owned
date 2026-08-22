import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpDown } from 'lucide-react'
import { SECTIONS } from '../lib/categories'
import { searchProducts, searchCompanies } from '../lib/search'
import marketplaceData from '../data/marketplace.json'
import { slugify, faviconUrl, dedupeByUrl } from '../lib/utils'
import OwnershipBadge from '../components/OwnershipBadge'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'
import FilterSidebar from '../components/FilterSidebar'

function MarketplaceIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sort = searchParams.get('sort') || 'relevance'
  const filterCat = searchParams.get('cat') || ''
  const filterStore = searchParams.get('store') || ''
  const filterPmin = searchParams.get('pmin') || ''
  const filterPmax = searchParams.get('pmax') || ''
  const [products, setProducts] = useState([])
  const [inputValue, setInputValue] = useState(query)
  const debounceRef = useRef(null)
  const priceDebounceRef = useRef(null)
  const [localPmin, setLocalPmin] = useState(filterPmin)
  const [localPmax, setLocalPmax] = useState(filterPmax)

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

  const handleSearchInput = useCallback((value) => {
    setInputValue(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value, page: '1', cat: '', store: '', pmin: '', pmax: '' })
      setLocalPmin('')
      setLocalPmax('')
    }, 250)
  }, [updateParams])

  useEffect(() => { setInputValue(query) }, [query])
  useEffect(() => { setLocalPmin(filterPmin) }, [filterPmin])
  useEffect(() => { setLocalPmax(filterPmax) }, [filterPmax])

  const fetchedRef = useRef(false)

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
    if (!inputValue.trim() && !query.trim()) return
    fetchedRef.current = true
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
  }, [inputValue, query])

  const allCompanies = useMemo(() => dedupeByUrl(marketplaceData), [])
  const companyResults = useMemo(() => searchCompanies(inputValue, allCompanies), [inputValue, allCompanies])
  const results = useMemo(() => searchProducts(inputValue, products), [inputValue, products])

  // Apply filters: category → store → price
  const filteredResults = useMemo(() => {
    let r = results
    if (filterCat) r = r.filter(p => p.site_section === filterCat)
    if (filterStore) r = r.filter(p => p.store_name === filterStore)
    if (filterPmin) r = r.filter(p => p.price && parseFloat(p.price) >= parseFloat(filterPmin))
    if (filterPmax) r = r.filter(p => p.price && parseFloat(p.price) <= parseFloat(filterPmax))
    return r
  }, [results, filterCat, filterStore, filterPmin, filterPmax])

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

  const searching = inputValue.trim().length > 0

  const handlePriceChange = useCallback((pmin, pmax) => {
    setLocalPmin(pmin)
    setLocalPmax(pmax)
    clearTimeout(priceDebounceRef.current)
    priceDebounceRef.current = setTimeout(() => {
      updateParams({ pmin, pmax, page: '1' })
    }, 300)
  }, [updateParams])

  const handleClearFilters = useCallback(() => {
    setLocalPmin('')
    setLocalPmax('')
    updateParams({ cat: '', store: '', pmin: '', pmax: '', page: '1' })
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

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products or stores…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
              value={inputValue}
              onChange={e => handleSearchInput(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Results are links to company sites. We don't sell anything or earn a commission.</p>
        </div>

        {searching && companyResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Companies</p>
            <div className="space-y-2">
              {companyResults.slice(0, 5).map(c => (
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
          </div>
        )}

        {searching ? (
          results.length === 0 && companyResults.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">No results for "{inputValue}"</p>
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
                onCategoryChange={cat => updateParams({ cat, page: '1', store: '' })}
                onStoreChange={store => updateParams({ store, page: '1' })}
                onPriceChange={handlePriceChange}
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
            : <>98,000+ products from 160+ worker and employee owned companies</>}
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

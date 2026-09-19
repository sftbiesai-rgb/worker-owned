import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpDown, SlidersHorizontal, X, List, Grid3X3 } from 'lucide-react'
import { CATEGORIES, categoryForIndustry } from '../lib/categories'
import { searchProducts, buildProductIndex } from '../lib/search'
import { slugify, faviconUrl } from '../lib/utils'
import ProductCard from '../components/ProductCard'
import ProductListItem from '../components/ProductListItem'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }

const PRICE_RANGES = [
  { key: 'under25', label: 'Under $25', min: 0, max: 25 },
  { key: '25-50', label: '$25 – $50', min: 25, max: 50 },
  { key: '50-100', label: '$50 – $100', min: 50, max: 100 },
  { key: '100-250', label: '$100 – $250', min: 100, max: 250 },
  { key: 'over250', label: '$250+', min: 250, max: Infinity },
]

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sort = searchParams.get('sort') || 'relevance'
  const filterCat = searchParams.get('cat') || ''
  const filterStore = searchParams.get('store') || ''
  const filterRefine = searchParams.get('refine') || ''
  const filterType = searchParams.get('type') || ''
  const filterPrice = searchParams.get('price') || ''
  const showSoldOut = searchParams.get('soldout') === '1'
  const [products, setProducts] = useState([])
  const [searchIndex, setSearchIndex] = useState(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [inputValue, setInputValue] = useState(query)
  const [localRefine, setLocalRefine] = useState(filterRefine)
  const [showFilters, setShowFilters] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [desktopView, setDesktopView] = useState('grid')
  const refineDebounceRef = useRef(null)
  const suggestDebounceRef = useRef(null)
  const inputRef = useRef(null)

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
    setShowSuggestions(false)
    updateParams({ q: inputValue, page: '1', cat: '', store: '', refine: '', type: '', price: '' })
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
        const hydrated = data.p
          .map((p, i) => ({
            id: i, title: p[1], price: (p[2] && parseFloat(p[2]) > 0) ? p[2] : null, image: p[3] || null,
            url: p[4], store_name: stores[p[0]].n, store_url: stores[p[0]].u,
            store_industry: stores[p[0]].i, product_type: p[6],
            tags: p[7], available: p[5] !== 0,
            ownership_types: stores[p[0]].t || [],
          }))
          .filter(p => p.image) // hide products without images
        setProducts(hydrated)
        setSearchIndex(buildProductIndex(hydrated))
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [query])

  // Autocomplete suggestions
  const handleInputChange = useCallback((val) => {
    setInputValue(val)
    clearTimeout(suggestDebounceRef.current)
    if (!val.trim() || !searchIndex) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    suggestDebounceRef.current = setTimeout(() => {
      const results = searchIndex.autoSuggest(val.trim(), { limit: 6 })
      setSuggestions(results.map(r => r.suggestion).filter(s => s !== val.trim().toLowerCase()))
      setShowSuggestions(true)
    }, 150)
  }, [searchIndex])

  const results = useMemo(() => searchProducts(query, products, searchIndex), [query, products, searchIndex])

  // Base results with only in-stock filter applied (for computing facet counts)
  const baseFiltered = useMemo(() => {
    let r = results
    if (!showSoldOut) r = r.filter(p => p.available !== false)
    return r
  }, [results, showSoldOut])

  const filteredResults = useMemo(() => {
    let r = baseFiltered
    if (filterCat) {
      const cat = CATEGORIES.find(c => c.slug === filterCat)
      if (cat) r = r.filter(p => cat.industries.includes(p.store_industry))
    }
    if (filterStore) r = r.filter(p => p.store_name === filterStore)
    if (filterType) r = r.filter(p => (p.ownership_types || []).includes(filterType))
    if (filterPrice) {
      const range = PRICE_RANGES.find(pr => pr.key === filterPrice)
      if (range) r = r.filter(p => {
        const price = parseFloat(p.price)
        return !isNaN(price) && price >= range.min && price < range.max
      })
    }
    const terms = localRefine.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length > 0) {
      r = r.filter(p => {
        const text = (p.title || '') + ' ' + (p.product_type || '') + ' ' + (p.store_name || '')
        return terms.every(t => text.toLowerCase().includes(t))
      })
    }
    return r
  }, [baseFiltered, filterCat, filterStore, filterType, filterPrice, localRefine])

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

  const activeFilterCount = [filterType, filterPrice, filterCat, filterStore].filter(Boolean).length

  // Dynamic facet counts — computed against baseFiltered (respects in-stock but not other facets)
  const typeFacets = useMemo(() => {
    const counts = new Map()
    for (const p of baseFiltered) {
      for (const t of (p.ownership_types || [])) {
        counts.set(t, (counts.get(t) || 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [baseFiltered])

  const priceFacets = useMemo(() => {
    return PRICE_RANGES.map(pr => {
      const count = baseFiltered.filter(p => {
        const price = parseFloat(p.price)
        return !isNaN(price) && price >= pr.min && price < pr.max
      }).length
      return { ...pr, count }
    }).filter(pr => pr.count > 0)
  }, [baseFiltered])

  const industryFacets = useMemo(() => {
    const counts = new Map()
    for (const p of baseFiltered) {
      const cat = categoryForIndustry(p.store_industry)
      if (cat) counts.set(cat.slug, (counts.get(cat.slug) || 0) + 1)
    }
    return CATEGORIES
      .filter(c => counts.has(c.slug))
      .map(c => [c.slug, counts.get(c.slug)])
      .sort((a, b) => b[1] - a[1])
  }, [baseFiltered])

  const storeFacets = useMemo(() => {
    const counts = new Map()
    for (const p of baseFiltered) {
      counts.set(p.store_name, (counts.get(p.store_name) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [baseFiltered])

  // Search box with autocomplete
  const searchBox = (
    <div className="relative">
      <form onSubmit={handleSearchSubmit} className="flex gap-0">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search 64,000+ products..."
          className="w-full border border-gray-300 rounded-l-lg px-3 py-2.5 text-sm outline-none focus:border-[#1a6847] transition-colors bg-white"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          autoFocus
        />
        <button
          type="submit"
          className="bg-[#1a6847] hover:bg-[#145236] text-white px-4 rounded-r-lg border border-[#1a6847] transition-colors shrink-0"
        >
          <Search size={16} />
        </button>
      </form>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#f5f5f7] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(s)
                setShowSuggestions(false)
                updateParams({ q: s, page: '1', cat: '', store: '', refine: '', type: '', price: '' })
                setLocalRefine('')
              }}
            >
              <Search size={12} className="inline mr-2 text-gray-400" />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Active filter chips (shared)
  const activeFilters = (filterCat || filterStore || filterType || filterPrice) ? (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {filterType && (
        <button onClick={() => updateParams({ type: '', page: '1' })} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {TYPE_LABELS[filterType] || filterType} <X size={10} />
        </button>
      )}
      {filterPrice && (
        <button onClick={() => updateParams({ price: '', page: '1' })} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {PRICE_RANGES.find(pr => pr.key === filterPrice)?.label} <X size={10} />
        </button>
      )}
      {filterCat && (
        <button onClick={() => updateParams({ cat: '', page: '1' })} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {CATEGORIES.find(c => c.slug === filterCat)?.label} <X size={10} />
        </button>
      )}
      {filterStore && (
        <button onClick={() => updateParams({ store: '', page: '1' })} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-[#1a6847] px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
          {filterStore} <X size={10} />
        </button>
      )}
    </div>
  ) : null

  // Sidebar facet section (desktop)
  const sidebar = (
    <div className="hidden xl:block w-56 shrink-0 space-y-3">
      {typeFacets.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ownership type</p>
          {typeFacets.map(([code, count]) => {
            const active = filterType === code
            return (
              <button key={code} onClick={() => updateParams({ type: active ? '' : code, page: '1' })}
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
            <button key={pr.key} onClick={() => updateParams({ price: active ? '' : pr.key, page: '1' })}
              className={`block w-full text-left text-xs py-0.5 transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}>
              {pr.label} <span className="text-gray-300">({pr.count})</span>
            </button>
          )
        })}
      </div>
      {industryFacets.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Industry</p>
          {industryFacets.map(([catSlug, count]) => {
            const cat = CATEGORIES.find(c => c.slug === catSlug)
            const active = filterCat === catSlug
            return (
              <button key={catSlug} onClick={() => updateParams({ cat: active ? '' : catSlug, page: '1' })}
                className={`block w-full text-left text-xs py-0.5 transition-colors ${active ? 'text-[#1a6847] font-semibold' : 'text-gray-600 hover:text-[#1a6847]'}`}>
                {cat?.label || catSlug} <span className="text-gray-300">({count})</span>
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
              <button key={store} onClick={() => updateParams({ store: active ? '' : store, page: '1' })}
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
    <div className="xl:hidden fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
      <div className="relative mt-auto bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Filters</p>
          <button onClick={() => setShowFilters(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Ownership type */}
          {typeFacets.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ownership type</p>
              <div className="flex flex-wrap gap-2">
                {typeFacets.map(([code, count]) => {
                  const active = filterType === code
                  return (
                    <button key={code} onClick={() => updateParams({ type: active ? '' : code, page: '1' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                      {TYPE_LABELS[code] || code} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Price */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Price</p>
            <div className="flex flex-wrap gap-2">
              {priceFacets.map(pr => {
                const active = filterPrice === pr.key
                return (
                  <button key={pr.key} onClick={() => updateParams({ price: active ? '' : pr.key, page: '1' })}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                    {pr.label} ({pr.count})
                  </button>
                )
              })}
            </div>
          </div>
          {/* Industry */}
          {industryFacets.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Industry</p>
              <div className="flex flex-wrap gap-2">
                {industryFacets.map(([catSlug, count]) => {
                  const cat = CATEGORIES.find(c => c.slug === catSlug)
                  const active = filterCat === catSlug
                  return (
                    <button key={catSlug} onClick={() => updateParams({ cat: active ? '' : catSlug, page: '1' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                      {cat?.label || catSlug} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Store */}
          {storeFacets.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Store</p>
              <div className="flex flex-wrap gap-2">
                {storeFacets.map(([store, count]) => {
                  const active = filterStore === store
                  return (
                    <button key={store} onClick={() => updateParams({ store: active ? '' : store, page: '1' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-600'}`}>
                      {store} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Sold out toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showSoldOut}
              onChange={e => updateParams({ soldout: e.target.checked ? '1' : '', page: '1' })}
              className="accent-[#1a6847] w-4 h-4" />
            Show sold-out products
          </label>
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-gray-100">
          <button onClick={() => setShowFilters(false)}
            className="w-full py-2.5 bg-[#1a6847] text-white text-sm font-medium rounded-lg hover:bg-[#145236] transition-colors">
            Show {filteredResults.length.toLocaleString()} results
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      {filterDrawer}
      <main className="flex-1 max-w-xl xl:max-w-5xl mx-auto w-full px-4 xl:px-5 py-6 xl:py-8 flex flex-col">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 xl:px-6 py-5 xl:py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <h1 className="text-xl xl:text-2xl font-bold tracking-tight text-gray-900">Purpose Owned</h1>
          </div>
          <p className="text-center text-xs xl:text-sm text-gray-500 mb-3 xl:mb-4">Shop B Corps, benefit corporations, and steward-owned businesses</p>
          {searchBox}
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
                <p className="text-sm text-gray-500 mb-4">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Browse by category</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.map(cat => (
                    <Link key={cat.slug} to={`/${cat.slug}`}
                      className="py-1.5 px-3 rounded-lg text-xs font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#1a6847] hover:bg-emerald-50 transition-colors">
                      {cat.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row gap-3 xl:gap-4 xl:items-start">

              {/* Mobile: toolbar with filter button + sort */}
              <div className="xl:hidden flex items-center gap-2">
                <button onClick={() => setShowFilters(true)}
                  className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${activeFilterCount > 0 ? 'bg-[#1a6847] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                  <SlidersHorizontal size={13} />
                  Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
                </button>
                <select value={sort} onChange={e => updateParams({ sort: e.target.value, page: '1' })}
                  className="py-2 px-3 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 outline-none">
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low</option>
                  <option value="price-desc">Price: High</option>
                  <option value="store">Store A-Z</option>
                </select>
                <p className="text-xs text-gray-400 ml-auto">{filteredResults.length.toLocaleString()}</p>
              </div>

              {/* Mobile: active filter chips */}
              <div className="xl:hidden">
                {activeFilters}
              </div>

              {/* Desktop: sidebar */}
              {sidebar}

              {/* Results area */}
              <div className="flex-1 min-w-0">
                {/* Desktop: refine bar */}
                <div className="hidden xl:flex bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-3 mb-3 items-center gap-2 flex-wrap">
                  <SlidersHorizontal size={14} className="text-gray-400 shrink-0" />
                  <input type="text" value={localRefine} onChange={e => handleRefineChange(e.target.value)}
                    placeholder="Narrow results (e.g. organic, vegan, white)..."
                    className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder-gray-400" />
                  {localRefine && (
                    <button onClick={() => handleRefineChange('')} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Clear</button>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 cursor-pointer select-none ml-auto">
                    <input type="checkbox" checked={showSoldOut}
                      onChange={e => updateParams({ soldout: e.target.checked ? '1' : '', page: '1' })}
                      className="accent-[#1a6847]" />
                    Show sold out
                  </label>
                </div>

                {/* Desktop: active filters */}
                <div className="hidden xl:block">{activeFilters}</div>

                {/* Results card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 xl:px-6 py-4 xl:py-5">
                  {/* Desktop header with count, sort, view toggle */}
                  <div className="hidden xl:flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">
                      {filteredResults.length === baseFiltered.length
                        ? `${baseFiltered.length.toLocaleString()} results`
                        : `${filteredResults.length.toLocaleString()} of ${baseFiltered.length.toLocaleString()} results`}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown size={12} className="text-gray-400" />
                        <select value={sort} onChange={e => updateParams({ sort: e.target.value, page: '1' })}
                          className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer">
                          <option value="relevance">Relevance</option>
                          <option value="price-asc">Price: Low to High</option>
                          <option value="price-desc">Price: High to Low</option>
                          <option value="store">Store A-Z</option>
                        </select>
                      </div>
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
                  </div>

                  {/* Mobile: grid view */}
                  <div className="xl:hidden grid grid-cols-2 gap-3">
                    {pagedResults.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>

                  {/* Desktop: grid or list */}
                  <div className="hidden xl:block">
                    {desktopView === 'grid' ? (
                      <div className="grid grid-cols-4 gap-3">
                        {pagedResults.map(p => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>
                    ) : (
                      <div>
                        {pagedResults.map(p => (
                          <ProductListItem key={p.id} product={p} />
                        ))}
                      </div>
                    )}
                  </div>

                  <Pagination page={page} totalPages={totalPages} onPageChange={p => updateParams({ page: String(p) })} />
                </div>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 xl:px-6 py-5">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by category</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CATEGORIES.map(cat => (
                  <Link key={cat.slug}
                    to={`/${cat.slug}`}
                    className="py-2 px-4 rounded-lg text-sm font-medium bg-[#f5f5f7] text-gray-600 hover:text-[#1a6847] hover:bg-emerald-50 transition-colors">
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 xl:px-6 py-5 mt-3">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">What is this?</p>
              <div className="text-sm text-gray-600 space-y-2 max-w-lg mx-auto">
                <p>Purpose Owned is a searchable directory of products from businesses that have made a <strong>verifiable commitment</strong> to a mission beyond profit:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
                  <li><strong>Certified B Corps</strong> &mdash; verified social and environmental performance</li>
                  <li><strong>Benefit corporations &amp; L3Cs</strong> &mdash; legal structure that supports a purpose</li>
                  <li><strong>Steward-owned &amp; purpose trusts</strong> &mdash; legally committed to a mission (e.g. Newman's Own)</li>
                </ul>
                <p>Search for what you need, and buy directly from the company's own website.</p>
                <p className="text-xs text-gray-400 pt-1">Currently indexing 64,000+ products from 230+ purpose-driven companies, with more being added.</p>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-3">
          {products.length > 0
            ? <>{products.length.toLocaleString()} products from {storeCount} purpose-driven companies</>
            : <>64,000+ products from 230+ purpose-driven companies</>}
        </p>

      </main>

      <Footer />
    </div>
  )
}

export default HomePage

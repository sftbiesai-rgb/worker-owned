import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Search, ArrowUpDown, Grid3X3, List } from 'lucide-react'
import { CATEGORIES, categoryBySlug } from '../lib/categories'
import { slugify, faviconUrl } from '../lib/utils'
import ProductCard from '../components/ProductCard'
import ProductListItem from '../components/ProductListItem'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'bg-emerald-100 text-emerald-700', F: 'bg-blue-100 text-blue-700', P: 'bg-amber-100 text-amber-700', S: 'bg-purple-100 text-purple-700', '1': 'bg-rose-100 text-rose-700' }

export default function CategoryPage() {
  const { category: slug } = useParams()
  const cat = categoryBySlug(slug)

  const [allProducts, setAllProducts] = useState([])
  const [allStores, setAllStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('relevance')
  const [filter, setFilter] = useState('')
  const [desktopView, setDesktopView] = useState('grid')
  const PER_PAGE = 40

  useEffect(() => {
    fetch('/data/search.json')
      .then(r => r.json())
      .then(data => {
        const stores = data.s
        setAllStores(stores)
        const hydrated = data.p
          .map((p, i) => ({
            id: i, title: p[1], price: (p[2] && parseFloat(p[2]) > 0) ? p[2] : null, image: p[3] || null,
            url: p[4], store_name: stores[p[0]].n, store_url: stores[p[0]].u,
            store_industry: stores[p[0]].i, product_type: p[6],
            tags: p[7], available: p[5] !== 0,
            ownership_types: stores[p[0]].t || [],
          }))
          .filter(p => p.image)
        setAllProducts(hydrated)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (cat) {
      document.title = `${cat.label} — Purpose Owned`
    }
  }, [cat])

  // Reset page when category changes
  useEffect(() => { setPage(1); setFilter('') }, [slug])

  // Products in this category
  const categoryProducts = useMemo(() => {
    if (!cat) return []
    return allProducts
      .filter(p => p.available !== false)
      .filter(p => cat.industries.includes(p.store_industry))
  }, [allProducts, cat])

  // Filtered + sorted products
  const displayProducts = useMemo(() => {
    let r = categoryProducts
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
  }, [categoryProducts, sort, filter])

  const totalPages = Math.ceil(displayProducts.length / PER_PAGE)
  const paged = displayProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Directory: all stores in this category (with and without products)
  const directoryStores = useMemo(() => {
    if (!cat) return []
    const storesInCat = allStores.filter(s => cat.industries.includes(s.i))
    const productCounts = new Map()
    for (const p of categoryProducts) {
      productCounts.set(p.store_name, (productCounts.get(p.store_name) || 0) + 1)
    }
    return storesInCat
      .map(s => ({
        name: s.n,
        url: s.u,
        types: s.t || [],
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl xl:max-w-5xl mx-auto w-full px-4 xl:px-5 py-6 xl:py-8 flex flex-col">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 xl:px-6 py-5 xl:py-6 mb-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a6847] transition-colors mb-3">
            <ArrowLeft size={12} /> All categories
          </Link>
          <h1 className="text-xl xl:text-2xl font-bold tracking-tight text-gray-900 mb-1">{cat.label}</h1>
          <p className="text-xs xl:text-sm text-gray-500">
            {categoryProducts.length.toLocaleString()} products from {directoryStores.length} purpose-driven companies
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {CATEGORIES.map(c => (
              <Link
                key={c.slug}
                to={`/${c.slug}`}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  c.slug === slug
                    ? 'bg-[#1a6847] text-white'
                    : 'bg-[#f5f5f7] text-gray-500 hover:text-[#1a6847]'
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Products section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 xl:px-6 py-4 xl:py-5 mb-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex-1 min-w-[120px] relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filter}
                onChange={e => { setFilter(e.target.value); setPage(1) }}
                placeholder={`Filter ${cat.label.toLowerCase()} products...`}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-[#f5f5f7] focus:outline-none focus:border-[#1a6847] placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-gray-400" />
              <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}
                className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer">
                <option value="relevance">Default</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="store">Store A-Z</option>
              </select>
            </div>
            <div className="hidden xl:flex items-center border border-gray-200 rounded-lg overflow-hidden">
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

          <p className="text-xs text-gray-400 mb-3">
            {displayProducts.length === categoryProducts.length
              ? `${categoryProducts.length.toLocaleString()} products`
              : `${displayProducts.length.toLocaleString()} of ${categoryProducts.length.toLocaleString()} products`}
          </p>

          {/* Mobile: grid */}
          <div className="xl:hidden grid grid-cols-2 gap-3">
            {paged.map(p => <ProductCard key={p.id} product={p} />)}
          </div>

          {/* Desktop: grid or list */}
          <div className="hidden xl:block">
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 xl:px-6 py-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">{cat.label} Directory</h2>
          <p className="text-xs text-gray-400 mb-4">{directoryStores.length} purpose-driven companies</p>

          <div className="space-y-2">
            {directoryStores.map(store => (
              <Link
                key={store.name}
                to={`/store/${slugify(store.name)}`}
                className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#1a6847] transition-all"
              >
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

        <p className="text-center text-xs text-gray-400 mt-3">
          <Link to="/" className="hover:text-[#1a6847] transition-colors">&larr; All categories</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}

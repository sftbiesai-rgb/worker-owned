import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { slugify, faviconUrl } from '../lib/utils'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Purpose Trust-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'bg-emerald-100 text-emerald-700', F: 'bg-blue-100 text-blue-700', P: 'bg-amber-100 text-amber-700', S: 'bg-purple-100 text-purple-700', '1': 'bg-rose-100 text-rose-700' }

export default function StorePage() {
  const { store: storeSlug } = useParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PER_PAGE = 40

  useEffect(() => {
    fetch('/data/search.json')
      .then(r => r.json())
      .then(data => {
        const stores = data.s
        const tagDict = data.t || []
        const typeDict = data.y || []
        const hydrated = data.p.map((p, i) => {
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
        setProducts(hydrated)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const storeProducts = useMemo(() =>
    products.filter(p => slugify(p.store_name) === storeSlug),
    [products, storeSlug]
  )

  const store = storeProducts[0]
  const totalPages = Math.ceil(storeProducts.length / PER_PAGE)
  const paged = storeProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  useEffect(() => {
    if (store) {
      document.title = `${store.store_name} | Purpose Owned`
    }
  }, [store])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl xl:max-w-5xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mb-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a6847] transition-colors mb-3">
            <ArrowLeft size={12} /> Back to search
          </Link>
          <div className="flex items-center gap-3">
            {store?.store_url && <img src={faviconUrl(store.store_url)} alt="" width="24" height="24" />}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{store?.store_name || storeSlug}</h1>
              {store?.store_industry && <p className="text-xs text-gray-500">{store.store_industry}</p>}
              {store?.ownership_types?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {store.ownership_types.map(t => (
                    <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[t] || 'bg-gray-100 text-gray-500'}`}>
                      {TYPE_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {store?.store_url && (
            <a href={store.store_url} target="_blank" rel="noopener" className="inline-block mt-2 text-xs text-[#1a6847] hover:text-[#145236] transition-colors">
              Visit website &#8599;
            </a>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
          <p className="text-xs text-gray-400 mb-3">{storeProducts.length} product{storeProducts.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {paged.map(p => (
              <ProductCard key={p.id} product={p} showStore={false} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </main>
      <Footer />
    </div>
  )
}

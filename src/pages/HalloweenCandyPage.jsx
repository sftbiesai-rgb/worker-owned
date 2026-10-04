import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import Footer from '../components/Footer'
import { interleaveByStore } from '../lib/utils'

const PER_PAGE = 40

export default function HalloweenCandyPage() {
  const [products, setProducts] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    document.title = 'Halloween Candy from Worker-Owned Companies | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Get your Halloween candy from worker-owned and employee-owned companies. Bulk candy, nostalgic treats, and trick-or-treat favorites.')
    fetch('/data/products-halloween.json')
      .then(r => r.json())
      .then(d => { setProducts(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const filterWords = filter.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = filterWords.length
    ? products.filter(p => {
        const text = (p.title || '').toLowerCase() + ' ' + (p.store_name || '').toLowerCase()
        return filterWords.every(w => text.includes(w))
      })
    : products

  const sorted = filtered
  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker and employee owned businesses online</p>
        </div>

        <div className="rounded-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 w-full px-6 py-5 mb-3 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight mb-1">
            <span className="text-orange-500">Halloween Candy</span>{' '}
            <span className="text-gray-900">from Worker-Owned Companies</span>
          </h2>
          <p className="text-sm text-gray-600">Bulk candy, nostalgic treats, and trick-or-treat favorites — all from employee-owned and co-op stores.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">Bulk Candy</h2>
            <p className="text-xs text-gray-400">
              {!loaded ? <span className="animate-pulse">Loading...</span> : `${filtered.length} products`}
            </p>
          </div>

          {loaded && products.length > 20 && (
            <input
              type="text"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1) }}
              placeholder="Filter candy..."
              className="w-full mb-4 px-3 py-2 text-sm border border-orange-400 rounded-lg bg-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-gray-500"
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
            <p className="text-sm text-gray-500 text-center py-4">No candy found.</p>
          ) : null}
        </div>

        <div className="mt-3 text-center">
          <Link to="/" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            &larr; All categories
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

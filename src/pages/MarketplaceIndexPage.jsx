import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const MARKETPLACE_CATEGORIES = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea' },
  { slug: 'media-publishing', label: 'Media & Publishing' },
  { slug: 'food-pantry',      label: 'Food & Pantry' },
  { slug: 'apparel',          label: 'Apparel' },
  { slug: 'art-prints',       label: 'Art & Prints' },
  { slug: 'music',            label: 'Music' },
  { slug: 'home-goods',       label: 'Home Goods' },
  { slug: 'personal-care',    label: 'Personal Care' },
  { slug: 'games',            label: 'Games' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing' },
]

function MarketplaceIndexPage() {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])

  useEffect(() => {
    document.title = 'Market Place | Shop worker owned online stores for apparel, home goods, food and more'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse worker owned online stores by category or search 3,500+ products from cooperatives and employee-owned companies.')
    fetch('/data/products.json')
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    // Also try stemmed form: strip trailing 'ies'→'y', 'es', 's' to handle plurals
    const stems = [q]
    if (q.endsWith('ies')) stems.push(q.slice(0, -3) + 'y')
    else if (q.endsWith('es')) stems.push(q.slice(0, -2))
    else if (q.endsWith('s')) stems.push(q.slice(0, -1))
    const matches = (str) => str && stems.some(s => str.toLowerCase().includes(s))
    return products
      .filter(p =>
        matches(p.title) ||
        matches(p.store_name) ||
        p.tags?.some(t => matches(t))
      )
      .slice(0, 40)
  }, [query, products])

  const searching = query.trim().length > 0

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker owned businesses online</p>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products or stores…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Results are links to company sites. We don't sell anything or earn a commission.</p>
          <div className="mt-2 text-center">
            <Link to="/coffee" className="inline-flex items-center gap-1.5 text-xs text-[#004cb9] visited:text-[#004cb9] hover:text-[#BF0A30] transition-colors">
              <img src="/logo-coffee.png" alt="" width="16" height="16" className="shrink-0" />
              <span><strong>Quick Tool:</strong> worker owned coffee shop or restaurant near you</span>
            </Link>
          </div>
        </div>

        {searching ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
            {results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No results for "{query}"</p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">{results.length} result{results.length !== 1 ? 's' : ''}{results.length === 40 ? '+' : ''}</p>
                <div className="grid grid-cols-2 gap-3">
                  {results.map(p => (
                    <div key={p.id} className="bg-[#f5f5f7] rounded-xl overflow-hidden">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:opacity-90 transition-opacity"
                      >
                        {p.image && (
                          <div className="aspect-square w-full overflow-hidden bg-gray-100">
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title} <span className="text-gray-400 font-normal">↗</span></p>
                          {p.price && <p className="text-xs font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
                        </div>
                      </a>
                      {p.store_name && (
                        <div className="px-3 pb-2">
                          <Link
                            to={`/marketplace/store/${slugify(p.store_name)}`}
                            className="text-[10px] text-gray-400 hover:text-[#004cb9] transition-colors truncate block"
                          >
                            {p.store_name}
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by category</p>
            <div className="grid grid-cols-2 gap-3">
              {MARKETPLACE_CATEGORIES.map(cat => (
                <Link
                  key={cat.slug}
                  to={`/marketplace/${cat.slug}`}
                  className="py-2 px-3 rounded-lg text-sm font-medium text-center bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>

          </div>
        )}

        <div className="mt-3 text-center">
          <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Submit a worker owned business &rarr;
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400 mb-1">
          <a href="https://yourfairshare.info" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
            <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
            Your Fair Share
          </a>
        </p>
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      </footer>
    </div>
  )
}

export default MarketplaceIndexPage

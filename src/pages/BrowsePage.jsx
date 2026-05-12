import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import shopsData from '../data/shops.json'

function BrowsePage({ category }) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (category === 'coffee') {
      document.title = 'Worker-Owned Coffee Shops in the US | WorkerOwned'
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        'Browse all worker-owned coffee shops, cafes, and bakeries across the United States. Find cooperatively owned coffee near you.')
    } else {
      document.title = 'Worker-Owned Restaurants in the US | WorkerOwned'
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        'Browse all worker-owned restaurants, brewpubs, and diners across the United States. Find cooperatively owned food near you.')
    }
  }, [category])

  const coffeeCount = shopsData.filter(s => s.category === 'coffee').length
  const restaurantCount = shopsData.filter(s => s.category === 'restaurant').length

  const shops = shopsData
    .filter(s => s.category === category)
    .filter(s =>
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.state.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  const label = category === 'coffee' ? 'coffee shop' : 'restaurant'

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-6">
            <img src="/logo.png" alt="" width="36" height="36" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">
              Worker Owned
            </Link>
          </div>

          <div className="flex gap-2 mb-5">
            <Link
              to="/coffee"
              className={`flex-1 py-2 rounded-lg text-sm font-semibold text-center transition-colors ${
                category === 'coffee'
                  ? 'bg-[#004cb9] text-white'
                  : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
              }`}
            >
              Coffee ({coffeeCount})
            </Link>
            <Link
              to="/restaurants"
              className={`flex-1 py-2 rounded-lg text-sm font-semibold text-center transition-colors ${
                category === 'restaurant'
                  ? 'bg-[#004cb9] text-white'
                  : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
              }`}
            >
              Restaurants ({restaurantCount})
            </Link>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by city, state, or name"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-400 mb-3">
            {shops.length} {label}{shops.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-2">
            {shops.map(shop => (
              <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                {shop.website ? (
                  <a
                    href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm block text-[#004cb9] hover:text-[#003a8c] transition-colors truncate"
                  >
                    {shop.name}
                  </a>
                ) : (
                  <div className="font-semibold text-sm text-[#004cb9] truncate">{shop.name}</div>
                )}
                {shop.location && shop.location !== `${shop.city}, ${shop.state}` ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(shop.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#BF0A30] hover:underline truncate mt-0.5 block transition-colors"
                  >
                    {shop.location}
                  </a>
                ) : (
                  <div className="text-xs text-[#BF0A30] truncate mt-0.5">{shop.city}, {shop.state}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-center">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      </footer>
    </div>
  )
}

export default BrowsePage

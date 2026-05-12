import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import shopsData from '../data/shops.json'

function HomePage() {
  useEffect(() => {
    document.title = 'Worker Owned — Find Worker-Owned Coffee Shops & Restaurants Near You'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Find worker-owned coffee shops and restaurants across the US. Search by city to discover cooperatively owned cafes, bakeries, and restaurants in your area.')
  }, [])

  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('coffee')

  const coffeeCount = shopsData.filter(s => s.category === 'coffee').length
  const restaurantCount = shopsData.filter(s => s.category === 'restaurant').length

  const filteredShops = shopsData
    .filter(shop => shop.category === category)
    .filter(shop =>
      shop.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.state.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src={category === 'coffee' ? '/logo-coffee.png' : '/logo-restaurant.png'}
              alt=""
              width="36"
              height="36"
              className="shrink-0"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Worker Owned</h1>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setCategory('coffee'); setSearchTerm('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                category === 'coffee' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
              }`}
            >
              Coffee
            </button>
            <button
              onClick={() => { setCategory('restaurant'); setSearchTerm('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                category === 'restaurant' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
              }`}
            >
              Restaurants
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold tracking-widest text-gray-500 mb-1">ENTER CITY</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="e.g. Brooklyn"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {searchTerm && (
            <div className="w-full text-left">
              {filteredShops.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">{filteredShops.length} result{filteredShops.length !== 1 ? 's' : ''}</p>
                  {filteredShops.map(shop => (
                    <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                      {shop.website ? (
                        <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm truncate block text-[#004cb9] hover:text-[#003a8c] transition-colors">
                          {shop.name}
                        </a>
                      ) : (
                        <div className="font-semibold text-sm truncate text-[#004cb9]">{shop.name}</div>
                      )}
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(shop.location)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#BF0A30] hover:underline truncate mt-0.5 block transition-colors">
                        {shop.location}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No businesses found. Try a different search.</p>
              )}
            </div>
          )}

          {(searchTerm ? filteredShops.length > 0 : true) && (
            <div className={`text-center ${searchTerm ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
              <Link to={category === 'coffee' ? '/coffee' : '/restaurants'} className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
                Browse all {category === 'coffee' ? coffeeCount : restaurantCount} {category === 'coffee' ? 'coffee shops' : 'restaurants'} &rarr;
              </Link>
            </div>
          )}
        </div>

        <div className="mt-3 text-center">
          <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Submit a worker-owned business &rarr;
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

export default HomePage

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import shopsData from '../data/shops.json'

function HomePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('coffee')

  const categoryCount = (cat) => shopsData.filter(s => s.category === cat).length

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
      <main className="flex-1 max-w-xl mx-auto w-full px-5 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-10 sm:py-14 mt-8 sm:mt-0">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.png" alt="" width="44" height="44" className="shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">WorkerOwned</h1>
          </div>
          <p className="text-gray-400 text-sm mb-6">Get coffee or food at a worker-owned business, just enter a city or town</p>

          <div className="w-full flex flex-col sm:flex-row gap-2 mb-4">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSearchTerm('') }}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white text-gray-700"
            >
              <option value="coffee">Coffee Shops ({categoryCount('coffee')})</option>
              <option value="restaurant">Restaurants ({categoryCount('restaurant')})</option>
            </select>
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by city, state, or name"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {!searchTerm && (
            <Link to={category === 'coffee' ? '/coffee' : '/restaurants'} className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">
              Browse all {categoryCount(category)} {category === 'coffee' ? 'coffee shops' : 'restaurants'} &rarr;
            </Link>
          )}

          {searchTerm && (
            <div className="w-full mt-4 text-left">
              {filteredShops.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">{filteredShops.length} result{filteredShops.length !== 1 ? 's' : ''}</p>
                  {filteredShops.map(shop => (
                    <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                      {shop.website ? (
                        <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm truncate block text-[#004cb9] hover:text-[#003a8c] transition-colors">
                          {shop.name}
                        </a>
                      ) : (
                        <div className="font-semibold text-sm truncate text-[#004cb9]">{shop.name}</div>
                      )}
                      {shop.location && shop.location !== `${shop.city}, ${shop.state}` ? (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(shop.location)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#BF0A30] hover:underline truncate mt-0.5 block transition-colors">
                          {shop.location}
                        </a>
                      ) : (
                        <div className="text-xs text-[#BF0A30] truncate mt-0.5">{shop.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">No businesses found. Try a different search.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 mt-3 w-full">
          <Link to="/submit" className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">
            Submit a worker-owned coffee shop or restaurant &rarr;
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-4 text-center">
        <p className="text-xs text-gray-400">
          <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">Data via USFWC</a>
        </p>
      </footer>
    </div>
  )
}

export default HomePage
import { useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import shopsData from './data/shops.json'

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('coffee')
  const [view, setView] = useState('home')

  const filteredShops = shopsData
    .filter(shop => shop.category === category)
    .filter(shop =>
      shop.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.state.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  const categoryCount = (cat) => shopsData.filter(s => s.category === cat).length

  if (view === 'browse') {
    const browseShops = shopsData
      .filter(shop => shop.category === category)
      .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

    return (
      <div className="min-h-screen bg-white text-gray-800 font-sans">
        <header className="bg-[#002868] text-white px-6 pt-8 pb-6">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => { setView('home'); setSearchTerm('') }} className="text-sm text-blue-200 hover:text-white transition-colors">&larr; Back</button>
            <h1 className="text-3xl font-bold mt-4 tracking-tight">All Worker-Owned {category === 'coffee' ? 'Coffee Shops' : 'Restaurants'}</h1>
            <p className="text-blue-200 text-sm mt-1">{categoryCount(category)} businesses across the US</p>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 pb-20">
          <div className="divide-y divide-gray-100">
{browseShops.map(shop => (
              <div key={shop.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{shop.name}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{shop.city}, {shop.state}</span>
                  </div>
                </div>
                {shop.website && (
                  <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#BF0A30] transition-colors shrink-0 ml-4">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto px-6 flex flex-col items-center justify-center text-center">
<div className="mb-2 flex items-center justify-center">
          <img src="/logo.png" alt="WorkerOwned" width="52" height="52" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          <span className="text-[#BF0A30]">Worker</span><span className="text-[#002868]">Owned</span>
        </h1>
        <p className="text-gray-500 text-sm mb-2">Worker-owned coffee shops & restaurants across the United States</p>

        <div className="w-full flex gap-2 mb-4">
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSearchTerm('') }}
            className="border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#002868] transition-colors bg-white text-gray-700"
          >
            <option value="coffee">Coffee Shops ({categoryCount('coffee')})</option>
            <option value="restaurant">Restaurants ({categoryCount('restaurant')})</option>
          </select>
          <input
            type="text"
            placeholder="Search by city, state, or name"
            className="flex-1 border border-gray-300 rounded px-4 py-2.5 text-base outline-none focus:border-[#002868] transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {!searchTerm && (
          <button onClick={() => setView('browse')} className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">
            Browse all {categoryCount(category)} {category === 'coffee' ? 'coffee shops' : 'restaurants'} &rarr;
          </button>
        )}

        {searchTerm && (
          <div className="w-full mt-6 text-left">
            {filteredShops.length > 0 ? (
              <div className="divide-y divide-gray-100">
                <p className="text-xs text-gray-400 mb-2">{filteredShops.length} result{filteredShops.length !== 1 ? 's' : ''}</p>
                {filteredShops.map(shop => (
                  <div key={shop.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{shop.name}</div>
                      <div className="text-xs text-gray-500 truncate">{shop.location}</div>
                    </div>
                    {shop.website && (
                      <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#BF0A30] transition-colors shrink-0 ml-4">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center">No businesses found. Try a different search.</p>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-gray-400">
        <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#002868] transition-colors">Data via USFWC</a>
      </footer>
    </div>
  )
}

export default App
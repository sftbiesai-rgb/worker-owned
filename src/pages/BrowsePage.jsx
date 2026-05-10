import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import shopsData from '../data/shops.json'

const logoBlue = '#004cb9'

function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || 'coffee'
  const [localSearch, setLocalSearch] = useState('')

  const categoryCount = (cat) => shopsData.filter(s => s.category === cat).length

  const browseShops = shopsData
    .filter(shop => shop.category === category)
    .filter(shop =>
      shop.city.toLowerCase().includes(localSearch.toLowerCase()) ||
      shop.name.toLowerCase().includes(localSearch.toLowerCase()) ||
      shop.state.toLowerCase().includes(localSearch.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans">
      <header style={{backgroundColor: logoBlue}} className="text-white px-5 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-sm text-blue-200 hover:text-white transition-colors">&larr; Back</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-3 tracking-tight">All Worker-Owned {category === 'coffee' ? 'Coffee Shops' : 'Restaurants'}</h1>
          <p className="text-blue-200 text-xs sm:text-sm mt-1">{categoryCount(category)} businesses across the US</p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 pb-16">
        <div className="flex gap-2 mt-5 mb-5">
          <select
            value={category}
            onChange={(e) => { setSearchParams({ category: e.target.value }); setLocalSearch('') }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white text-gray-700"
          >
            <option value="coffee">Coffee Shops ({categoryCount('coffee')})</option>
            <option value="restaurant">Restaurants ({categoryCount('restaurant')})</option>
          </select>
          <input
            type="text"
            placeholder="Filter by city or name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {browseShops.map(shop => (
            <div key={shop.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3.5 shadow-sm">
              {shop.website ? (
                <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm sm:text-base truncate hover:text-[#004cb9] transition-colors">{shop.name}</span>
                  <ExternalLink size={12} className="text-gray-300 shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-400 truncate ml-1">&mdash; {shop.city}, {shop.state}</span>
                </a>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm sm:text-base truncate">{shop.name}</span>
                  <span className="text-xs sm:text-sm text-gray-400 truncate">&mdash; {shop.city}, {shop.state}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default BrowsePage
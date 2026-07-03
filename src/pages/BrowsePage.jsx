import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Map, List } from 'lucide-react'
import shopsData from '../data/shops.json'

function ShopMap({ shops }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || shops.length === 0) return
    let cancelled = false

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (cancelled || !mapRef.current) return
      const L = mod.default
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }

      const map = L.map(mapRef.current).setView([39.8, -98.5], 4)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      const markers = []
      for (const shop of shops) {
        if (!shop.lat || !shop.lng) continue
        const marker = L.circleMarker([shop.lat, shop.lng], { radius: 7, fillColor: '#004cb9', color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(map)
        const url = shop.website?.startsWith('http') ? shop.website : `https://${shop.website}`
        marker.bindPopup(`<strong>${shop.name}</strong><br>${shop.city}, ${shop.state}${shop.website ? `<br><a href="${url}" target="_blank" rel="noopener">Visit site</a>` : ''}`)
        markers.push(marker)
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds().pad(0.1))
      }
    })

    return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [shops])

  return <div ref={mapRef} className="w-full h-[400px] rounded-xl overflow-hidden" />
}

function BrowsePage({ category }) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')

  const meta = {
    coffee: { title: 'Worker Owned Coffee Shops in the US | Worker Owned', desc: 'Browse all worker owned coffee shops, cafes, and bakeries across the United States. Find cooperatively owned coffee near you.', heading: 'Worker Owned Coffee Shops', sub: 'Cooperatively owned cafes, coffee shops, and bakeries across the United States', label: 'coffee shop' },
    restaurant: { title: 'Worker Owned Restaurants in the US | Worker Owned', desc: 'Browse all worker owned restaurants, brewpubs, and diners across the United States. Find cooperatively owned food near you.', heading: 'Worker Owned Restaurants', sub: 'Cooperatively owned restaurants, diners, and brewpubs across the United States', label: 'restaurant' },
    grocery: { title: 'Worker Owned Grocery Stores in the US | Worker Owned', desc: 'Browse all worker owned grocery stores and food co-ops across the United States. Find cooperatively owned groceries near you.', heading: 'Worker Owned Grocery Stores', sub: 'Cooperatively owned grocery stores and food co-ops across the United States', label: 'grocery store' },
  }[category] || {}

  useEffect(() => {
    if (meta.title) {
      document.title = meta.title
      document.querySelector('meta[name="description"]')?.setAttribute('content', meta.desc)
    }
  }, [category])

  const shops = shopsData
    .filter(s => s.category === category)
    .filter(s =>
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.state.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src={category === 'coffee' ? '/logo-coffee.png' : '/logo-restaurant.png'}
              alt="Worker Owned"
              width="36"
              height="36"
              className="shrink-0"
            />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">
              Worker Owned
            </Link>
          </div>

          <h1 className="text-center text-base font-semibold text-gray-700 mb-1">
            {meta.heading}
          </h1>
          <p className="text-center text-sm text-gray-500 mb-4">
            {meta.sub}
          </p>

          <div className="flex gap-2 mb-5">
            {[
              { to: '/coffee', cat: 'coffee', label: 'Coffee' },
              { to: '/restaurants', cat: 'restaurant', label: 'Restaurants' },
              { to: '/bars', cat: 'bars', label: 'Bars' },
              { to: '/grocery', cat: 'grocery', label: 'Grocery' },
            ].map(tab => (
              <Link
                key={tab.cat}
                to={tab.to}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold text-center transition-colors ${
                  category === tab.cat
                    ? 'bg-[#004cb9] text-white'
                    : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
                }`}
              >
                {tab.label}
              </Link>
            ))}
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

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">
              {shops.length} {meta.label}{shops.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-400 hover:text-[#004cb9]'}`}><List size={14} /></button>
              <button onClick={() => setView('map')} className={`p-1.5 rounded-lg transition-colors ${view === 'map' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-400 hover:text-[#004cb9]'}`}><Map size={14} /></button>
            </div>
          </div>

          {view === 'map' ? (
            <ShopMap shops={shops} />
          ) : (
          <div className="space-y-2">
            {shops.map(shop => (
              <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  {shop.website ? (
                    <a
                      href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-sm text-[#004cb9] hover:text-[#003a8c] transition-colors truncate"
                    >
                      {shop.name}
                    </a>
                  ) : (
                    <span className="font-semibold text-sm text-[#004cb9] truncate">{shop.name}</span>
                  )}
                  {shop.ownership_type && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      shop.ownership_type.toLowerCase().includes('worker co-op') ? 'bg-blue-50 text-[#004cb9]'
                      : shop.ownership_type.toLowerCase().includes('multi-stakeholder') ? 'bg-purple-50 text-purple-700'
                      : 'bg-green-50 text-green-700'
                    }`}>{shop.ownership_type}</span>
                  )}
                </div>
                {shop.location && shop.location !== `${shop.city}, ${shop.state}` ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(shop.location)}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-[#BF0A30] hover:underline truncate mt-0.5 block transition-colors"
                  >
                    {shop.location}
                  </a>
                ) : (
                  <div className="text-xs text-[#BF0A30] truncate mt-0.5">{shop.city}, {shop.state}</div>
                )}
                {shop.notes && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{shop.notes}</div>}
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="mt-3 text-center">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400 mb-1">
          <a href="https://yourfairshare.info" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
            <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
            Your Fair Share
          </a>
        </p>
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      </footer>
    </div>
  )
}

export default BrowsePage

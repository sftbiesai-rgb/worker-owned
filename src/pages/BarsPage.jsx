import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Map, List } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import barsData from '../data/bars.json'

// Exclude pure consumer co-ops (not worker owned)
const CONSUMER_COOP_IDS = [14, 15, 16, 17]
const bars = barsData.filter(b => !CONSUMER_COOP_IDS.includes(b.id))

function BarMap({ items }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || items.length === 0) return
    let cancelled = false

    import('leaflet').then((mod) => {
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
      for (const bar of items) {
        if (!bar.lat || !bar.lng) continue
        const marker = L.circleMarker([bar.lat, bar.lng], { radius: 7, fillColor: '#004cb9', color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(map)
        const url = bar.website?.startsWith('http') ? bar.website : `https://${bar.website}`
        marker.bindPopup(`<strong>${bar.name}</strong><br>${bar.city}, ${bar.state}${bar.website ? `<br><a href="${url}" target="_blank" rel="noopener">Visit site</a>` : ''}`)
        markers.push(marker)
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds().pad(0.1))
      }
    })

    return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [items])

  return <div ref={mapRef} className="w-full h-[400px] rounded-xl overflow-hidden" />
}

function BarsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')

  useEffect(() => {
    document.title = 'Worker Owned Bars & Breweries in the US | Worker Owned'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse all worker owned bars, brewpubs, and breweries across the United States. Find cooperatively owned bars near you.')
  }, [])

  const filtered = bars
    .filter(b =>
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.state.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src="/logo-restaurant.png"
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
            Worker Owned Bars & Breweries
          </h1>
          <p className="text-center text-sm text-gray-500 mb-4">
            Cooperatively owned bars, brewpubs, and taprooms across the United States
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
                  tab.cat === 'bars'
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
              {filtered.length} bar{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-400 hover:text-[#004cb9]'}`}><List size={14} /></button>
              <button onClick={() => setView('map')} className={`p-1.5 rounded-lg transition-colors ${view === 'map' ? 'bg-[#004cb9] text-white' : 'bg-[#f5f5f7] text-gray-400 hover:text-[#004cb9]'}`}><Map size={14} /></button>
            </div>
          </div>

          {view === 'map' ? (
            <BarMap items={filtered} />
          ) : (
          <div className="space-y-2">
            {filtered.map(bar => (
              <div key={bar.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                {bar.website ? (
                  <a
                    href={bar.website.startsWith('http') ? bar.website : `https://${bar.website}`}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-sm block text-[#004cb9] hover:text-[#003a8c] transition-colors truncate"
                  >
                    {bar.name}
                  </a>
                ) : (
                  <div className="font-semibold text-sm text-[#004cb9] truncate">{bar.name}</div>
                )}
                {bar.location && bar.location !== `${bar.city}, ${bar.state}` ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(bar.location)}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-[#BF0A30] hover:underline truncate mt-0.5 block transition-colors"
                  >
                    {bar.location}
                  </a>
                ) : (
                  <div className="text-xs text-[#BF0A30] truncate mt-0.5">{bar.city}, {bar.state}</div>
                )}
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

export default BarsPage

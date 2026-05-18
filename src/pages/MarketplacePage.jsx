import { useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'

const SECTIONS = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea',       sectionName: 'Coffee & Tea' },
  { slug: 'books-publishing', label: 'Books & Publishing', sectionName: 'Books & Publishing' },
  { slug: 'food-pantry',      label: 'Food & Pantry',      sectionName: 'Food & Pantry' },
  { slug: 'apparel',          label: 'Apparel',            sectionName: 'Apparel' },
  { slug: 'art-prints',       label: 'Art & Prints',       sectionName: 'Art & Prints' },
  { slug: 'music',            label: 'Music',              sectionName: 'Music' },
  { slug: 'home-goods',       label: 'Home Goods',         sectionName: 'Home Goods' },
  { slug: 'personal-care',    label: 'Personal Care',      sectionName: 'Personal Care' },
  { slug: 'games',            label: 'Games',              sectionName: 'Games' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing',     sectionName: 'Beer & Brewing' },
]

function dedupeByUrl(entries) {
  const seen = new Map()
  // Iterate in reverse so last (most detailed) entries win, then reverse back
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (!seen.has(e.url)) seen.set(e.url, e)
  }
  // Preserve original order by filtering
  return entries.filter(e => seen.get(e.url) === e)
}

function ownershipBadge(type) {
  if (!type) return null
  const clean = type.toLowerCase()
  let color = 'bg-gray-100 text-gray-500'
  if (clean.includes('worker co-op') || clean === 'worker-owned') color = 'bg-blue-50 text-[#004cb9]'
  else if (clean.includes('esop') || clean.includes('employee')) color = 'bg-green-50 text-green-700'
  else if (clean.includes('multi-stakeholder') || clean.includes('consumer')) color = 'bg-purple-50 text-purple-700'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {type}
    </span>
  )
}

function MarketplacePage() {
  const { category } = useParams()
  const section = SECTIONS.find(s => s.slug === category)

  useEffect(() => {
    if (section) {
      document.title = `Worker-Owned ${section.label} Online Stores | Worker Owned`
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        `Shop worker-owned and cooperatively owned ${section.label.toLowerCase()} businesses online. All companies are worker co-ops, ESOPs, or multi-stakeholder co-ops.`)
    }
  }, [section])

  if (!section) return <Navigate to="/" replace />

  const entries = dedupeByUrl(
    marketplaceData.filter(e => e.site_section === section.sectionName)
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-coffee.png" alt="Worker Owned" width="36" height="36" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Worker Owned</Link>
          </div>

          <p className="text-center text-sm text-gray-500 mb-5">Shop worker-owned online</p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-6 justify-center">
            {SECTIONS.map(s => (
              <Link
                key={s.slug}
                to={`/marketplace/${s.slug}`}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  s.slug === category
                    ? 'bg-[#004cb9] text-white'
                    : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          <h2 className="text-base font-bold text-gray-800 mb-1">{section.label}</h2>
          <p className="text-xs text-gray-400 mb-4">{entries.length} worker-owned option{entries.length !== 1 ? 's' : ''}</p>

          {section.slug === 'home-goods' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-800">
              <strong>Note:</strong> Home goods &amp; furniture is genuinely sparse among worker-owned online retailers. <strong>Artisans Cooperative</strong> (below) is the best anchor — it's a member-owned Etsy alternative with hundreds of makers selling ceramics, textiles, candles, and home decor. It's a meta-marketplace rather than a single seller.
            </div>
          )}

          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm text-[#004cb9] hover:text-[#003a8c] transition-colors leading-snug"
                  >
                    {entry.name}
                  </a>
                  {ownershipBadge(entry.ownership_type)}
                </div>
                {entry.notes && (
                  <p className="text-xs text-gray-500 leading-relaxed">{entry.notes}</p>
                )}
                {entry.ships && entry.ships !== 'US' && (
                  <p className="text-xs text-gray-400 mt-1">Ships: {entry.ships}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-center">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Back to search
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

export default MarketplacePage

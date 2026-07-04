import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'

function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

function dedupeByUrl(entries) {
  const seen = new Map()
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (!seen.has(e.url)) seen.set(e.url, e)
  }
  return entries.filter(e => seen.get(e.url) === e)
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function ownershipBadge(type) {
  if (!type) return null
  const clean = type.toLowerCase()
  let color = 'bg-gray-100 text-gray-500'
  if (clean.includes('worker co-op') || clean === 'worker owned') color = 'bg-blue-50 text-[#004cb9]'
  else if (clean.includes('esop') || clean.includes('employee')) color = 'bg-green-50 text-green-700'
  else if (clean.includes('multi-stakeholder') || clean.includes('consumer')) color = 'bg-purple-50 text-purple-700'
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${color}`}>
      {type}
    </span>
  )
}

const SECTIONS = [
  'Coffee & Tea',
  'Food & Pantry',
  'Apparel',
  'Home Goods',
  'Personal Care',
  'Beer & Brewing',
  'Media & Publishing',
  'Art & Prints',
  'Music',
  'Games',
  'Tech & Software',
]

const allStores = dedupeByUrl(marketplaceData)

function CompaniesPage() {
  useEffect(() => {
    document.title = 'All Worker Owned Companies | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse all worker owned and employee-owned companies in the Worker Owned marketplace directory, sorted by category.')
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Worker Owned Companies</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            {allStores.length} companies across {SECTIONS.length} categories
          </p>

          {SECTIONS.map(section => {
            const stores = allStores
              .filter(s => s.site_section === section)
              .sort((a, b) => a.name.localeCompare(b.name))
            if (stores.length === 0) return null
            return (
              <div key={section} className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{section}</h2>
                <div className="space-y-1.5">
                  {stores.map(store => (
                    <div key={store.id} className="bg-[#f5f5f7] rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/marketplace/store/${slugify(store.name)}`}
                          className="font-semibold text-sm text-[#004cb9] hover:text-[#003a8c] transition-colors truncate flex items-center gap-1.5"
                        >
                          {faviconUrl(store.url) && <img src={faviconUrl(store.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                          {store.name}
                        </Link>
                        {ownershipBadge(store.ownership_type)}
                      </div>
                      {store.notes && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{store.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search
          </Link>
          <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Submit a business &rarr;
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
      </footer>
    </div>
  )
}

export default CompaniesPage

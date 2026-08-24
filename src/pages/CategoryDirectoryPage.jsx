import { useState, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'
import { slugify, faviconUrl, dedupeByUrl } from '../lib/utils'
import { SECTIONS } from '../lib/categories'
import OwnershipBadge from '../components/OwnershipBadge'
import Footer from '../components/Footer'
import Breadcrumbs from '../components/Breadcrumbs'

function CategoryDirectoryPage() {
  const { category } = useParams()
  const section = SECTIONS.find(s => s.slug === category)
  const [productCounts, setProductCounts] = useState({})
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!section) return
    fetch(`/data/products-${section.slug}.json`)
      .then(r => r.json())
      .then(data => {
        const counts = {}
        for (const p of data) {
          if (p.site_section === section.sectionName && p.store_url) {
            counts[p.store_url] = (counts[p.store_url] || 0) + 1
          }
        }
        setProductCounts(counts)
      })
      .catch(() => {})
  }, [section])

  useEffect(() => {
    if (!section) return
    const title = `${section.label} Companies — Worker Owned Directory`
    const desc = `Browse all worker and employee owned ${section.label.toLowerCase()} companies. Directory of cooperatives and employee-owned businesses.`
    const canonical = `https://www.workerowned.info/marketplace/${section.slug}/directory`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc)
  }, [section])

  if (!section) return <Navigate to="/marketplace" replace />

  const entries = dedupeByUrl(
    marketplaceData.filter(e => e.site_section === section.sectionName)
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filterWords = filter.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = filterWords.length
    ? entries.filter(e => {
        const text = (e.name + ' ' + (e.category || '') + ' ' + (e.notes || '')).toLowerCase()
        return filterWords.every(w => text.includes(w))
      })
    : entries

  const withProducts = filtered.filter(e => productCounts[e.url])
  const withoutProducts = filtered.filter(e => !productCounts[e.url])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <Breadcrumbs items={[
          { label: 'Marketplace', to: '/marketplace' },
          { label: section.label, to: `/marketplace/${category}` },
          { label: 'Directory' },
        ]} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">{section.label} Directory</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">
            {entries.length} worker and employee owned {section.label.toLowerCase()} companies
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
            {SECTIONS.map(s => (
              <Link
                key={s.slug}
                to={`/marketplace/${s.slug}/directory`}
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

          <div className="flex justify-center gap-2 text-xs">
            <Link
              to={`/marketplace/${category}`}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-[#004cb9] hover:border-[#004cb9] transition-colors"
            >
              Products
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-gray-700 text-white font-medium">
              Directory
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
          {entries.length > 10 && (
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={`Filter ${section.label.toLowerCase()} companies…`}
              className="w-full mb-4 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-[#f5f5f7] focus:outline-none focus:border-[#004cb9] focus:ring-1 focus:ring-[#004cb9] placeholder-gray-400"
            />
          )}

          <div className="space-y-2">
            {filtered.map(entry => {
              const count = productCounts[entry.url] || 0
              return (
                <Link
                  key={entry.id}
                  to={`/marketplace/store/${slugify(entry.name)}`}
                  className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#004cb9] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-[#004cb9] leading-snug flex items-center gap-1.5">
                      {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                      {entry.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {count > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#d5e8d4] text-[#2d6a4f] whitespace-nowrap">
                          {count} product{count !== 1 ? 's' : ''}
                        </span>
                      )}
                      <OwnershipBadge type={entry.ownership_type} />
                    </div>
                  </div>
                  {entry.category && (
                    <p className="text-[11px] text-gray-400 mb-0.5">{entry.category}</p>
                  )}
                  {entry.notes && (
                    <p className="text-xs text-gray-500 leading-relaxed">{entry.notes}</p>
                  )}
                  {entry.ships && entry.ships !== 'US' && (
                    <p className="text-[11px] text-gray-400 mt-1">Ships: {entry.ships}</p>
                  )}
                </Link>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No companies match your filter.</p>
          )}
        </div>

        <div className="mt-3 text-center flex flex-col gap-1">
          <Link to={`/marketplace/${category}`} className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; {section.label} products
          </Link>
          <Link to="/marketplace" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; All categories
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

export default CategoryDirectoryPage

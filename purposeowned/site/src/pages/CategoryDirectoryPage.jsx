import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { CATEGORIES, categoryBySlug } from '../lib/categories'
import { slugify, faviconUrl } from '../lib/utils'
import Footer from '../components/Footer'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'bg-emerald-100 text-emerald-700', F: 'bg-blue-100 text-blue-700', P: 'bg-amber-100 text-amber-700', S: 'bg-purple-100 text-purple-700', '1': 'bg-rose-100 text-rose-700' }

export default function CategoryDirectoryPage() {
  const { category } = useParams()
  const cat = categoryBySlug(category)
  const [directory, setDirectory] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/data/directory.json')
      .then(r => r.json())
      .then(setDirectory)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!cat) return
    document.title = `${cat.label} Directory — Purpose Owned`
  }, [cat])

  useEffect(() => { setFilter('') }, [category])

  const companies = useMemo(() => {
    if (!directory || !cat) return []
    const catIdx = directory.categories.indexOf(cat.label)
    if (catIdx === -1) return []
    return directory.companies.filter(c => c.c === catIdx)
  }, [directory, cat])

  const filtered = useMemo(() => {
    if (!filter.trim()) return companies
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean)
    return companies.filter(c => {
      const text = (c.n + ' ' + (c.d || '') + ' ' + (c.l || '')).toLowerCase()
      return words.every(w => text.includes(w))
    })
  }, [companies, filter])

  if (!cat) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-4 lg:px-5 py-6 lg:py-8 flex flex-col">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 lg:px-6 py-5 lg:py-6 mb-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a6847] transition-colors mb-3">
            <ArrowLeft size={12} /> Home
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900 mb-1">{cat.label} Directory</h1>
          <p className="text-xs lg:text-sm text-gray-500 mb-4">
            {companies.length} purpose-driven {cat.label.toLowerCase()} companies
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <Link key={c.slug} to={`/${c.slug}/directory`}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  c.slug === category ? 'bg-[#1a6847] text-white' : 'bg-[#f5f5f7] text-gray-500 hover:text-[#1a6847]'
                }`}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Products / Directory toggle */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-3 mb-3 flex justify-center items-center gap-0 text-sm font-bold uppercase tracking-wide">
          <Link to={`/${category}`} className="text-[#1a6847] hover:text-[#145236] transition-colors">Products</Link>
          <span className="text-gray-300 mx-2">|</span>
          <span className="text-gray-800">Directory</span>
        </div>

        {/* Directory list */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-5 lg:px-6 py-5">
          {companies.length > 10 && (
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={`Filter ${cat.label.toLowerCase()} companies...`}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-[#f5f5f7] focus:outline-none focus:border-[#1a6847] focus:ring-1 focus:ring-[#1a6847] placeholder-gray-400"
              />
            </div>
          )}

          {!directory ? (
            <p className="text-sm text-gray-500 text-center py-4 animate-pulse">Loading directory...</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(company => {
                const hasProducts = company.p > 0
                const Tag = hasProducts ? Link : 'a'
                const linkProps = hasProducts
                  ? { to: `/store/${slugify(company.n)}` }
                  : { href: company.u, target: '_blank', rel: 'noopener' }

                return (
                  <Tag
                    key={company.n}
                    {...linkProps}
                    className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#1a6847] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-[#1a6847] leading-snug flex items-center gap-1.5">
                        {faviconUrl(company.u) && <img src={faviconUrl(company.u)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                        {company.n}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasProducts && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-[#1a6847] whitespace-nowrap">
                            {company.p} product{company.p !== 1 ? 's' : ''}
                          </span>
                        )}
                        {company.t.map(t => (
                          <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[t] || 'bg-gray-100 text-gray-500'}`}>
                            {TYPE_LABELS[t] || t}
                          </span>
                        ))}
                      </div>
                    </div>
                    {company.d && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{company.d}</p>
                    )}
                    {company.l && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{company.l}</p>
                    )}
                    {!hasProducts && (
                      <p className="text-[10px] text-gray-400 mt-1">Visit website ↗</p>
                    )}
                  </Tag>
                )
              })}
            </div>
          )}

          {directory && filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No companies match your filter.</p>
          )}
        </div>

        <div className="mt-3 text-center flex flex-col gap-1">
          <Link to={`/${category}`} className="text-sm text-[#1a6847] hover:text-[#145236] transition-colors font-medium">
            &larr; {cat.label} products
          </Link>
          <Link to="/" className="text-sm text-[#1a6847] hover:text-[#145236] transition-colors font-medium">
            &larr; All categories
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'
import giftGuide from '../data/gift-guide.json'

const ICONS = {
  treats: '🍫',
  coffee: '☕',
  baking: '🍪',
  music: '🎶',
  books: '📚',
  games: '🎲',
  outdoors: '🏔️',
  cozy: '🧦',
  'self-care': '🛁',
  handmade: '🎄',
  'stocking-stuffers': '🎁',
  'gift-cards': '✉️',
}

const PRICE_FILTERS = [
  { id: 'all', label: 'Any price', test: () => true },
  { id: 'under25', label: 'Under $25', test: n => n < 25 },
  { id: 'under50', label: 'Under $50', test: n => n < 50 },
  { id: 'over50', label: '$50+', test: n => n >= 50 },
]

const CANDY_CANE = 'repeating-linear-gradient(-45deg, #b91c1c 0 10px, #ffffff 10px 20px, #15803d 20px 30px, #ffffff 30px 40px)'

function priceOf(p) {
  return parseFloat(String(p.price || '').replace(/[^0-9.]/g, '')) || 0
}

export default function HolidayGiftsPage() {
  const [filter, setFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('all')

  useEffect(() => {
    document.title = 'Holiday Gift Guide: Gifts from Worker-Owned Companies | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Holiday gifts from worker-owned co-ops and employee-owned companies. Chocolate, coffee, vinyl, books, games, outdoor gear, cozy socks, handmade ornaments, and stocking stuffers.')
  }, [])

  const filterWords = filter.toLowerCase().split(/\s+/).filter(Boolean)
  const priceTest = PRICE_FILTERS.find(f => f.id === priceFilter).test
  const sections = giftGuide
    .map(section => ({
      ...section,
      products: section.products.filter(p => {
        if (!priceTest(priceOf(p))) return false
        const text = (p.title + ' ' + p.store_name).toLowerCase()
        return filterWords.every(w => text.includes(w))
      }),
    }))
    .filter(section => section.products.length > 0)

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500">Shop worker and employee owned businesses online</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl w-full mb-3 text-center shadow-sm bg-gradient-to-br from-red-700 via-red-800 to-red-900">
          <div className="h-2.5 w-full" style={{ background: CANDY_CANE }} />
          <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 text-white/15">
            <span className="absolute left-[6%] top-6 text-3xl">❄</span>
            <span className="absolute left-[22%] bottom-4 text-xl">❄</span>
            <span className="absolute right-[8%] top-8 text-4xl">❄</span>
            <span className="absolute right-[26%] bottom-6 text-2xl">❄</span>
            <span className="absolute left-[45%] top-3 text-lg">❄</span>
          </div>
          <div className="relative px-6 py-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300 mb-2">Holiday Gift Guide</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Gifts from Worker-Owned Companies
            </h2>
            <p className="text-sm text-red-100 max-w-md mx-auto">
              Chocolate, coffee, vinyl, games, cozy socks, and more from co-ops and employee-owned businesses. Every link goes straight to the company's own store.
            </p>
          </div>
          <div className="h-2.5 w-full" style={{ background: CANDY_CANE }} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-4 mb-3">
          <div className="flex overflow-x-auto sm:flex-wrap sm:justify-center gap-1.5 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {giftGuide.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border border-green-700/30 bg-green-50 text-green-800 hover:bg-green-100 transition-colors"
              >
                {ICONS[section.id]} {section.title}
              </a>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search gifts..."
              className="flex-1 px-3 py-2 text-sm border border-red-700/60 rounded-lg bg-white focus:outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700 placeholder-gray-500"
            />
            <div className="flex gap-1 justify-center">
              {PRICE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setPriceFilter(f.id)}
                  className={`text-xs font-semibold px-2.5 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                    priceFilter === f.id
                      ? 'bg-red-700 border-red-700 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-700 hover:text-red-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sections.map(section => (
          <section
            key={section.id}
            id={section.id}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full overflow-hidden mb-3 scroll-mt-4"
          >
            <div className="h-1.5 w-full" style={{ background: CANDY_CANE }} />
            <div className="px-6 py-5">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                <span className="mr-1.5">{ICONS[section.id]}</span>{section.title}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{section.blurb}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {section.products.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        ))}

        {sections.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8 mb-3">
            <p className="text-sm text-gray-500 text-center">No gifts match. Try a different search or price.</p>
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center mt-1">Results are links to company sites. We don't sell anything or earn a commission.</p>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            &larr; Search all products
          </Link>
          <Link to="/guides/alternatives" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            Alternatives to Amazon &rarr;
          </Link>
        </div>
      </main>

      <Footer showSources />
    </div>
  )
}

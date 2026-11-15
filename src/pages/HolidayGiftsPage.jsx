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
  handmade: '🧣',
  'stocking-stuffers': '🎁',
  'gift-cards': '✉️',
}

const PRICE_FILTERS = [
  { id: 'all', label: 'Any price', test: () => true },
  { id: 'under25', label: 'Under $25', test: n => n < 25 },
  { id: 'under50', label: 'Under $50', test: n => n < 50 },
  { id: 'over50', label: '$50+', test: n => n >= 50 },
]

// Knit-sweater zigzag band: white chevrons over a deep red base
const KNIT = [
  'linear-gradient(135deg, #ffffff 25%, transparent 25%) -8px 0 / 16px 16px',
  'linear-gradient(225deg, #ffffff 25%, transparent 25%) -8px 0 / 16px 16px',
  'linear-gradient(315deg, #ffffff 25%, transparent 25%) 0 0 / 16px 16px',
  'linear-gradient(45deg, #ffffff 25%, transparent 25%) 0 0 / 16px 16px',
  '#be123c',
].join(', ')

const BULBS = ['#ef4444', '#fbbf24', '#22c55e', '#60a5fa']

// One swag of string lights; three side by side span the banner
function Lights() {
  return (
    <svg viewBox="0 0 200 34" className="w-1/3 h-7" aria-hidden="true">
      <path d="M0 4 Q25 22 50 4 T100 4 T150 4 T200 4" stroke="#9fb3c8" strokeWidth="1.5" fill="none" />
      {BULBS.map((color, i) => (
        <g key={color}>
          <rect x={22.5 + i * 50} y="11" width="5" height="4" fill="#9fb3c8" />
          <ellipse cx={25 + i * 50} cy="21" rx="4.5" ry="7" fill={color} />
        </g>
      ))}
    </svg>
  )
}

function PineSprig({ className, style }) {
  return (
    <svg viewBox="0 0 120 80" className={className} style={style} aria-hidden="true">
      <path d="M4 78 Q50 60 116 20" stroke="#5b3415" strokeWidth="3" fill="none" />
      <g stroke="#166534" strokeWidth="2.5" strokeLinecap="round">
        <path d="M20 72 l-6 -12 M20 72 l10 -8 M36 65 l-5 -13 M36 65 l11 -7 M52 57 l-4 -13 M52 57 l12 -6 M68 48 l-3 -13 M68 48 l12 -5 M84 39 l-2 -12 M84 39 l12 -4 M100 29 l-1 -11 M100 29 l11 -3" />
      </g>
      <g stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
        <path d="M28 69 l-2 -12 M28 69 l12 -4 M44 61 l-1 -12 M44 61 l12 -3 M60 53 l0 -12 M60 53 l12 -2 M76 44 l1 -12 M76 44 l11 -1 M92 34 l2 -11" />
      </g>
      <circle cx="58" cy="62" r="3.5" fill="#dc2626" />
      <circle cx="64" cy="60" r="3.5" fill="#b91c1c" />
      <circle cx="61" cy="66" r="3.5" fill="#dc2626" />
    </svg>
  )
}

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
      <main className="flex-1 max-w-xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500">Shop worker and employee owned businesses online</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl w-full mb-3 text-center shadow-sm" style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #0f2440 100%)' }}>
          <div className="h-4 w-full" style={{ background: KNIT }} />
          <div className="relative flex" style={{ filter: 'drop-shadow(0 0 6px rgba(252, 211, 77, .55))' }}>
            <Lights /><Lights /><Lights />
          </div>
          <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 text-white">
            <span className="absolute left-[6%] top-12 text-3xl opacity-20">❄</span>
            <span className="absolute left-[24%] top-20 text-base opacity-30">❄</span>
            <span className="absolute left-[14%] bottom-10 text-xl opacity-20">❄</span>
            <span className="absolute right-[8%] top-14 text-4xl opacity-20">❄</span>
            <span className="absolute right-[24%] bottom-12 text-lg opacity-30">❄</span>
            <span className="absolute left-[44%] bottom-6 text-sm opacity-25">❄</span>
            <PineSprig className="absolute -left-2 bottom-4 w-16 h-12 sm:w-28 sm:h-20" />
            <PineSprig className="absolute -right-2 bottom-4 w-16 h-12 sm:w-28 sm:h-20" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div className="relative px-6 pt-4 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-300 mb-2">Holiday Gift Guide</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Gifts from Worker-Owned Companies
            </h2>
            <p className="text-sm text-sky-100 max-w-md mx-auto">
              Chocolate, coffee, vinyl, games, cozy socks, and more from co-ops and employee-owned businesses. Every link goes straight to the company's own store.
            </p>
          </div>
          <div className="h-4 w-full" style={{ background: KNIT }} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-4 py-4 mb-3">
          <div className="flex overflow-x-auto sm:flex-wrap sm:justify-center gap-1.5 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {giftGuide.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border border-[#1e3a5f]/25 bg-sky-50 text-[#1e3a5f] hover:bg-sky-100 transition-colors"
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
              className="flex-1 px-3 py-2 text-sm border border-[#1e3a5f]/60 rounded-lg bg-white focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] placeholder-gray-500"
            />
            <div className="flex gap-1 justify-center">
              {PRICE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setPriceFilter(f.id)}
                  className={`text-xs font-semibold px-2.5 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                    priceFilter === f.id
                      ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
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
            <div className="h-2.5 w-full" style={{ background: KNIT }} />
            <div className="px-6 py-5">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                <span className="mr-1.5">{ICONS[section.id]}</span>{section.title}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{section.blurb}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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

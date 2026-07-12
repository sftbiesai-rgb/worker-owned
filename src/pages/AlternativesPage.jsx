import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

// Hand-picked stores for the Amazon alternative section (variety across categories)
const AMAZON_PICKS = [
  { name: 'Equal Exchange', product: 'Coffee, tea, and chocolate', detail: 'from a pioneer worker co-op since 1986.' },
  { name: 'King Arthur Baking Company', product: 'Flours, baking mixes, and ingredients.', detail: 'Employee-owned since 2004.' },
  { name: 'Mast General Store', product: 'Outdoor gear, clothing, candy, and housewares.', detail: 'Employee-owned general store.' },
  { name: 'Thrifty White Pharmacy', product: 'Pharmacy, health, and wellness products.', detail: 'Employee-owned since 1952.' },
  { name: 'Artisans Cooperative', product: 'Handmade ceramics, jewelry, textiles, and art.', detail: 'A co-op alternative to Etsy.' },
  { name: 'Means Workwear', product: 'Durable workwear and everyday clothing.', detail: 'Worker-owned in the US.' },
  { name: 'Just Coffee Cooperative', product: 'Fair-trade organic coffee', detail: 'roasted in Madison, WI since 2001.' },
  { name: 'Red Emma\'s', product: 'Books, zines, and coffee', detail: 'from a worker-owned bookstore in Baltimore.' },
  { name: 'Bob\'s Red Mill', product: 'Whole grains, oats, flours, and baking staples.', detail: 'Employee-owned.' },
  { name: 'Frontier Co-op', product: 'Spices, seasonings, and bulk herbs.', detail: 'Member-owned co-op since 1976.' },
]

const ALTERNATIVES = [
  {
    instead: 'Amazon',
    why: 'These worker-owned businesses sell the same products and ship nationwide.',
    picks: AMAZON_PICKS,
  },
  {
    instead: 'Etsy',
    why: 'Etsy takes up to 15% in fees from makers. These worker-owned shops sell handmade goods directly, keeping 100% of the sale.',
    categories: [
      { label: 'Art & Prints', section: 'Art & Prints' },
      { label: 'Home Goods & Handmade', section: 'Home Goods & Services' },
      { label: 'Apparel', section: 'Apparel' },
    ],
  },
  {
    instead: 'Spotify',
    why: 'Spotify pays artists fractions of a cent per stream. These worker-owned platforms let you support musicians directly.',
    categories: [
      { label: 'Music Platforms', section: 'Music' },
    ],
  },
  {
    instead: 'Corporate News',
    why: 'These media outlets are owned by the journalists and writers who produce them.',
    categories: [
      { label: 'Media & Publishing', section: 'Media & Publishing' },
    ],
  },
]

function AlternativesPage() {
  const { hash } = useLocation()

  useEffect(() => {
    document.title = 'Worker-Owned Alternatives to Amazon, Etsy & More | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Skip Amazon and Etsy. Shop worker-owned cooperatives that sell coffee, food, books, clothing, art, and more. Every purchase supports worker ownership.')
  }, [])

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [hash])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Worker-Owned Alternatives</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-8">
            Same products you already buy, from businesses owned by the people who make them.
          </p>

          {ALTERNATIVES.map(alt => {
            let stores
            let pickData = {}
            if (alt.picks) {
              // Use hand-picked stores for variety
              stores = alt.picks
                .map(pick => {
                  const store = marketplaceData.find(s => s.name === pick.name)
                  if (store) pickData[store.id] = pick
                  return store
                })
                .filter(Boolean)
            } else {
              // Pick evenly from each category
              const seen = new Set()
              const perCategory = Math.max(2, Math.floor(8 / alt.categories.length))
              stores = []
              alt.categories.forEach(cat => {
                const catStores = marketplaceData.filter(s => s.site_section === cat.section && !seen.has(s.url))
                catStores.slice(0, perCategory).forEach(s => {
                  seen.add(s.url)
                  stores.push(s)
                })
              })
            }

            return (
              <div key={alt.instead} id={alt.instead.toLowerCase().replace(/\s+/g, '-')} className="mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Instead of {alt.instead}</h2>
                <p className="text-sm text-gray-500 mb-3">{alt.why}</p>

                <div className="space-y-1.5">
                  {stores.slice(0, 10).map(store => (
                    <div key={store.id} className="bg-[#f5f5f7] rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/marketplace/store/${slugify(store.name)}`}
                          className="font-semibold text-sm text-[#004cb9] hover:text-[#003a8c] transition-colors truncate flex items-center gap-1.5"
                        >
                          {faviconUrl(store.url) && <img src={faviconUrl(store.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                          {store.name}
                        </Link>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 bg-blue-50 text-[#004cb9]">
                          {store.ownership_type}
                        </span>
                      </div>
                      {pickData[store.id] ? (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                          <span className="font-semibold text-gray-600">{pickData[store.id].product}</span>{' '}
                          {pickData[store.id].detail}
                        </p>
                      ) : store.notes ? (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{store.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                {alt.categories && stores.length > 8 && (
                  <Link
                    to={`/marketplace/${slugify(alt.categories[0].section)}`}
                    className="inline-block mt-2 text-xs text-[#004cb9] hover:text-[#003a8c] font-medium"
                  >
                    View all {stores.length} stores &rarr;
                  </Link>
                )}
                {alt.picks && (
                  <Link
                    to="/marketplace/companies"
                    className="inline-block mt-2 text-xs text-[#004cb9] hover:text-[#003a8c] font-medium"
                  >
                    Browse all companies &rarr;
                  </Link>
                )}
              </div>
            )
          })}

          <div className="border-t border-gray-100 pt-6 mt-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Why shop worker-owned?</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>Workers keep the profits.</strong> At a co-op, revenue is shared among the people who do the work.</li>
              <li><strong>Better wages, better conditions.</strong> Worker-owners set their own pay and working conditions together.</li>
              <li><strong>Same products, different model.</strong> These co-ops sell the same coffee, books, and clothing you already buy. The difference is where the money goes.</li>
              <li><strong>Local and sustainable.</strong> Most worker co-ops are small, community-rooted businesses.</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search all products
          </Link>
          <Link to="/guides/what-is-a-worker-cooperative" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            What is a co-op? &rarr;
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

export default AlternativesPage

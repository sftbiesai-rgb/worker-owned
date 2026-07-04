import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function displayTags(tags) {
  if (!tags?.length) return null
  return tags
    .map(t => t.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .filter(t => t.length > 2 && t.length < 40 && !/^\d+$/.test(t) && !t.includes('_') && !/wholesale/i.test(t))
    .slice(0, 3)
}

function thumbUrl(url, size = 300) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'cdn.shopify.com') {
      u.searchParams.set('width', String(size))
      return u.toString()
    }
  } catch {}
  return url
}

function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

const SUBCATEGORIES = {
  apparel: [
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'clog', 'slipper', 'slide', 'mule', 'loafer', 'flat ', 'heel', 'wedge'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'top', 'blouse', 'tank ', 'tank top', 'polo', 'henley', 'camisole'] },
    { slug: 'pants', label: 'Pants & Bottoms', keywords: ['pant', 'jean', 'short', 'skirt', 'bottom', 'legging'] },
    { slug: 'accessories', label: 'Hats & Accessories', keywords: ['hat ', 'beanie', 'cap ', 'scarf', 'glove', 'belt', 'sock', 'bag', 'backpack', 'wallet', 'pouch', 'purse', 'crossbody', 'tote', 'wristlet'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'sweater', 'fleece', 'parka', 'cardigan', 'shacket'] },
  ],
  'home-goods': [
    { slug: 'jewelry', label: 'Jewelry', keywords: ['jewelry', 'earring', 'necklace', 'bracelet', 'ring', 'pendant', 'body jewelry'] },
    { slug: 'art', label: 'Art & Prints', keywords: ['art', 'print', 'poster', 'painting', 'wall art', 'canvas', 'illustration'] },
    { slug: 'woodworking', label: 'Woodworking', keywords: ['wood', 'cutting board', 'furniture', 'shelf', 'table', 'chair'] },
    { slug: 'ceramics', label: 'Ceramics & Pottery', keywords: ['ceramic', 'pottery', 'mug', 'bowl', 'plate', 'vase'] },
    { slug: 'decor', label: 'Candles & Decor', keywords: ['candle', 'decor', 'lamp', 'pillow', 'blanket'] },
    { slug: 'paper', label: 'Paper Goods', keywords: ['paper', 'card', 'stationery', 'notebook', 'sticker'] },
  ],
  'food-pantry': [
    { slug: 'seeds', label: 'Seeds & Garden', keywords: ['seed', 'garden', 'plant', 'flower', 'herb', 'vegetable'] },
    { slug: 'cheese', label: 'Cheese & Dairy', keywords: ['cheese', 'butter', 'dairy', 'yogurt', 'cream'] },
    { slug: 'meat', label: 'Meat & Butcher', keywords: ['beef', 'chicken', 'pork', 'meat', 'sausage', 'bacon', 'steak', 'butcher'] },
    { slug: 'chocolate', label: 'Chocolate & Sweets', keywords: ['chocolate', 'candy', 'sweet', 'cocoa', 'truffle', 'toffee', 'fudge', 'caramel'] },
    { slug: 'pantry', label: 'Pantry Staples', keywords: ['olive oil', 'nut butter', 'jam', 'honey', 'spice', 'seasoning', 'sauce', 'vinegar', 'flour', 'grain', 'seaweed', 'kelp'] },
  ],
}

const SECTIONS = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea',       sectionName: 'Coffee & Tea',       title: 'Worker Owned Coffee & Tea Online | Worker Owned Marketplace',                          description: 'Shop worker owned coffee roasters and tea brands online. Cooperatively owned coffee roasted and shipped direct to your door.' },
  { slug: 'media-publishing', label: 'Media & Publishing', sectionName: 'Media & Publishing', title: 'Worker Owned Media, News & Publishers Online | Worker Owned Marketplace',              description: 'Read and support worker owned journalism, newsletters, podcasts, and book publishers. Independent media owned by the people who make it.' },
  { slug: 'food-pantry',      label: 'Food & Pantry',      sectionName: 'Food & Pantry',      title: 'Worker Owned Food & Pantry Online | Worker Owned Marketplace',                         description: 'Shop worker owned food brands online. Cooperatively owned nut butters, pickles, chocolate, olive oil, and pantry staples.' },
  { slug: 'apparel',          label: 'Apparel',            sectionName: 'Apparel',            title: 'Worker Owned Clothing & Apparel Online | Worker Owned Marketplace',                    description: 'Shop worker owned clothing and apparel brands online. Cooperatively owned, USA-made, fair labor fashion.' },
  { slug: 'art-prints',       label: 'Art & Prints',       sectionName: 'Art & Prints',       title: 'Worker Owned Art Prints & Posters Online | Worker Owned Marketplace',                  description: 'Buy art prints and posters from worker owned artist cooperatives. Political, social movement, and activist art ships worldwide.' },
  { slug: 'music',            label: 'Music',              sectionName: 'Music',              title: 'Worker Owned Music Platforms | Worker Owned Marketplace',                              description: 'Stream and buy music on cooperatively owned platforms. Worker owned Bandcamp alternatives where artists keep more.' },
  { slug: 'home-goods',       label: 'Home Goods',         sectionName: 'Home Goods',         title: 'Worker Owned Home Goods & Handmade Products Online | Worker Owned Marketplace',        description: 'Shop worker owned home goods and handmade products online. Cooperatively made ceramics, textiles, candles, and more.' },
  { slug: 'personal-care',    label: 'Personal Care',      sectionName: 'Personal Care',      title: 'Worker Owned Soap & Personal Care Online | Worker Owned Marketplace',                  description: 'Shop worker owned soaps and personal care products online. Cooperatively made with natural ingredients.' },
  { slug: 'games',            label: 'Games',              sectionName: 'Games',              title: 'Worker Owned Board Games Online | Worker Owned Marketplace',                           description: 'Buy board games from worker owned cooperatives. Social justice and cooperative games made in the USA.' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing',     sectionName: 'Beer & Brewing',     title: 'Worker Owned Breweries & Craft Beer | Worker Owned Marketplace',                       description: 'Find worker owned and cooperatively owned breweries. Craft beer made by and for the workers who brew it.' },
  { slug: 'tech-software',    label: 'Tech & Software',    sectionName: 'Tech & Software',    title: 'Worker Owned Tech & Software | Worker Owned Marketplace',                             description: 'Worker owned technology companies, software co-ops, and platform cooperatives. Tech built by the people who make it.' },
]

function dedupeByUrl(entries) {
  const seen = new Map()
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (!seen.has(e.url)) seen.set(e.url, e)
  }
  return entries.filter(e => seen.get(e.url) === e)
}

function ownershipBadge(type) {
  if (!type) return null
  const clean = type.toLowerCase()
  let color = 'bg-gray-100 text-gray-500'
  if (clean.includes('worker co-op') || clean === 'worker owned') color = 'bg-blue-50 text-[#004cb9]'
  else if (clean.includes('esop') || clean.includes('employee')) color = 'bg-green-50 text-green-700'
  else if (clean.includes('multi-stakeholder') || clean.includes('consumer')) color = 'bg-purple-50 text-purple-700'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {type}
    </span>
  )
}

const PER_PAGE = 40

function MarketplacePage() {
  const { category, subcategory } = useParams()
  const section = SECTIONS.find(s => s.slug === category)
  const subs = SUBCATEGORIES[category]
  const activeSub = subs?.find(s => s.slug === subcategory) || null
  const [products, setProducts] = useState([])
  const [page, setPage] = useState(1)
  const [showStores, setShowStores] = useState(category === 'tech-software' || category === 'art-prints' || category === 'music')

  useEffect(() => {
    if (!section) return
    fetch(`/data/products-${section.slug}.json`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [section])

  useEffect(() => {
    if (!section) return
    const suffix = activeSub ? ` — ${activeSub.label}` : ''
    const title = activeSub
      ? `${activeSub.label} — ${section.label} | Worker Owned Marketplace`
      : section.title
    const desc = activeSub
      ? `Browse ${activeSub.label.toLowerCase()} from worker owned businesses. Shop cooperatively made products.`
      : section.description
    const canonical = `https://www.workerowned.info/marketplace/${section.slug}${activeSub ? '/' + activeSub.slug : ''}`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc)
  }, [section, activeSub])

  useEffect(() => { setPage(1) }, [subcategory])

  if (!section) return <Navigate to="/marketplace" replace />
  if (subcategory && subs && !activeSub) return <Navigate to={`/marketplace/${category}`} replace />

  const sectionProducts = products.filter(p => p.site_section === section.sectionName)

  const filtered = activeSub
    ? sectionProducts.filter(p => {
        const text = p.title.toLowerCase() + ' ' + (p.tags || []).join(' ').toLowerCase()
        return activeSub.keywords.some(kw => text.includes(kw))
      })
    : sectionProducts

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const entries = dedupeByUrl(
    marketplaceData.filter(e => e.site_section === section.sectionName)
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker owned businesses online</p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
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

          {/* Subcategory chips */}
          {subs && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              <Link
                to={`/marketplace/${category}`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !activeSub
                    ? 'bg-gray-800 text-white'
                    : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
                }`}
              >
                All
              </Link>
              {subs.map(s => (
                <Link
                  key={s.slug}
                  to={`/marketplace/${category}/${s.slug}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    s.slug === subcategory
                      ? 'bg-gray-800 text-white'
                      : 'bg-[#f5f5f7] text-gray-500 hover:text-[#004cb9]'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Products grid */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">{activeSub ? activeSub.label : section.label}</h2>
            <p className="text-xs text-gray-400">
              {products.length > 0 ? `${filtered.length} product${filtered.length !== 1 ? 's' : ''}` : 'Loading…'}
            </p>
          </div>

          {paged.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {paged.map(p => (
                  <div key={p.id} className="bg-[#f5f5f7] rounded-xl overflow-hidden group">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener"
                      className="block hover:opacity-90 transition-opacity"
                    >
                      {p.image && (
                        <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
                          <img src={thumbUrl(p.image)} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                          {p.available === false && (
                            <span className="absolute top-1.5 left-1.5 bg-gray-800/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold out</span>
                          )}
                        </div>
                      )}
                      <div className="px-3 pt-2 pb-1">
                        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title} <span className="text-gray-400 font-normal">↗</span></p>
                        {p.price && <p className="text-xs font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
                      </div>
                    </a>
                    {displayTags(p.tags)?.length > 0 && (
                      <div className="px-3 pb-1 hidden group-hover:block">
                        <p className="text-[10px] text-gray-400 leading-snug line-clamp-1">{displayTags(p.tags).join(' · ')}</p>
                      </div>
                    )}
                    {p.store_name && (
                      <div className="px-3 pb-2">
                        <Link
                          to={`/marketplace/store/${slugify(p.store_name)}`}
                          className="text-[10px] text-gray-400 hover:text-[#004cb9] transition-colors truncate flex items-center gap-1"
                        >
                          {faviconUrl(p.store_url) && <img src={faviconUrl(p.store_url)} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
                          {p.store_name}
                        </Link>
                        {p.ownership_type && <div className="px-3 -mt-0.5"><span className={`text-[8px] font-semibold px-1 py-px rounded ${p.ownership_type.toLowerCase().includes('worker co-op') || p.ownership_type.toLowerCase() === 'worker owned' ? 'bg-blue-50 text-[#004cb9]' : 'bg-green-50 text-green-700'}`}>{p.ownership_type}</span></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0) }}
                    disabled={page === 1}
                    className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
                  >
                    ‹
                  </button>
                  <span className="text-xs text-gray-400 px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0) }}
                    disabled={page === totalPages}
                    className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          ) : products.length > 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">To see products and services offered, visit company sites below.</p>
          ) : null}
        </div>

        {/* Stores section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
          <button
            onClick={() => setShowStores(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-sm font-bold text-gray-700">{entries.length} {section.label} stores</h2>
            <span className="text-xs text-gray-400">{showStores ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showStores && (
            <div className="space-y-3 mt-4">
              {entries.map(entry => (
                <Link key={entry.id} to={`/marketplace/store/${slugify(entry.name)}`} className="block bg-[#f5f5f7] rounded-xl px-4 py-3 hover:ring-1 hover:ring-[#004cb9] transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-[#004cb9] leading-snug flex items-center gap-1.5">
                      {faviconUrl(entry.url) && <img src={faviconUrl(entry.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                      {entry.name}
                    </span>
                    {ownershipBadge(entry.ownership_type)}
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-gray-500 leading-relaxed">{entry.notes}</p>
                  )}
                  {entry.ships && entry.ships !== 'US' && (
                    <p className="text-xs text-gray-400 mt-1">Ships: {entry.ships}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-center">
          <Link to="/marketplace" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; All categories
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

export default MarketplacePage

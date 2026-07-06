import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpDown } from 'lucide-react'

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

const MARKETPLACE_CATEGORIES = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea' },
  { slug: 'media-publishing', label: 'Media & Publishing' },
  { slug: 'food-pantry',      label: 'Food & Pantry' },
  { slug: 'apparel',          label: 'Apparel' },
  { slug: 'art-prints',       label: 'Art & Prints' },
  { slug: 'music',            label: 'Music' },
  { slug: 'home-goods',       label: 'Home Goods & Services' },
  { slug: 'personal-care',    label: 'Personal Care' },
  { slug: 'games',            label: 'Games' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing' },
  { slug: 'tech-software',    label: 'Tech & Software' },
]

function MarketplaceIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sort = searchParams.get('sort') || 'relevance'
  const [products, setProducts] = useState([])
  const [inputValue, setInputValue] = useState(query)
  const debounceRef = useRef(null)

  const updateParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === '1' && k === 'page' || v === 'relevance' && k === 'sort') next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleSearchInput = useCallback((value) => {
    setInputValue(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value, page: '1' })
    }, 250)
  }, [updateParams])

  useEffect(() => { setInputValue(query) }, [query])

  const fetchedRef = useRef(false)

  useEffect(() => {
    document.title = 'Market Place | Shop worker owned online stores for apparel, home goods, food and more'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse worker owned online stores by category or search thousands of products from cooperatives and employee-owned companies.')
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    if (!inputValue.trim() && !query.trim()) return
    fetchedRef.current = true
    fetch('/data/products.json')
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [inputValue, query])

  const results = useMemo(() => {
    if (!inputValue.trim()) return []

    // Stem a word: plurals, -ing, -ed, -er, -ly
    function stemWord(w) {
      const forms = new Set([w])
      // Plurals
      if (w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y')
      else if (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('zes') || w.endsWith('shes') || w.endsWith('ches')) forms.add(w.slice(0, -2))
      else if (w.endsWith('s') && !w.endsWith('ss')) forms.add(w.slice(0, -1))
      // -ing: roasting→roast, baking→bake, running→run
      if (w.endsWith('ing') && w.length > 4) {
        forms.add(w.slice(0, -3))          // roasting → roast
        forms.add(w.slice(0, -3) + 'e')    // baking → bake
        if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) forms.add(w.slice(0, -4)) // running → run
      }
      // -ed: roasted→roast, baked→bake
      if (w.endsWith('ed') && w.length > 3) {
        forms.add(w.slice(0, -2))           // roasted → roast
        forms.add(w.slice(0, -1))           // baked → bake (via 'd' removal)
        if (w.endsWith('ied')) forms.add(w.slice(0, -3) + 'y') // dried → dry
        if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) forms.add(w.slice(0, -3)) // brewed → brew
      }
      // -er: roaster→roast, baker→bake
      if (w.endsWith('er') && w.length > 3) {
        forms.add(w.slice(0, -2))           // roaster → roast
        forms.add(w.slice(0, -1))           // baker → bake (via 'r' removal — caught by -e)
        if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) forms.add(w.slice(0, -3)) // brewer → brew
      }
      return [...forms]
    }

    // Synonym expansions: query word → additional words to match
    const SYNONYMS = {
      tee: ['t-shirt', 'tee'], tshirt: ['t-shirt', 'tee'], 'shirt': ['t-shirt', 'tee', 'shirt'],
      mug: ['cup', 'mug'], cup: ['mug', 'cup'],
      pants: ['trousers', 'jeans', 'pants'], trousers: ['pants', 'trousers'],
      sneakers: ['shoes', 'sneakers'], shoes: ['sneakers', 'footwear', 'shoes'],
      hoodie: ['sweatshirt', 'hoodie'], sweatshirt: ['hoodie', 'sweatshirt'],
      bag: ['tote', 'bag', 'pouch'], tote: ['bag', 'tote'],
      chocolate: ['cocoa', 'cacao', 'chocolate'], cocoa: ['chocolate', 'cocoa', 'cacao'],
      tea: ['chai', 'tea'], chai: ['tea', 'chai'],
      soap: ['bar soap', 'soap'], lotion: ['moisturizer', 'lotion', 'cream'],
      cap: ['hat', 'cap', 'beanie'], hat: ['cap', 'hat', 'beanie'],
      vinyl: ['record', 'lp', 'vinyl'], record: ['vinyl', 'lp', 'record'],
      poster: ['print', 'poster', 'art print'], print: ['poster', 'print', 'art print'],
      jam: ['preserve', 'jelly', 'jam'], jelly: ['jam', 'preserve', 'jelly'],
      'hot sauce': ['hot sauce', 'salsa', 'chili sauce'], salsa: ['hot sauce', 'salsa'],
    }

    // Word-boundary match: query word must appear as a whole word or prefix in the text
    function wordMatch(text, stems) {
      if (!text) return false
      const lower = text.toLowerCase().replace(/['']/g, '')
      return stems.some(s => {
        const idx = lower.indexOf(s)
        if (idx === -1) return false
        // Must be at start of a word (preceded by start-of-string or non-letter)
        if (idx > 0 && /[a-z]/.test(lower[idx - 1])) return false
        return true
      })
    }

    // Split query into words, stem each one; normalize apostrophes
    const words = inputValue.toLowerCase().trim().replace(/['']/g, '').split(/\s+/).filter(Boolean)
    // Expand stems with synonyms
    const wordStems = words.map(w => {
      const stems = stemWord(w)
      const syns = SYNONYMS[w]
      if (syns) for (const s of syns) stems.push(...stemWord(s))
      return [...new Set(stems)]
    })

    // Extract searchable words from a product URL slug
    function urlWords(url) {
      if (!url) return ''
      try {
        const path = new URL(url).pathname
        return path.replace(/[^a-z0-9]+/gi, ' ').toLowerCase()
      } catch { return '' }
    }

    // Score and filter: all query words must match somewhere in the product
    const queryLower = inputValue.toLowerCase().trim().replace(/['']/g, '')
    const scored = []
    for (const p of products) {
      let allMatch = true
      let score = 0
      // Strip store/brand name from title to detect brand-only title matches
      const storeLower = (p.store_name || '').toLowerCase().replace(/['']/g, '')
      const titleLower = (p.title || '').toLowerCase().replace(/[''™℠®©]/g, '').replace(/&#x[0-9a-f]+;/gi, '').replace(/&#\d+;/g, '')
      const titleStripped = storeLower ? titleLower.replace(storeLower, '').replace(storeLower.replace(/\s+(co-op|cooperative|roasters|brewing|press)$/i, ''), '') : titleLower
      const slugText = urlWords(p.url)
      for (const stems of wordStems) {
        const inTitle = wordMatch(p.title, stems)
        const inStore = wordMatch(p.store_name, stems)
        const inTags = p.tags?.some(t => wordMatch(t, stems))
        const inSlug = wordMatch(slugText, stems)
        if (!inTitle && !inStore && !inTags && !inSlug) { allMatch = false; break }
        if (inTitle) {
          // Check if match is in the actual product part of the title, not just the brand name
          const inTitleStripped = stems.some(s => { const idx = titleStripped.indexOf(s); return idx !== -1 && (idx === 0 || !/[a-z]/.test(titleStripped[idx - 1])) })
          score += inTitleStripped ? 3 : 1
          // Bonus: word in title AND tags = likely the actual product category
          if (inTags) score += 2
        }
        else if (inStore && inTags) score += 2
        else if (inTags) score += 1
        else if (inSlug) score += 0.5
        else if (inStore) score += 0.5
      }
      // Bonus: full query appears in the product-relevant part of title
      if (allMatch && titleStripped.includes(queryLower)) score += 5
      // Category bonus: query matches the product's section (e.g. "coffee" matches "Coffee & Tea")
      if (allMatch && p.site_section) {
        const sectionLower = p.site_section.toLowerCase()
        if (words.some(w => sectionLower.includes(w))) score += 4
      }
      // Ownership bonus: prioritize worker co-ops over ESOPs
      if (allMatch) {
        const ot = (p.ownership_type || '').toLowerCase()
        if (ot.includes('worker co-op') || ot === 'worker owned') score += 2
        else if (ot.includes('multi-stakeholder')) score += 1
      }
      // Query density sub-score: what fraction of title words are query matches?
      // "French Roast Coffee" → 1/3 = 0.33 (product IS coffee)
      // "OXO Coffee Grinder" → 1/3 = 0.33 but stripped title is longer
      // Higher density = product is more likely TO BE the thing searched for
      if (allMatch) {
        const titleWords = titleStripped.trim().split(/\s+/).filter(Boolean)
        const matchCount = words.filter(w => titleStripped.includes(w)).length
        score += titleWords.length > 0 ? (matchCount / titleWords.length) : 0
      }
      // Slight penalty for sold-out items
      if (allMatch && p.available === false) score -= 1
      // Penalty: match is store-name-only (e.g. "coffee" matching "X Coffee Cooperative" but product is a t-shirt)
      if (allMatch && score < 1.5) score -= 2
      if (allMatch) scored.push({ p, score })
    }

    // Sort by score with store fatigue: each additional product from the same store
    // costs a small penalty, naturally letting other stores surface
    scored.sort((a, b) => b.score - a.score)
    const storeCounts = new Map()
    const FATIGUE = 0.3 // penalty per prior appearance of same store
    const withFatigue = scored.map(item => {
      const store = item.p.store_name || ''
      const prior = storeCounts.get(store) || 0
      storeCounts.set(store, prior + 1)
      return { ...item, effective: item.score - (prior * FATIGUE) }
    })
    withFatigue.sort((a, b) => b.effective - a.effective)
    return withFatigue.map(s => s.p)
  }, [inputValue, products])

  const PER_PAGE = 40

  const sortedResults = useMemo(() => {
    if (sort === 'relevance') return results
    const sorted = [...results]
    if (sort === 'price-asc') sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
    if (sort === 'price-desc') sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0))
    if (sort === 'store') sorted.sort((a, b) => (a.store_name || '').localeCompare(b.store_name || ''))
    return sorted
  }, [results, sort])

  const totalPages = Math.ceil(sortedResults.length / PER_PAGE)
  const pagedResults = sortedResults.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const storeCount = useMemo(() => new Set(products.map(p => p.store_url)).size, [products])

  const searching = inputValue.trim().length > 0

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl lg:max-w-4xl mx-auto w-full px-5 py-8 flex flex-col">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-6 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src="/logo-marketplace.png" alt="Worker Owned Marketplace" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Market Place</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">Shop worker owned businesses online</p>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products or stores…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
              value={inputValue}
              onChange={e => handleSearchInput(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Results are links to company sites. We don't sell anything or earn a commission.</p>
        </div>

        <Link to="/coffee" className="block bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-4 mb-3 hover:border-[#004cb9] transition-colors">
          <div className="flex items-center justify-center gap-2.5">
            <img src="/logo-coffee.png" alt="" width="28" height="28" className="shrink-0" />
            <span className="text-sm text-[#004cb9] font-semibold"><strong>Quick Tool:</strong> worker owned coffee shops, bars, restaurants, and groceries near you!</span>
          </div>
        </Link>

        {searching ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
            {results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No results for "{inputValue}"</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">{results.length} result{results.length !== 1 ? 's' : ''}</p>
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown size={12} className="text-gray-400" />
                    <select
                      value={sort}
                      onChange={e => updateParams({ sort: e.target.value, page: '1' })}
                      className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="store">Store A–Z</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pagedResults.map(p => (
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
                      onClick={() => { updateParams({ page: String(page - 1) }); window.scrollTo(0, 0) }}
                      disabled={page === 1}
                      className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
                    >
                      ‹
                    </button>
                    <span className="text-xs text-gray-400 px-2">{page} / {totalPages}</span>
                    <button
                      onClick={() => { updateParams({ page: String(page + 1) }); window.scrollTo(0, 0) }}
                      disabled={page === totalPages}
                      className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-5">
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by category</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MARKETPLACE_CATEGORIES.map(cat => (
                <Link
                  key={cat.slug}
                  to={`/marketplace/${cat.slug}`}
                  className="py-2 px-3 rounded-lg text-sm font-medium text-center bg-[#f5f5f7] text-gray-600 hover:text-[#004cb9] hover:bg-blue-50 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              {products.length > 0
                ? <>{products.length.toLocaleString()} products from <Link to="/marketplace/companies" className="text-[#004cb9] hover:text-[#BF0A30] transition-colors">{storeCount} worker owned companies</Link></>
                : <>32,000+ products from <Link to="/marketplace/companies" className="text-[#004cb9] hover:text-[#BF0A30] transition-colors">60+ worker owned companies</Link></>}
            </p>
          </div>
        )}

        <div className="mt-3 text-center">
          <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Submit a worker owned business &rarr;
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

export default MarketplaceIndexPage

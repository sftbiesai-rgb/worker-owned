import MiniSearch from 'minisearch'

// Normalize compound terms so multi-word concepts become single tokens.
// Applied to both product text (at index time) and queries (at search time).
function normalizeText(text) {
  return text.toLowerCase()
    .replace(/t[-\s]shirts?\b/g, 'tshirt')
    .replace(/long[-\s]sleev\w*/g, 'longsleeve')
    .replace(/short[-\s]sleev\w*/g, 'shortsleeve')
    .replace(/v[-\s]neck/g, 'vneck')
    .replace(/crew[-\s]neck/g, 'crewneck')
    .replace(/button[-\s]down/g, 'buttondown')
    .replace(/button[-\s]up/g, 'buttonup')
    .replace(/polo\s+shirt/g, 'poloshirt')
    .replace(/dress\s+shirt/g, 'dressshirt')
    .replace(/hot\s+sauce/g, 'hotsauce')
    .replace(/nut\s+butter/g, 'nutbutter')
    .replace(/peanut\s+butter/g, 'peanutbutter')
    .replace(/olive\s+oil/g, 'oliveoil')
    .replace(/ice\s+cream/g, 'icecream')
    .replace(/maple\s+syrup/g, 'maplesyrup')
    .replace(/board\s+games?\b/g, 'boardgame')
    .replace(/card\s+games?\b/g, 'cardgame')
    .replace(/video\s+games?\b/g, 'videogame')
    .replace(/blu[-\s]?ray/g, 'bluray')
    .replace(/fair\s+trade/g, 'fairtrade')
    .replace(/sea\s+vegetables?/g, 'seavegetable')
    .replace(/dark\s+roast/g, 'darkroast')
    .replace(/medium\s+roast/g, 'mediumroast')
    .replace(/light\s+roast/g, 'lightroast')
    .replace(/cold\s+brew/g, 'coldbrew')
    .replace(/rain\s+jacket/g, 'rainjacket')
    .replace(/face\s+wash/g, 'facewash')
    .replace(/body\s+wash/g, 'bodywash')
    .replace(/hand\s+soap/g, 'handsoap')
    .replace(/lip\s+balm/g, 'lipbalm')
    .replace(/red\s+mill/g, 'redmill')
}

export function buildProductIndex(products) {
  const ms = new MiniSearch({
    fields: ['title', 'tagsText'],
    searchOptions: {
      boost: { title: 3, tagsText: 1 },
      prefix: true,
      fuzzy: (term) => term.length > 8 ? 0.15 : false,
      combineWith: 'AND',
    },
  })

  ms.addAll(products.map((p, i) => ({
    id: i,
    title: normalizeText(p.title || ''),
    tagsText: normalizeText((p.tags || []).join(' ')),
  })))

  return ms
}

export function searchProducts(query, products, index) {
  if (!query.trim() || !index) return []

  const normalized = normalizeText(query.trim())
  const words = normalized.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return []

  const results = index.search(words.join(' '))

  // Apply store fatigue so one store doesn't dominate results
  const storeCounts = new Map()
  const scored = results
    .filter(r => products[r.id]?.available !== false)
    .map(r => {
      const p = products[r.id]
      const store = p.store_name || ''
      const prior = storeCounts.get(store) || 0
      storeCounts.set(store, prior + 1)
      // Small co-op boost
      const ot = (p.ownership_type || '').toLowerCase()
      const coopBonus = (ot.includes('worker co-op') || ot === 'worker owned') ? 0.05 * r.score
        : ot.includes('multi-stakeholder') ? 0.02 * r.score : 0
      return { p, effective: r.score + coopBonus - (prior * 0.003 * r.score) }
    })

  scored.sort((a, b) => b.effective - a.effective)
  return scored.map(s => s.p)
}

// Company search — small dataset, no index needed
function wordMatch(text, stems) {
  if (!text) return false
  const lower = text.toLowerCase().replace(/['']/g, '')
  return stems.some(s => {
    const idx = lower.indexOf(s)
    if (idx === -1) return false
    if (idx > 0 && /[a-z]/.test(lower[idx - 1])) return false
    return true
  })
}

function stemWord(w) {
  const forms = new Set([w])
  if (w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y')
  else if (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('zes') || w.endsWith('shes') || w.endsWith('ches')) forms.add(w.slice(0, -2))
  else if (w.endsWith('s') && !w.endsWith('ss')) forms.add(w.slice(0, -1))
  if (w.endsWith('ing') && w.length > 4) {
    forms.add(w.slice(0, -3))
    forms.add(w.slice(0, -3) + 'e')
    if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) forms.add(w.slice(0, -4))
  }
  if (w.endsWith('ed') && w.length > 3) {
    forms.add(w.slice(0, -2))
    forms.add(w.slice(0, -1))
    if (w.endsWith('ied')) forms.add(w.slice(0, -3) + 'y')
    if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) forms.add(w.slice(0, -3))
  }
  if (w.endsWith('er') && w.length > 3) {
    forms.add(w.slice(0, -2))
    forms.add(w.slice(0, -1))
    if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) forms.add(w.slice(0, -3))
  }
  return [...forms]
}

const SYNONYMS = {
  tee: ['tshirt', 'tee'], tshirt: ['tshirt', 'tee'],
  mug: ['cup', 'mug'], cup: ['mug', 'cup'],
  pants: ['trousers', 'jeans', 'pants'], trousers: ['pants', 'trousers'],
  sneakers: ['shoes', 'sneakers'], shoes: ['sneakers', 'footwear', 'shoes'],
  hoodie: ['sweatshirt', 'hoodie'], sweatshirt: ['hoodie', 'sweatshirt'],
  bag: ['tote', 'bag', 'pouch'], tote: ['bag', 'tote'],
  chocolate: ['cocoa', 'cacao', 'chocolate'], cocoa: ['chocolate', 'cocoa', 'cacao'],
  tea: ['chai', 'tea'], chai: ['tea', 'chai'],
  cap: ['hat', 'cap', 'beanie'], hat: ['cap', 'hat', 'beanie'],
  vinyl: ['record', 'lp', 'vinyl'], record: ['vinyl', 'lp', 'record'],
  poster: ['print', 'poster'], print: ['poster', 'print'],
  jam: ['preserve', 'jelly', 'jam'], jelly: ['jam', 'preserve', 'jelly'],
  hotsauce: ['hotsauce', 'salsa'], salsa: ['hotsauce', 'salsa'],
}

function urlWords(url) {
  if (!url) return ''
  try { return new URL(url).pathname.replace(/[^a-z0-9]+/gi, ' ').toLowerCase() }
  catch { return '' }
}

export function searchCompanies(inputValue, companies) {
  if (!inputValue.trim()) return []
  const words = inputValue.toLowerCase().trim().replace(/['']/g, '').split(/\s+/).filter(Boolean)
  const wordStems = words.map(w => {
    const stems = stemWord(w)
    const syns = SYNONYMS[w]
    if (syns) for (const s of syns) stems.push(...stemWord(s))
    return [...new Set(stems)]
  })
  const scored = []
  for (const c of companies) {
    let allMatch = true
    let score = 0
    const nameLower = (c.name || '').toLowerCase().replace(/['']/g, '')
    const notesLower = (c.notes || '').toLowerCase()
    const catLower = (c.category || '').toLowerCase()
    const slugText = urlWords(c.url)
    for (const stems of wordStems) {
      const inName = wordMatch(nameLower, stems)
      const inCat = wordMatch(catLower, stems)
      const inNotes = wordMatch(notesLower, stems)
      const inSlug = wordMatch(slugText, stems)
      if (!inName && !inCat && !inNotes && !inSlug) { allMatch = false; break }
      if (inName) score += 5
      else if (inCat) score += 2
      else if (inNotes) score += 1
      else if (inSlug) score += 1
    }
    if (allMatch) scored.push({ c, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.c)
}

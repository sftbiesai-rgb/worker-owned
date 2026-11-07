import MiniSearch from 'minisearch'

// Normalize compound terms so multi-word concepts become single tokens.
// Applied to both product text (at index time) and queries (at search time).
function normalizeText(text) {
  return text.toLowerCase()
    // Possessives: "men's" / "mens" / "kids'" all index and search the same
    .replace(/(\w)['\u2019]s\b/g, '$1s')
    .replace(/s['\u2019](?=\s|$)/g, 's')
    .replace(/\b(wo)?mens\b/g, '$1men')
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

// Light plural stemming so "boots" finds "Boot" and "pants" finds "Pant".
// Applied to every token at index and query time.
function stemTerm(term) {
  const t = term.toLowerCase()
  if (t.length <= 3) return t
  // berry/berries and hoodie/hoodies both meet at "-ie"
  if (t.endsWith('ies')) return t.slice(0, -1)
  if (/[^aeiou]y$/.test(t)) return t.slice(0, -1) + 'ie'
  if (/(ch|sh|x|zz|ss)es$/.test(t)) return t.slice(0, -2)
  if (/(ss|us|is)$/.test(t)) return t
  if (t.endsWith('s')) return t.slice(0, -1)
  return t
}

// Repeated words (stores often append the product type: "Ground Coffee Coffee")
// would otherwise inflate term frequency and push those items to the top.
function dedupeWords(text) {
  return [...new Set(text.split(/\s+/))].join(' ')
}

export function buildProductIndex(products) {
  const ms = new MiniSearch({
    fields: ['title', 'productType', 'tagsText'],
    processTerm: stemTerm,
    searchOptions: {
      boost: { title: 3, productType: 1.5, tagsText: 1 },
      // Stemming covers plurals; prefix only helps long partial words
      prefix: (term) => term.length > 5,
      fuzzy: (term) => term.length > 8 ? 0.15 : false,
      combineWith: 'AND',
    },
  })

  ms.addAll(products.map((p, i) => ({
    id: i,
    title: dedupeWords(normalizeText(p.title || '')),
    productType: dedupeWords(normalizeText(p.product_type || '')),
    tagsText: dedupeWords(normalizeText((p.tags || []).join(' '))),
  })))

  // Title word frequencies: autocomplete candidates, and the most common
  // real word behind each stem (so suggestions say "berries", not "berrie")
  const counts = new Map()
  for (const p of products) {
    for (const w of new Set((p.title || '').toLowerCase().split(/[^a-z0-9']+/))) {
      if (w.length >= 3 && !/^\d/.test(w)) counts.set(w, (counts.get(w) || 0) + 1)
    }
  }
  ms.suggestWords = [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])

  return ms
}

// Complete the last word typed with common title words; earlier words stay as typed
export function suggest(index, input, limit = 6) {
  const typed = input.toLowerCase().replace(/\s+/g, ' ').trimStart()
  const parts = typed.split(' ')
  const last = parts.pop()
  if (!last || last.length < 2 || !index.suggestWords) return []
  const before = parts.length ? parts.join(' ') + ' ' : ''
  const out = []
  for (const [w] of index.suggestWords) {
    if (w.startsWith(last) && w !== last) out.push(before + w)
    if (out.length >= limit) break
  }
  return out
}

// The item a title describes is usually its last real word: "Wildflower Honey"
// is honey, "Honey Stinger Energy Gel" is a gel. Ignore trailing variant/size
// noise ("- Lavender", "(2 Pack)", "12 oz").
const SIZE_WORD = /^(\d.*|oz|fl|lb|lbs|ct|count|pk|pack|piece|pc|g|kg|ml|l|in|inch|ft|x|each|set|of|assorted|asst)$/
function headTerm(title) {
  const main = normalizeText(title).split(/\s[-|–—]\s|[(@,:]/)[0]
  // Bull Moose style "Artist/Title": use the part after the slash
  const part = main.includes('/') ? main.split('/').pop() : main
  const tokens = part.split(/[^a-z0-9]+/).filter(t => t && !SIZE_WORD.test(t))
  return tokens.length ? stemTerm(tokens[tokens.length - 1]) : ''
}

export function searchProducts(query, products, index) {
  if (!query.trim() || !index) return []

  const normalized = normalizeText(query.trim())
  const words = normalized.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return []

  // Partial words ("choc") get prefix matching when they're rare as a whole word
  const partial = new Set(words.map(stemTerm).filter(t =>
    t.length >= 3 && index.search(t, { prefix: false, fuzzy: false }).length < 20))
  const results = index.search(words.join(' '), {
    prefix: (term) => term.length > 5 || partial.has(term),
  })

  const queryHeads = new Set(words.map(stemTerm))
  const items = results
    .filter(r => products[r.id])
    .map(r => ({ r, p: products[r.id], head: queryHeads.has(headTerm(products[r.id].title || '')) }))

  // Category intent: the categories where the query word is the item
  // itself (not a brand or color). "honey" -> Food & Pantry, not honey-colored tops.
  const headSections = new Map()
  let headTotal = 0
  for (const it of items) {
    if (!it.head) continue
    headTotal++
    headSections.set(it.p.industry, (headSections.get(it.p.industry) || 0) + 1)
  }
  const intent = new Set()
  if (headTotal >= 5) {
    for (const [sec, n] of headSections) if (n / headTotal >= 0.25) intent.add(sec)
  }

  // Store fatigue keeps one big store from filling the first pages
  // (lots of small stores here, so it's stronger than on workerowned)
  const storeCounts = new Map()
  const scored = items.map(({ r, p, head }) => {
    const store = p.store_name || ''
    const prior = storeCounts.get(store) || 0
    storeCounts.set(store, prior + 1)
    const mult = 1 + (head ? 0.6 : 0) + (intent.has(p.industry) ? 0.3 : 0)
      - Math.min(prior * 0.06, 0.6)
    return { p, effective: r.score * mult }
  })

  scored.sort((a, b) => b.effective - a.effective)
  return scored.map(s => s.p)
}

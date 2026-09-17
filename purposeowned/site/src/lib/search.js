import MiniSearch from 'minisearch'

export function buildProductIndex(products) {
  const ms = new MiniSearch({
    fields: ['title', 'tagsText'],
    searchOptions: {
      boost: { title: 3, tagsText: 1 },
      prefix: true,
      fuzzy: 0.15,
      combineWith: 'AND',
    },
  })

  ms.addAll(products.map((p, i) => ({
    id: i,
    title: (p.title || '').toLowerCase(),
    tagsText: (p.tags || []).join(' ').toLowerCase(),
  })))

  return ms
}

export function searchProducts(query, products, index) {
  if (!query.trim() || !index) return []
  const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return []

  const results = index.search(words.join(' '))

  // Store fatigue: don't let one store dominate
  const storeCounts = new Map()
  const scored = results
    .filter(r => products[r.id]?.available !== false)
    .map(r => {
      const p = products[r.id]
      const store = p.store_name || ''
      const prior = storeCounts.get(store) || 0
      storeCounts.set(store, prior + 1)
      return { p, effective: r.score - (prior * 0.003 * r.score) }
    })

  scored.sort((a, b) => b.effective - a.effective)
  return scored.map(s => s.p)
}

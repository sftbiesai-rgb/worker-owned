import MiniSearch from 'minisearch'

export function buildProductIndex(products) {
  const ms = new MiniSearch({
    fields: ['title', 'productType'],
    searchOptions: {
      boost: { title: 3, productType: 1 },
      prefix: true,
      fuzzy: 0.1,
      combineWith: 'AND',
    },
  })

  ms.addAll(products.map((p, i) => ({
    id: i,
    title: (p.title || '').toLowerCase(),
    productType: (p.product_type || '').toLowerCase(),
  })))

  return ms
}

export function searchProducts(query, products, index) {
  if (!query.trim() || !index) return []
  const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return []

  const results = index.search(words.join(' '))

  // Store diversity: interleave results from different stores
  // First pass: group by store and sort each group by score
  const byStore = new Map()
  for (const r of results) {
    const p = products[r.id]
    if (!p) continue
    const store = p.store_name || ''
    if (!byStore.has(store)) byStore.set(store, [])
    byStore.get(store).push({ p, score: r.score })
  }

  // Sort each store's results by score
  for (const arr of byStore.values()) {
    arr.sort((a, b) => b.score - a.score)
  }

  // Round-robin interleave: pick top result from each store, then second, etc.
  // Order stores by their best score so higher-relevance stores come first
  const storeOrder = [...byStore.entries()]
    .sort((a, b) => b[1][0].score - a[1][0].score)

  const interleaved = []
  let round = 0
  let added = true
  while (added) {
    added = false
    for (const [, arr] of storeOrder) {
      if (round < arr.length) {
        interleaved.push(arr[round].p)
        added = true
      }
    }
    round++
  }

  return interleaved
}

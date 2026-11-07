import { productIndustry } from './categories.js'

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

export function displayTags(tags) {
  if (!tags?.length) return null
  return tags
    .map(t => t.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'"))
    .filter(t => t.length > 2 && t.length < 40 && !/^\d+$/.test(t) && !t.includes('_') && !/wholesale/i.test(t))
    .slice(0, 3)
}

// Hydrate the compact search.json format:
// [storeIdx, title, price, image, url, available?, typeId, tagIds]
// Many stores list each color as its own product with the same title, so
// same-title listings from one store collapse into one (tags merged, so the
// color refine still matches; an in-stock variant wins over a sold-out one).
export function hydrateProducts(data, { requireImage = true } = {}) {
  const stores = data.s
  const tagDict = data.t || []
  const typeDict = data.y || []
  const byKey = new Map()
  const out = []
  data.p.forEach((p, i) => {
    const store = stores[p[0]]
    const image = p[3] ? (store.ip || '') + p[3] : null
    if (requireImage && !image) return
    const tags = p[7] === 0 ? [] : (p[7] || []).map(id => tagDict[id])
    const product = {
      id: i, title: p[1], price: p[2] > 0 ? p[2] : null,
      image,
      url: (store.up || '') + p[4],
      store_name: store.n, store_url: store.u,
      store_industry: store.i,
      industry: productIndustry(p[1], store.i),
      product_type: typeof p[6] === 'number' ? (typeDict[p[6]] || '') : (p[6] || ''),
      tags, available: p[5] !== 0,
      ownership_types: store.t || [],
    }
    const key = p[0] + '|' + (p[1] || '').toLowerCase().trim()
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, out.length)
      out.push(product)
      return
    }
    const kept = out[existing]
    // Skip ID-like tags (CLOZTALK lists one copy per nonprofit, tagged
    // "Shoes_That_Fit" etc.) and cap the list so merged copies don't match everything
    const extra = tags.filter(t => !t.includes('_'))
    const mergedTags = [...new Set([...kept.tags, ...extra])].slice(0, 40)
    if (!kept.available && product.available) out[existing] = { ...product, tags: mergedTags }
    else kept.tags = mergedTags
  })
  // Search indexes by array position, so ids must match positions
  out.forEach((p, i) => { p.id = i })
  return out
}

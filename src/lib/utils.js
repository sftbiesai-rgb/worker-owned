export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function displayTags(tags) {
  if (!tags?.length) return null
  return tags
    .map(t => t.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .filter(t => t.length > 2 && t.length < 40 && !/^\d+$/.test(t) && !t.includes('_') && !/wholesale/i.test(t))
    .slice(0, 3)
}

export function thumbUrl(url, size = 300) {
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

export function faviconUrl(siteUrl) {
  if (!siteUrl) return null
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(siteUrl).hostname + '&sz=16' }
  catch { return null }
}

export function dedupeByUrl(entries) {
  const seen = new Map()
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (!seen.has(e.url)) seen.set(e.url, e)
  }
  return entries.filter(e => seen.get(e.url) === e)
}

export function interleaveByStore(products, perTurn = 2) {
  const groups = new Map()
  for (const p of products) {
    const key = p.store_name || p.store_url || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }
  // Sort queues: smallest stores first so they don't get buried
  const queues = [...groups.entries()]
    .sort((a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]))
    .map(([, v]) => v)
  const result = []
  let empty = false
  while (!empty) {
    empty = true
    for (const q of queues) {
      for (let i = 0; i < perTurn && q.length > 0; i++) {
        result.push(q.shift())
      }
      if (q.length > 0) empty = false
    }
  }
  return result
}

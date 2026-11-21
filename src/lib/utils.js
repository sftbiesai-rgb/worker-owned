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

// Bull Moose and Zia (FieldStack stores) pack titles as
// "Artist/Album@Format@extra", "Title/Actor/Actor@Format@Rating",
// "Author/Title@Subtitle" or "Platform/Game". Split that into a readable name,
// a byline (artist, author, cast) and a format for display. The stored title
// is left alone so search and format grouping keep working.
const PACKED_TITLE_STORES = new Set(['Bull Moose', 'Zia Records'])
const GAME_PLATFORM = /^(ps[1-5x]|ps one|playstation( \d| portable| vita)?|psp|ps vita|nintendo (switch( 2)?|ds|3ds|wii( u)?|64|gamecube)|switch( 2)?|wii( u)?|3ds|xbox( series x| one| 360)?( kinect)?|game ?boy( advance| color)?|gamecube|sega .*|dreamcast|genesis)$/i
const GAME_KIND = /^((dice|card|board|party|trivia) )?games?$|^puzzle$/i
const MOVIE_PART = /\b(season|series|collection|edition|volume|vol\.|part \d|animated|trilogy|saga|chapter|films of)\b/i
const BYLINE_PART = /^(studio ghibli|criterion collection|criterion)$/i
const DROP_EXTRA = /^(explicit( version)?|made on demand|this item is made on demand.*|nr|not rated|unrated|g|pg|pg-?13|r|nc-?17|e|e10\+|t|m|rp|\.|clr.*|ws|reissued?|import.*|incl\..*|\d{4}|b0\d+.*|set of \d+|[\w\s]+ discs?|bull moose (limited|exclusive).*|amaray)$/i

function formatLabel(extras, section) {
  const text = extras.join(' ')
  const labels = []
  if (/4k|uhd/i.test(text)) labels.push('4K UHD')
  else if (/blu-?y?-?ray/i.test(text)) labels.push('Blu-ray')
  else if (/\bdvd\b/i.test(text)) labels.push('DVD')
  if (/steelbook/i.test(text)) labels.push('Steelbook')
  if (/vinyl|\b\d?lp\b/i.test(text)) labels.push('Vinyl')
  else if (/\b\d?cd\b/i.test(text)) labels.push('CD')
  else if (/cassette/i.test(text)) labels.push('Cassette')
  if (/large print/i.test(text)) labels.push('Large print')
  if (/import/i.test(text) && section !== 'Books') labels.push('Import')
  return labels.join(' · ') || null
}

const titleCaseShouty = s => (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s))
  ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  : s

export function displayTitle(p) {
  const title = p.title || ''
  if (!PACKED_TITLE_STORES.has(p.store_name) || !/[/@]/.test(title)) return { name: title, byline: null, format: null }
  const [head, ...rest] = title.split('@').map(s => s.trim())
  const parts = head.split('/').map(s => s.trim()).filter(Boolean)
  const extras = rest.filter(Boolean)
  const format = formatLabel(extras, p.site_section)
  const leftover = extras.filter(e => !DROP_EXTRA.test(e) && !formatLabel([e], p.site_section))
  const same = (a, b) => a.toLowerCase() === b.toLowerCase() || (a.length >= 20 && b.toLowerCase().startsWith(a.toLowerCase().slice(0, 20)))
  let name, byline = null

  if (parts.length < 2) {
    name = parts[0] || title
  } else if (p.site_section === 'Music') {
    byline = titleCaseShouty(parts[0])
    name = parts.slice(1).join(' / ')
    if (same(byline, name)) byline = null
  } else if (p.site_section === 'Movies & TV') {
    name = parts[0]
    const cast = []
    for (const part of parts.slice(1)) {
      if (same(name, part)) continue
      if (BYLINE_PART.test(part)) byline = part
      else if (MOVIE_PART.test(part)) name += `: ${part}`
      else cast.push(titleCaseShouty(part))
    }
    if (cast.length) byline = cast.slice(0, 3).join(', ')
  } else if (p.site_section === 'Books') {
    byline = titleCaseShouty(parts[0])
    name = parts.slice(1).join(' / ')
  } else if (p.site_section === 'Games' && (GAME_PLATFORM.test(parts[0]) || GAME_KIND.test(parts[0]))) {
    name = parts.slice(1).join(' / ')
    return { name, byline: null, format: parts[0] }
  } else {
    name = parts.filter((part, i) => i === 0 || !same(parts[0], part)).join(' – ')
    return { name, byline: null, format: [format, ...leftover].filter(Boolean).join(' · ') || null }
  }
  return { name, byline, format }
}

// Some stores' scraped prices already include the currency symbol.
export const formatPrice = price => `$${String(price).replace(/^\$/, '')}`

// Stem a word: plurals, -ing, -ed, -er, -ly
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

function urlWords(url) {
  if (!url) return ''
  try {
    const path = new URL(url).pathname
    return path.replace(/[^a-z0-9]+/gi, ' ').toLowerCase()
  } catch { return '' }
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

export function searchProducts(inputValue, products) {
  if (!inputValue.trim()) return []

  const words = inputValue.toLowerCase().trim().replace(/['']/g, '').split(/\s+/).filter(Boolean)
  const wordStems = words.map(w => {
    const stems = stemWord(w)
    const syns = SYNONYMS[w]
    if (syns) for (const s of syns) stems.push(...stemWord(s))
    return [...new Set(stems)]
  })

  const queryLower = inputValue.toLowerCase().trim().replace(/['']/g, '')
  const scored = []
  for (const p of products) {
    let allMatch = true
    let score = 0
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
        const inTitleStripped = stems.some(s => { const idx = titleStripped.indexOf(s); return idx !== -1 && (idx === 0 || !/[a-z]/.test(titleStripped[idx - 1])) })
        score += inTitleStripped ? 3 : 1
        if (inTags) score += 2
      }
      else if (inStore && inTags) score += 2
      else if (inTags) score += 1
      else if (inSlug) score += 0.5
      else if (inStore) score += 0.5
    }
    if (allMatch && titleStripped.includes(queryLower)) score += 5
    if (allMatch && p.site_section) {
      const sectionLower = p.site_section.toLowerCase()
      if (words.some(w => sectionLower.includes(w))) score += 4
    }
    if (allMatch) {
      const ot = (p.ownership_type || '').toLowerCase()
      if (ot.includes('worker co-op') || ot === 'worker owned') score += 2
      else if (ot.includes('multi-stakeholder')) score += 1
    }
    if (allMatch) {
      const titleWords = titleStripped.trim().split(/\s+/).filter(Boolean)
      const matchCount = words.filter(w => titleStripped.includes(w)).length
      score += titleWords.length > 0 ? (matchCount / titleWords.length) : 0
    }
    if (allMatch && p.available === false) score -= 1
    if (allMatch && score < 1.5) score -= 2
    if (allMatch) scored.push({ p, score })
  }

  // Sort by score with store fatigue
  scored.sort((a, b) => b.score - a.score)
  const storeCounts = new Map()
  const FATIGUE = 0.3
  const withFatigue = scored.map(item => {
    const store = item.p.store_name || ''
    const prior = storeCounts.get(store) || 0
    storeCounts.set(store, prior + 1)
    return { ...item, effective: item.score - (prior * FATIGUE) }
  })
  withFatigue.sort((a, b) => b.effective - a.effective)
  return withFatigue.map(s => s.p)
}

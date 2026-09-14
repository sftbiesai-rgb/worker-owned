// Service worker: receives product info from content script,
// looks up category matches, sets badge, stores result for popup.

let categoryMap = null

const LIVE_MAP_URL = 'https://www.workerowned.info/data/category-map.json'
const CACHE_KEY = 'categoryMap'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

// Load category map: cached → live site → bundled fallback
async function loadCategoryMap() {
  if (categoryMap) return categoryMap

  // Try cached version first
  const cached = await chrome.storage.local.get(CACHE_KEY)
  if (cached[CACHE_KEY] && Date.now() - cached[CACHE_KEY].fetchedAt < CACHE_TTL) {
    categoryMap = cached[CACHE_KEY].data
    return categoryMap
  }

  // Fetch fresh from live site
  try {
    const resp = await fetch(LIVE_MAP_URL)
    if (resp.ok) {
      categoryMap = await resp.json()
      await chrome.storage.local.set({ [CACHE_KEY]: { data: categoryMap, fetchedAt: Date.now() } })
      return categoryMap
    }
  } catch {}

  // Use stale cache if available
  if (cached[CACHE_KEY]) {
    categoryMap = cached[CACHE_KEY].data
    return categoryMap
  }

  // Fall back to bundled copy
  const resp = await fetch(chrome.runtime.getURL('data/category-map.json'))
  categoryMap = await resp.json()
  return categoryMap
}

// Find matching WorkerOwned section from Amazon breadcrumb categories
function findSectionMatch(categories, map) {
  for (const cat of categories) {
    const slug = map.amazonCategories[cat]
    if (slug && map.sections[slug]) {
      return { slug, ...map.sections[slug] }
    }
    // Partial match: check if any Amazon category key is contained in this breadcrumb
    for (const [amazonCat, sectionSlug] of Object.entries(map.amazonCategories)) {
      if (cat.includes(amazonCat) || amazonCat.includes(cat)) {
        if (map.sections[sectionSlug]) {
          return { slug: sectionSlug, ...map.sections[sectionSlug] }
        }
      }
    }
  }
  return null
}

// Format count for badge: "1.2K" for thousands
function formatBadgeCount(n) {
  if (n >= 100000) return Math.round(n / 1000) + 'K'
  if (n >= 10000) return (n / 1000).toFixed(0) + 'K'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// Badge colors
const COLOR_ORANGE = '#E67E22' // category match
const COLOR_GREEN = '#27AE60'  // exact product match (Phase 2)
const COLOR_GRAY = '#95A5A6'   // no match

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'checkProduct') return

  const tabId = sender.tab?.id
  if (!tabId) return

  handleProductCheck(tabId, message)
})

async function handleProductCheck(tabId, { asin, title, categories, price }) {
  const map = await loadCategoryMap()

  // Check for cached result
  if (asin) {
    const cached = await getCached(asin)
    if (cached) {
      await setResult(tabId, cached)
      return
    }
  }

  // Find category-level match
  const sectionMatch = findSectionMatch(categories, map)

  const result = {
    asin,
    title,
    amazonPrice: price,
    amazonCategories: categories,
    matchType: sectionMatch ? 'category' : 'none',
    section: sectionMatch,
    productMatches: [], // Phase 2: filled by API
    timestamp: Date.now(),
  }

  // Cache by ASIN for 24 hours
  if (asin) {
    await setCached(asin, result)
  }

  await setResult(tabId, result)
}

async function setResult(tabId, result) {
  // Store result for popup to read
  await chrome.storage.local.set({ [`tab_${tabId}`]: result })

  if (result.matchType === 'product' && result.productMatches.length > 0) {
    // Green badge: exact product match (Phase 2)
    await chrome.action.setBadgeBackgroundColor({ tabId, color: COLOR_GREEN })
    await chrome.action.setBadgeText({ tabId, text: String(result.productMatches.length) })
  } else if (result.matchType === 'category' && result.section) {
    // Orange badge: category alternatives available
    await chrome.action.setBadgeBackgroundColor({ tabId, color: COLOR_ORANGE })
    await chrome.action.setBadgeText({ tabId, text: formatBadgeCount(result.section.count) })
  } else {
    // Gray badge: no match
    await chrome.action.setBadgeBackgroundColor({ tabId, color: COLOR_GRAY })
    await chrome.action.setBadgeText({ tabId, text: '' })
  }
}

// Simple cache with 24-hour TTL
async function getCached(asin) {
  const key = `cache_${asin}`
  const data = await chrome.storage.local.get(key)
  const entry = data[key]
  if (!entry) return null
  if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
    await chrome.storage.local.remove(key)
    return null
  }
  return entry
}

async function setCached(asin, result) {
  const key = `cache_${asin}`
  await chrome.storage.local.set({ [key]: result })
}

// Clear tab result when tab is closed or navigates away
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' })
  }
})

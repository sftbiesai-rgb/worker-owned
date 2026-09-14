// Content script for Amazon product pages.
// Extracts product info and sends it to the service worker for matching.

(function () {
  // Only run on product pages
  if (!location.pathname.includes('/dp/') && !location.pathname.includes('/gp/product/')) return

  function extractASIN() {
    // From URL: /dp/B08XYZ or /gp/product/B08XYZ
    const match = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
    if (match) return match[1]
    // Fallback: hidden input
    const input = document.querySelector('input[name="ASIN"]')
    return input ? input.value : null
  }

  function extractTitle() {
    const el = document.getElementById('productTitle') || document.querySelector('#title span')
    return el ? el.textContent.trim() : null
  }

  function extractCategory() {
    // Primary: breadcrumb links
    const breadcrumbs = document.getElementById('wayfinding-breadcrumbs_container')
    if (breadcrumbs) {
      const links = breadcrumbs.querySelectorAll('a')
      // Return all breadcrumb text for matching (first is the top-level category)
      return [...links].map(a => a.textContent.trim()).filter(Boolean)
    }
    // Fallback: look for category in the product details section
    const detailRows = document.querySelectorAll('#detailBulletsWrapper_feature_div li, #productDetails_detailBullets_sections1 tr')
    for (const row of detailRows) {
      const text = row.textContent
      if (text.includes('Best Sellers Rank') || text.includes('Department')) {
        const catMatch = text.match(/in\s+([A-Z][^()\n]+?)(?:\s*\(|$)/m)
        if (catMatch) return [catMatch[1].trim()]
      }
    }
    return []
  }

  function extractPrice() {
    const el = document.querySelector('span.a-price .a-offscreen')
    return el ? el.textContent.trim() : null
  }

  // Wait briefly for dynamic content to load
  setTimeout(() => {
    const asin = extractASIN()
    const title = extractTitle()
    const categories = extractCategory()
    const price = extractPrice()

    if (!title && !categories.length) return

    chrome.runtime.sendMessage({
      action: 'checkProduct',
      asin,
      title,
      categories,
      price,
    })
  }, 500)
})()

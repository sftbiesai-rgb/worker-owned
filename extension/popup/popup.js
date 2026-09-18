// Popup script: reads the current tab's match result and renders the UI.

const SITE = 'https://www.workerowned.info'

function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function renderCategoryMatch(result) {
  const s = result.section
  showState('state-category')

  document.getElementById('category-headline').textContent =
    `${s.label} from worker-owned stores`

  document.getElementById('category-subtitle').textContent =
    `${formatCount(s.count)} products from ${s.storeCount} worker & employee-owned ${s.storeCount === 1 ? 'store' : 'stores'}`

  // Render store pills
  const container = document.getElementById('category-stores')
  container.innerHTML = ''
  for (const store of s.stores) {
    const pill = document.createElement('a')
    pill.className = 'store-pill'
    pill.href = `${SITE}/${s.slug}`
    pill.target = '_blank'
    pill.innerHTML = `
      <span>${store.name}</span>
      <span class="ownership">${store.ownershipType}</span>
    `
    container.appendChild(pill)
  }

  document.getElementById('category-cta').href = `${SITE}/${s.slug}`
}

function renderProductMatch(result) {
  showState('state-product')

  const count = result.productMatches.length
  document.getElementById('product-headline').textContent =
    `Found at ${count === 1 ? 'a' : count} worker-owned ${count === 1 ? 'store' : 'stores'}!`

  document.getElementById('product-subtitle').textContent =
    `This product is available from worker & employee-owned businesses`

  // Render product cards
  const container = document.getElementById('product-cards')
  container.innerHTML = ''
  for (const match of result.productMatches.slice(0, 5)) {
    const card = document.createElement('a')
    card.className = 'product-card'
    card.href = match.url
    card.target = '_blank'

    const imgHtml = match.image
      ? `<img src="${match.image}" alt="">`
      : ''

    const priceHtml = match.price
      ? `<span class="price">$${match.price}</span>`
      : ''

    card.innerHTML = `
      ${imgHtml}
      <div class="info">
        <div class="title">${match.title}</div>
        <div class="meta">
          ${priceHtml}
          <span class="store">${match.store_name}</span>
          <span class="ownership">${match.ownership_type}</span>
        </div>
      </div>
    `
    container.appendChild(card)
  }

  if (result.section) {
    document.getElementById('product-cta').href = `${SITE}/${result.section.slug}`
    document.getElementById('product-cta').textContent = `Browse all ${result.section.label}`
  }
}

async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) {
    showState('state-idle')
    return
  }

  // Check if we're on an Amazon product page
  const isAmazonProduct = tab.url &&
    tab.url.includes('amazon.com') &&
    (tab.url.includes('/dp/') || tab.url.includes('/gp/product/'))

  if (!isAmazonProduct) {
    showState('state-idle')
    return
  }

  // Read stored result for this tab
  const key = `tab_${tab.id}`
  const data = await chrome.storage.local.get(key)
  const result = data[key]

  if (!result) {
    // Content script may not have run yet — show loading briefly then idle
    setTimeout(() => {
      showState('state-idle')
    }, 2000)
    return
  }

  if (result.matchType === 'product' && result.productMatches.length > 0) {
    renderProductMatch(result)
  } else if (result.matchType === 'category' && result.section) {
    renderCategoryMatch(result)
  } else {
    showState('state-none')
  }
}

init()

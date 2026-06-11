/* marketplace.js — client-side product search for yourfairshare.info/marketplace */

const BADGE_COLORS = {
  'worker co-op':            { bg: '#e8f5e9', color: '#2e7d32', label: 'Worker Co-op' },
  'worker co-op affiliated': { bg: '#e8f5e9', color: '#2e7d32', label: 'Worker Co-op' },
  'employee-owned':          { bg: '#e3f2fd', color: '#1565c0', label: 'Employee-Owned' },
  'esop':                    { bg: '#e3f2fd', color: '#1565c0', label: 'Employee-Owned' },
  'multi-stakeholder co-op': { bg: '#f3e5f5', color: '#6a1b9a', label: 'Multi-Stakeholder' },
  'cooperative farm':        { bg: '#fff8e1', color: '#e65100', label: 'Cooperative Farm' },
  'farmer co-op':            { bg: '#fff8e1', color: '#e65100', label: 'Farmer Co-op' },
  'farmer co-op stake':      { bg: '#fff8e1', color: '#e65100', label: 'Farmer Co-op' },
  'cooperative affiliated':  { bg: '#fce4ec', color: '#880e4f', label: 'Cooperative' },
  'artist co-op':            { bg: '#e8eaf6', color: '#283593', label: 'Artist Co-op' },
};

const SECTION_ORDER = [
  'All',
  'Coffee & Tea',
  'Food & Pantry',
  'Apparel',
  'Home Goods',
  'Art & Prints',
  'Personal Care',
  'Games',
  'Books & Publishing',
  'Beer & Brewing',
];

let allProducts = [];
let fuse = null;
let activeSection = 'All';
let currentQuery = '';
let currentPage = 0;
const PAGE_SIZE = 48;

function badgeFor(type) {
  const key = (type ?? '').toLowerCase().trim();
  const b = BADGE_COLORS[key] ?? { bg: '#f5f5f5', color: '#555', label: type ?? 'Co-op' };
  return `<span class="ownership-badge" style="background:${b.bg};color:${b.color};">${b.label}</span>`;
}

function formatPrice(price) {
  const n = parseFloat(price);
  if (isNaN(n)) return '';
  return '$' + n.toFixed(2).replace(/\.00$/, '');
}

function renderCard(p) {
  const price = formatPrice(p.price);
  const badge = badgeFor(p.ownership_type);
  const title = p.title.length > 60 ? p.title.slice(0, 58) + '...' : p.title;
  return `
    <a class="product-card" href="${p.url}" target="_blank" rel="noopener">
      <div class="product-img-wrap">
        <img class="product-img" src="${p.image}" alt="${p.title.replace(/"/g, '&quot;')}" loading="lazy"
             onerror="this.closest('.product-card').style.display='none'">
      </div>
      <div class="product-info">
        <div class="product-title">${title}</div>
        ${price ? `<div class="product-price">${price}</div>` : ''}
        <div class="product-store">${p.store_name}</div>
        ${badge}
      </div>
    </a>`;
}

function getFiltered() {
  let results;
  if (!currentQuery.trim()) {
    results = activeSection === 'All'
      ? allProducts
      : allProducts.filter(p => p.site_section === activeSection);
  } else {
    const raw = fuse ? fuse.search(currentQuery).map(r => r.item) : allProducts;
    results = activeSection === 'All' ? raw : raw.filter(p => p.site_section === activeSection);
  }
  return results;
}

function renderGrid(reset = true) {
  if (reset) currentPage = 0;
  const filtered = getFiltered();
  const total = filtered.length;
  const page = filtered.slice(0, (currentPage + 1) * PAGE_SIZE);

  document.getElementById('count-label').textContent =
    currentQuery ? `${total} result${total !== 1 ? 's' : ''} for "${currentQuery}"` : `${total} products`;

  document.getElementById('product-grid').innerHTML = page.map(renderCard).join('');

  const moreBtn = document.getElementById('load-more');
  if (page.length < total) {
    moreBtn.style.display = 'block';
    moreBtn.textContent = `Load more (${total - page.length} remaining)`;
  } else {
    moreBtn.style.display = 'none';
  }
}

function renderSectionTabs() {
  // Only show sections that have products
  const sectionsWithProducts = new Set(allProducts.map(p => p.site_section));
  const tabs = SECTION_ORDER.filter(s => s === 'All' || sectionsWithProducts.has(s));

  document.getElementById('section-tabs').innerHTML = tabs.map(s => `
    <button class="section-tab${s === activeSection ? ' active' : ''}" data-section="${s}">${s}</button>
  `).join('');

  document.querySelectorAll('.section-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSection = btn.dataset.section;
      document.querySelectorAll('.section-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });
}

async function init() {
  const q = new URLSearchParams(location.search).get('q') ?? '';
  document.getElementById('search-input').value = q;
  currentQuery = q;

  try {
    const res = await fetch('/data/products.json');
    if (!res.ok) throw new Error('Failed to load products');
    allProducts = await res.json();
  } catch (e) {
    document.getElementById('product-grid').innerHTML =
      '<p style="color:#c0392b;text-align:center;padding:40px;">Could not load products. Try again shortly.</p>';
    return;
  }

  if (typeof Fuse !== 'undefined') {
    fuse = new Fuse(allProducts, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'store_name', weight: 2 },
        { name: 'tags', weight: 1.5 },
        { name: 'site_section', weight: 1 },
        { name: 'ownership_type', weight: 0.5 },
      ],
      threshold: 0.35,
      includeScore: true,
    });
  }

  document.getElementById('loading').style.display = 'none';
  renderSectionTabs();
  renderGrid();

  const searchInput = document.getElementById('search-input');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentQuery = searchInput.value.trim();
      // Sync URL param
      const url = new URL(location);
      if (currentQuery) url.searchParams.set('q', currentQuery);
      else url.searchParams.delete('q');
      history.replaceState({}, '', url);
      renderGrid();
    }, 200);
  });

  document.getElementById('load-more').addEventListener('click', () => {
    currentPage++;
    renderGrid(false);
  });
}

document.addEventListener('DOMContentLoaded', init);

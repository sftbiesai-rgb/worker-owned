import { useState } from 'react'
import { faviconUrl } from '../lib/utils'

export default function FilterSidebar({
  products,
  activeCategory,
  activeStore,
  priceMin,
  priceMax,
  refine,
  onCategoryChange,
  onStoreChange,
  onPriceChange,
  onRefineChange,
  onClear,
}) {
  const [expanded, setExpanded] = useState(false)
  const [storeSearch, setStoreSearch] = useState('')

  // Derive category counts from products
  const categoryCounts = {}
  for (const p of products) {
    const sec = p.site_section || 'Other'
    categoryCounts[sec] = (categoryCounts[sec] || 0) + 1
  }
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])

  // Derive store counts from products (after category filter)
  const categoryFiltered = activeCategory
    ? products.filter(p => p.site_section === activeCategory)
    : products
  const storeCounts = {}
  const storeUrls = {}
  for (const p of categoryFiltered) {
    const name = p.store_name || 'Unknown'
    storeCounts[name] = (storeCounts[name] || 0) + 1
    if (p.store_url) storeUrls[name] = p.store_url
  }
  const stores = Object.entries(storeCounts)
    .sort((a, b) => b[1] - a[1])

  const filteredStores = storeSearch
    ? stores.filter(([name]) => name.toLowerCase().includes(storeSearch.toLowerCase()))
    : stores

  const hasFilters = activeCategory || activeStore || priceMin || priceMax || refine

  const filterContent = (
    <div className="space-y-4">
      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="text-xs text-[#003580] hover:text-[#9B0620] transition-colors font-medium"
        >
          Clear all filters
        </button>
      )}

      {/* Refine keyword filter */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Refine</h3>
        <input
          type="text"
          value={refine}
          onChange={e => onRefineChange(e.target.value)}
          placeholder='e.g. "red", "womens"…'
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-[#f5f5f7] focus:outline-none focus:border-[#003580] placeholder-gray-400"
        />
      </div>

      {/* Price filter */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Price</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={e => onPriceChange(e.target.value, priceMax)}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-[#f5f5f7] focus:outline-none focus:border-[#003580] placeholder-gray-400"
            min="0"
          />
          <input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={e => onPriceChange(priceMin, e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-[#f5f5f7] focus:outline-none focus:border-[#003580] placeholder-gray-400"
            min="0"
          />
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Category</h3>
          <div className="space-y-0.5">
            <button
              onClick={() => onCategoryChange('')}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                !activeCategory ? 'bg-[#003580] text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All ({products.length})
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat === activeCategory ? '' : cat)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  cat === activeCategory ? 'bg-[#003580] text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Store filter */}
      {stores.length > 1 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Store</h3>
          {stores.length > 8 && (
            <input
              type="text"
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              placeholder="Filter stores…"
              className="w-full mb-2 px-2 py-1 text-xs border border-gray-200 rounded bg-[#f5f5f7] focus:outline-none focus:border-[#003580] placeholder-gray-400"
            />
          )}
          <div className="space-y-0.5 max-h-96 overflow-y-auto">
            {activeStore && (
              <button
                onClick={() => onStoreChange('')}
                className="w-full text-left px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                All stores
              </button>
            )}
            {filteredStores.map(([name, count]) => (
              <button
                key={name}
                onClick={() => onStoreChange(name === activeStore ? '' : name)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                  name === activeStore ? 'bg-[#003580] text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {storeUrls[name] && <img src={faviconUrl(storeUrls[name])} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
                <span className="truncate">{name}</span>
                <span className="ml-auto shrink-0 opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden xl:block w-56 shrink-0">
        <div className="sticky top-4 bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Filters</h2>
          {filterContent}
        </div>
      </aside>

      {/* Mobile/tablet filter toggle */}
      <div className="xl:hidden mb-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 flex items-center justify-between"
        >
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Filters {hasFilters && <span className="text-[#003580]">Active</span>}
          </span>
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 mt-1">
            {filterContent}
          </div>
        )}
      </div>
    </>
  )
}

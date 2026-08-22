import { Link } from 'react-router-dom'
import { slugify, displayTags, faviconUrl } from '../lib/utils'
import OwnershipBadge from './OwnershipBadge'
import ProductImage from './ProductImage'

export default function ProductCard({ product: p, showStore = true, compact = false }) {
  if (compact) {
    return (
      <div className="bg-[#f5f5f7] rounded-xl overflow-hidden">
        <a href={p.url} target="_blank" rel="noopener" className="block hover:opacity-90 transition-opacity">
          {p.image && (
            <div className="h-24 w-full overflow-hidden bg-gray-100">
              <ProductImage src={p.image} alt={p.title} />
            </div>
          )}
          <div className="px-2.5 pt-1.5 pb-1">
            <p className="text-[11px] font-semibold text-gray-800 leading-snug truncate">{p.title} <span className="text-gray-400 font-normal">↗</span></p>
            {p.price && <p className="text-[11px] font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
          </div>
        </a>
        {p.store_name && (
          <div className="px-2.5 pb-1.5">
            <Link
              to={`/marketplace/store/${slugify(p.store_name)}`}
              className="text-[9px] text-gray-400 hover:text-[#004cb9] transition-colors truncate flex items-center gap-1"
            >
              {faviconUrl(p.store_url) && <img src={faviconUrl(p.store_url)} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
              {p.store_name}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-[#f5f5f7] rounded-xl overflow-hidden group">
      <a
        href={p.url}
        target="_blank"
        rel="noopener"
        className="block hover:opacity-90 transition-opacity"
      >
        {p.image && (
          <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
            <ProductImage src={p.image} alt={p.title} />
            {p.available === false && (
              <span className="absolute top-1.5 left-1.5 bg-gray-800/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold out</span>
            )}
          </div>
        )}
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title} <span className="text-gray-400 font-normal">↗</span></p>
          {p.price && <p className="text-xs font-semibold text-[#004cb9] mt-0.5">${p.price}</p>}
        </div>
      </a>
      {p.formats && p.formats.length > 1 && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {p.formats.map(f => (
            <a key={f.label} href={f.url} target="_blank" rel="noopener" className="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-[#004cb9] hover:border-[#004cb9] transition-colors">
              {f.label} ${f.price}
            </a>
          ))}
        </div>
      )}
      {displayTags(p.tags)?.length > 0 && !p.formats && (
        <div className="px-3 pb-1 hidden group-hover:block">
          <p className="text-[10px] text-gray-400 leading-snug line-clamp-1">{displayTags(p.tags).join(' · ')}</p>
        </div>
      )}
      {showStore && p.store_name && (
        <div className="px-3 pb-2">
          <Link
            to={`/marketplace/store/${slugify(p.store_name)}`}
            className="text-[10px] text-gray-400 hover:text-[#004cb9] transition-colors truncate flex items-center gap-1"
          >
            {faviconUrl(p.store_url) && <img src={faviconUrl(p.store_url)} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
            {p.store_name}
          </Link>
          {p.ownership_type && <div className="px-3 -mt-0.5"><OwnershipBadge type={p.ownership_type} size="xs" /></div>}
        </div>
      )}
    </div>
  )
}

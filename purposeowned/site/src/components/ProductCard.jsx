import { Link } from 'react-router-dom'
import { slugify, faviconUrl, displayTags } from '../lib/utils'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'bg-emerald-100 text-emerald-700', F: 'bg-blue-100 text-blue-700', P: 'bg-amber-100 text-amber-700', S: 'bg-purple-100 text-purple-700', '1': 'bg-rose-100 text-rose-700' }

export default function ProductCard({ product: p, showStore = true }) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl overflow-hidden group">
      <a
        href={p.url}
        target="_blank"
        rel="noopener"
        className="block hover:opacity-90 transition-opacity"
      >
        {p.image && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 relative">
            <img
              src={p.image}
              alt={p.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {p.available === false && (
              <span className="absolute top-1.5 left-1.5 bg-gray-800/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold out</span>
            )}
          </div>
        )}
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{p.title} <span className="text-gray-400 font-normal">&#8599;</span></p>
          {p.price && <p className="text-xs font-semibold text-[#1a6847] mt-0.5">${p.price}</p>}
        </div>
      </a>
      {showStore && p.store_name && (
        <div className="px-3 pb-2">
          <Link
            to={`/store/${slugify(p.store_name)}`}
            className="text-[10px] text-gray-400 hover:text-[#1a6847] transition-colors truncate flex items-center gap-1"
          >
            {faviconUrl(p.store_url) && <img src={faviconUrl(p.store_url)} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
            {p.store_name}
          </Link>
          {p.ownership_types?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {p.ownership_types.map(t => (
                <span key={t} className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[t] || 'bg-gray-100 text-gray-500'}`}>
                  {TYPE_LABELS[t] || t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

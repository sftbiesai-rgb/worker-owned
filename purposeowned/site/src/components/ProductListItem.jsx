import { Link } from 'react-router-dom'
import { slugify, faviconUrl } from '../lib/utils'

const TYPE_LABELS = { B: 'B Corp', F: 'Benefit Corp', P: 'Purpose Pledge', S: 'Steward-Owned', '1': '100% for Purpose' }
const TYPE_COLORS = { B: 'text-emerald-600', F: 'text-blue-600', P: 'text-amber-600', S: 'text-purple-600', '1': 'text-rose-600' }

export default function ProductListItem({ product: p }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      {p.image && (
        <a href={p.url} target="_blank" rel="noopener" className="shrink-0">
          <img
            src={p.image}
            alt=""
            className="w-20 h-20 rounded-lg object-cover bg-gray-100"
            loading="lazy"
          />
        </a>
      )}
      <div className="flex-1 min-w-0">
        <a href={p.url} target="_blank" rel="noopener" className="block">
          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{p.title}</p>
        </a>
        {p.price && <p className="text-sm font-semibold text-[#1a6847] mt-0.5">${p.price}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Link
            to={`/store/${slugify(p.store_name)}`}
            className="text-[11px] text-gray-400 hover:text-[#1a6847] transition-colors truncate flex items-center gap-1"
          >
            {faviconUrl(p.store_url) && <img src={faviconUrl(p.store_url)} alt="" className="w-3 h-3 shrink-0" loading="lazy" />}
            {p.store_name}
          </Link>
          {p.ownership_types?.length > 0 && (
            <span className={`text-[10px] font-medium ${TYPE_COLORS[p.ownership_types[0]] || 'text-gray-400'}`}>
              {TYPE_LABELS[p.ownership_types[0]]}
            </span>
          )}
        </div>
        {p.available === false && (
          <span className="text-[10px] text-gray-400 mt-0.5 inline-block">Sold out</span>
        )}
      </div>
    </div>
  )
}

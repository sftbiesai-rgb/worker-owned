import { Link } from 'react-router-dom'

export default function Breadcrumbs({ items }) {
  if (!items?.length) return null
  return (
    <nav className="text-xs text-gray-400 mb-3">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">›</span>}
          {i < items.length - 1 ? (
            <Link to={item.to} className="hover:text-[#004cb9] transition-colors">{item.label}</Link>
          ) : (
            <span className="text-gray-500">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

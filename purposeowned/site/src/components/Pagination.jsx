export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  const pages = []
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i)
  }
  return (
    <div className="flex justify-center items-center gap-1.5 mt-4 pt-3 border-t border-gray-100">
      {page > 1 && (
        <button onClick={() => onPageChange(page - 1)} className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#1a6847] transition-colors">&laquo; Prev</button>
      )}
      {pages[0] > 1 && <span className="text-xs text-gray-300">...</span>}
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${p === page ? 'bg-[#1a6847] text-white' : 'text-gray-500 hover:text-[#1a6847]'}`}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages && <span className="text-xs text-gray-300">...</span>}
      {page < totalPages && (
        <button onClick={() => onPageChange(page + 1)} className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#1a6847] transition-colors">Next &raquo;</button>
      )}
    </div>
  )
}

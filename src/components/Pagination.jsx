export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => { onPageChange(page - 1); window.scrollTo(0, 0) }}
        disabled={page === 1}
        className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#003580] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
      >
        ‹
      </button>
      <span className="text-xs text-gray-400 px-2">{page} / {totalPages}</span>
      <button
        onClick={() => { onPageChange(page + 1); window.scrollTo(0, 0) }}
        disabled={page === totalPages}
        className="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors bg-[#f5f5f7] text-gray-600 hover:text-[#003580] hover:bg-blue-50 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-[#f5f5f7]"
      >
        ›
      </button>
    </div>
  )
}

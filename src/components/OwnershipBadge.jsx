export default function OwnershipBadge({ type, size = 'sm' }) {
  if (!type) return null
  const clean = type.toLowerCase()
  let color = 'bg-gray-100 text-gray-500'
  if (clean.includes('worker co-op') || clean === 'worker owned') color = 'bg-blue-50 text-[#004cb9]'
  else if (clean.includes('esop') || clean.includes('employee')) color = 'bg-green-50 text-green-700'
  else if (clean.includes('multi-stakeholder') || clean.includes('consumer')) color = 'bg-purple-50 text-purple-700'
  const sizeClass = size === 'xs'
    ? 'text-[8px] px-1 py-px'
    : size === 'sm'
    ? 'text-[10px] px-2 py-0.5'
    : 'text-[9px] px-1.5 py-0.5'
  return (
    <span className={`font-semibold rounded-full shrink-0 ${sizeClass} ${color}`}>
      {type}
    </span>
  )
}

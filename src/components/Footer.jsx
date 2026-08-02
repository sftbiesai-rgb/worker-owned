export default function Footer({ showSources = false }) {
  return (
    <footer className="pb-6 pt-2 text-center">
      <p className="text-xs text-gray-400 mb-1">
        <a href="https://yourfairshare.info" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
          <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
          Your Fair Share
        </a>
      </p>
      {showSources && (
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      )}
    </footer>
  )
}

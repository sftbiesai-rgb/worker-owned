export default function Footer({ showSources = false }) {
  return (
    <footer className="pb-6 pt-2 text-center">
      {showSources && (
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener" className="hover:text-[#003580] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener" className="hover:text-[#003580] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener" className="hover:text-[#003580] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      )}
    </footer>
  )
}

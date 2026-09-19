import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="pb-6 pt-2 text-center space-y-1">
      <p className="text-xs text-gray-400">
        <Link to="/about" className="hover:text-[#1a6847] transition-colors">About & FAQ</Link>
        <span className="mx-1.5">·</span>
        <Link to="/contact" className="hover:text-[#1a6847] transition-colors">Contact</Link>
      </p>
      <p className="text-xs text-gray-400">
        Data from <a href="https://www.bcorporation.net/" target="_blank" rel="noopener" className="hover:text-[#1a6847] transition-colors">B Lab</a> and other public directories.
      </p>
    </footer>
  )
}

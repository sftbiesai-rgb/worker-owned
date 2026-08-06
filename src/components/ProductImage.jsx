import { useState } from 'react'
import { thumbUrl } from '../lib/utils'

export default function ProductImage({ src, alt }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
        Image unavailable
      </div>
    )
  }
  return <img src={thumbUrl(src)} alt={alt} className="w-full h-full object-cover" loading="lazy" onError={() => setError(true)} />
}

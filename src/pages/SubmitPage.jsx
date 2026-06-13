import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'

function SubmitPage() {
  useEffect(() => {
    document.title = 'Submit a Worker-Owned Business | Worker Owned'
  }, [])

  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('')
  const [formWebsite, setFormWebsite] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formMarketplace, setFormMarketplace] = useState(false)
  const [captchaA] = useState(Math.floor(Math.random() * 10) + 3)
  const [captchaB] = useState(Math.floor(Math.random() * 10) + 1)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (parseInt(captchaAnswer) !== captchaA + captchaB) {
      setFormError('Incorrect answer. Please try again.')
      return
    }
    if (!formName || !formEmail) {
      setFormError('Business name and email are required.')
      return
    }
    try {
      const res = await fetch('https://formspree.io/f/mjglzgwl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, category: formCategory, city: formCity, state: formState, website: formWebsite, email: formEmail, description: formDesc, marketplace_request: formMarketplace }),
      })
      if (!res.ok) {
        setFormError('Something went wrong. Please try again.')
        return
      }
    } catch (_) {
      setFormError('Something went wrong. Please try again.')
      return
    }
    setSubmitted(true)
    setFormError('')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo.png" alt="" width="36" height="36" className="shrink-0" />
            <Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Worker Owned</Link>
          </div>

          {submitted ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">&#10003;</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Submission received</h2>
              <p className="text-gray-500 text-sm mb-5">Thanks! We'll review it and add it to the directory.</p>
              <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">&larr; Back home</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors"
                  placeholder="e.g. Red Emma's" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white text-gray-700">
                  <option value="">Select a category...</option>
                  <option value="Coffee Shop">Coffee Shop</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Coffee & Tea (online)">Coffee & Tea (online)</option>
                  <option value="Media & Publishing">Media & Publishing</option>
                  <option value="Food & Pantry">Food & Pantry</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Art & Prints">Art & Prints</option>
                  <option value="Music">Music</option>
                  <option value="Home Goods">Home Goods</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Games">Games</option>
                  <option value="Beer & Brewing">Beer & Brewing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">City</label>
                  <input type="text" value={formCity} onChange={e => setFormCity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors"
                    placeholder="e.g. Baltimore" />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">State</label>
                  <input type="text" value={formState} onChange={e => setFormState(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors"
                    placeholder="MD" maxLength={2} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Website</label>
                <input type="text" value={formWebsite} onChange={e => setFormWebsite(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors"
                  placeholder="e.g. example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Email *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors"
                  placeholder="e.g. hello@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea rows={3} value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors resize-none"
                  placeholder="Anything else we should know..." />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formMarketplace}
                  onChange={e => setFormMarketplace(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#004cb9] shrink-0"
                />
                <span className="text-sm text-gray-700">
                  Request inclusion in the <strong>Market Place</strong> — we'll try to add this business to our online shopping directory
                </span>
              </label>
              <div className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Not a robot: what is {captchaA} + {captchaB}?</label>
                <input type="text" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
                  placeholder="Answer" />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <button type="submit"
                className="w-full bg-[#004cb9] text-white font-semibold py-3 rounded-lg text-sm hover:bg-[#003a8c] transition-colors flex items-center justify-center gap-2">
                <Send size={15} /> Submit
              </button>
            </form>
          )}
        </div>

        <div className="mt-3 text-center">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Back home
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400 mb-1">
          <a href="https://yourfairshare.info" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
            <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
            Your Fair Share
          </a>
        </p>
        <p className="text-xs text-gray-400">
          Sources: <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">USFWC</a>, <a href="https://institute.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">DAWI</a>, <a href="https://nycworker.coop" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">NYC NOWC</a>, regional co-op networks
        </p>
      </footer>
    </div>
  )
}

export default SubmitPage

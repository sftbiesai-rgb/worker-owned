import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'

const logoBlue = '#004cb9'

function SubmitPage() {
  const [formName, setFormName] = useState('')
  const [formWebsite, setFormWebsite] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [captchaA] = useState(Math.floor(Math.random() * 10) + 3)
  const [captchaB] = useState(Math.floor(Math.random() * 10) + 1)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (parseInt(captchaAnswer) !== captchaA + captchaB) {
      setFormError('Incorrect security answer. Please try again.')
      return
    }
    if (!formName || !formEmail) {
      setFormError('Name and email are required.')
      return
    }
    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, website: formWebsite, phone: formPhone, email: formEmail, description: formDesc }),
      })
    } catch (_) {}
    setSubmitted(true)
    setFormError('')
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
        <main className="flex-1 max-w-lg mx-auto w-full px-5 flex flex-col items-center justify-center text-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-14">
            <div className="text-4xl mb-3">&#10003;</div>
            <h1 className="text-2xl font-bold tracking-tight mb-2" style={{color: logoBlue}}>Submission Received</h1>
            <p className="text-gray-500 text-sm mb-6">Thanks for contributing! We'll review your submission and add it to the directory.</p>
            <Link to="/" className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">&larr; Back to home</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans">
      <header style={{backgroundColor: logoBlue}} className="text-white px-5 pt-8 pb-6">
        <div className="max-w-lg mx-auto">
          <Link to="/" className="text-sm text-blue-200 hover:text-white transition-colors">&larr; Back</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-3 tracking-tight">Submit a Business</h1>
          <p className="text-blue-200 text-xs sm:text-sm mt-1">Know a worker-owned spot? Let us know.</p>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-5 pb-16">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8 mt-5 text-left">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Business Name *</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors" placeholder="e.g. Red Emma's" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Website</label>
              <input type="url" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors" placeholder="e.g. https://example.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors" placeholder="e.g. (555) 123-4567" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Email *</label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors" placeholder="e.g. hello@example.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea rows={3} value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors resize-none" placeholder="Tell us about this business..." />
            </div>
            <div className="bg-[#f5f5f7] rounded-xl p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Not a robot: What is {captchaA} + {captchaB}?</label>
              <input type="text" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#004cb9] transition-colors" placeholder="Enter the answer" />
            </div>
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <button type="submit" className="w-full text-white font-semibold py-3 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={{backgroundColor: logoBlue}}>
              <Send size={16} /> Submit
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default SubmitPage
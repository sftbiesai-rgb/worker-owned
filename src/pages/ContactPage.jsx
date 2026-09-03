import { useState } from 'react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import Footer from '../components/Footer'

function ContactPage() {
  useEffect(() => {
    document.title = 'Contact | Worker Owned'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Get in touch with Worker Owned. General inquiries, de-listing requests, and feedback.')
    const canonical = 'https://www.workerowned.info/contact'
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
  }, [])

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formMessage, setFormMessage] = useState('')
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
    if (!formEmail || !formMessage) {
      setFormError('Email and message are required.')
      return
    }
    try {
      const res = await fetch('https://formspree.io/f/mjglzgwl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, email: formEmail, message: formMessage, form_type: 'general_inquiry' }),
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
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">General Inquiries</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            Questions, feedback, or de-listing requests.
          </p>

          {submitted ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">&#10003;</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Message received</h2>
              <p className="text-gray-500 text-sm mb-5">Thanks! We'll get back to you soon.</p>
              <Link to="/" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">&larr; Back home</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#003580] transition-colors"
                  placeholder="Your name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#003580] transition-colors"
                  placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message *</label>
                <textarea rows={5} value={formMessage} onChange={e => setFormMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#003580] transition-colors resize-none"
                  placeholder="How can we help?" />
              </div>
              <div className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Not a robot: what is {captchaA} + {captchaB}?</label>
                <input type="text" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#003580] transition-colors bg-white"
                  placeholder="Answer" />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <button type="submit"
                className="w-full bg-[#003580] text-white font-semibold py-3 rounded-lg text-sm hover:bg-[#002660] transition-colors flex items-center justify-center gap-2">
                <Send size={15} /> Send
              </button>
            </form>
          )}
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            &larr; Back home
          </Link>
          <Link to="/faq" className="text-sm text-[#003580] hover:text-[#9B0620] transition-colors font-medium">
            FAQ &rarr;
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ContactPage

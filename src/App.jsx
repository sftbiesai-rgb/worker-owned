import { useState } from 'react'
import { MapPin, ExternalLink, Search, Send } from 'lucide-react'
import shopsData from './data/shops.json'

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('coffee')
  const [view, setView] = useState('home')

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

  const logoBlue = '#004cb9'
  const logoRed = '#BF0A30'

  const filteredShops = shopsData
    .filter(shop => shop.category === category)
    .filter(shop =>
      shop.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.state.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

  const categoryCount = (cat) => shopsData.filter(s => s.category === cat).length

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

  const resetForm = () => {
    setFormName(''); setFormWebsite(''); setFormPhone(''); setFormEmail(''); setFormDesc(''); setCaptchaAnswer(''); setSubmitted(false); setFormError('')
  }

  if (view === 'browse') {
    const browseShops = shopsData
      .filter(shop => shop.category === category)
      .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city))

    return (
      <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans">
        <header style={{backgroundColor: logoBlue}} className="text-white px-5 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => { setView('home'); setSearchTerm('') }} className="text-sm text-blue-200 hover:text-white transition-colors">&larr; Back</button>
            <h1 className="text-2xl sm:text-3xl font-bold mt-3 tracking-tight">All Worker-Owned {category === 'coffee' ? 'Coffee Shops' : 'Restaurants'}</h1>
            <p className="text-blue-200 text-xs sm:text-sm mt-1">{categoryCount(category)} businesses across the US</p>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-5 pb-16">
          <div className="space-y-3 mt-5">
            {browseShops.map(shop => (
              <div key={shop.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm sm:text-base truncate">{shop.name}</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{shop.city}, {shop.state}</span>
                  </div>
                </div>
                {shop.website && (
                  <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#BF0A30] transition-colors shrink-0 ml-3 p-1">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (view === 'submit') {
    if (submitted) {
      return (
        <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
          <main className="flex-1 max-w-lg mx-auto w-full px-5 flex flex-col items-center justify-center text-center">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-14">
              <div className="text-4xl mb-3">&#10003;</div>
              <h1 className="text-2xl font-bold tracking-tight mb-2" style={{color: logoBlue}}>Submission Received</h1>
              <p className="text-gray-500 text-sm mb-6">Thanks for contributing! We'll review your submission and add it to the directory.</p>
              <button onClick={() => { setView('home'); resetForm() }} className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">&larr; Back to home</button>
            </div>
          </main>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans">
        <header style={{backgroundColor: logoBlue}} className="text-white px-5 pt-8 pb-6">
          <div className="max-w-lg mx-auto">
            <button onClick={() => setView('home')} className="text-sm text-blue-200 hover:text-white transition-colors">&larr; Back</button>
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-10 sm:py-14 mt-8 sm:mt-0">
          <div className="flex items-center justify-center mb-3">
            <img src="/logo.png" alt="WorkerOwned" width="52" height="52" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            <span style={{color: logoRed}}>Worker</span><span style={{color: logoBlue}}>Owned</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mb-6">Worker-owned coffee shops & restaurants across the US</p>

          <div className="w-full flex flex-col sm:flex-row gap-2 mb-4">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSearchTerm('') }}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white text-gray-700"
            >
              <option value="coffee">Coffee Shops ({categoryCount('coffee')})</option>
              <option value="restaurant">Restaurants ({categoryCount('restaurant')})</option>
            </select>
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by city, state, or name"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#004cb9] transition-colors bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {!searchTerm && (
            <button onClick={() => setView('browse')} className="text-sm text-blue-600 hover:text-[#BF0A30] transition-colors font-medium">
              Browse all {categoryCount(category)} {category === 'coffee' ? 'coffee shops' : 'restaurants'} &rarr;
            </button>
          )}

          {searchTerm && (
            <div className="w-full mt-4 text-left">
              {filteredShops.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">{filteredShops.length} result{filteredShops.length !== 1 ? 's' : ''}</p>
                  {filteredShops.map(shop => (
                    <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{shop.name}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{shop.location}</div>
                      </div>
                      {shop.website && (
                        <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#BF0A30] transition-colors shrink-0 ml-3 p-1">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">No businesses found. Try a different search.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center space-y-2">
        <p className="text-xs text-gray-400">
          <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004cb9] transition-colors">Data via USFWC</a>
        </p>
        <button onClick={() => setView('submit')} className="text-xs text-gray-400 hover:text-[#004cb9] transition-colors">
          Submit a worker-owned coffee shop or restaurant &rarr;
        </button>
      </footer>
    </div>
  )
}

export default App
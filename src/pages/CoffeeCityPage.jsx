import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import shopsData from '../data/shops.json'

const CITY_CONFIGS = {
  'berkeley-ca': { city: 'Berkeley', state: 'CA', label: 'Berkeley, CA' },
  'san-francisco-ca': { city: 'San Francisco', state: 'CA', label: 'San Francisco, CA' },
  'baltimore-md': { city: 'Baltimore', state: 'MD', label: 'Baltimore, MD' },
  'oakland-ca': { city: 'Oakland', state: 'CA', label: 'Oakland, CA' },
  'minneapolis-mn': { city: 'Minneapolis', state: 'MN', label: 'Minneapolis, MN' },
  'portland-or': { city: 'Portland', state: 'OR', label: 'Portland, OR' },
  'spokane-wa': { city: 'Spokane', state: 'WA', label: 'Spokane, WA' },
  'brooklyn-ny': { city: 'Brooklyn', state: 'NY', label: 'Brooklyn, NY' },
  'seattle-wa': { city: 'Seattle', state: 'WA', label: 'Seattle, WA' },
  'washington-dc': { city: 'Washington', state: 'DC', label: 'Washington, DC' },
}

function CoffeeCityPage() {
  const { city } = useParams()
  const config = CITY_CONFIGS[city]

  const shops = config
    ? shopsData.filter(s => s.city === config.city && s.state === config.state && s.category === 'coffee')
    : []

  useEffect(() => {
    if (config) {
      document.title = `Worker-Owned Coffee Shops in ${config.label} | Worker Owned`
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        `Find ${shops.length} worker-owned coffee shops, cafes, and bakeries in ${config.label}. Support cooperatively owned businesses near you.`)
    }
  }, [config, shops.length])

  if (!config) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col items-center justify-center">
        <p className="text-gray-500">City not found.</p>
        <Link to="/coffee" className="mt-2 text-sm text-[#004cb9]">&larr; All coffee shops</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Worker-Owned Coffee in {config.label}</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            {shops.length} cooperatively owned coffee shop{shops.length !== 1 ? 's' : ''} in {config.city}
          </p>

          <div className="space-y-3">
            {shops.map(shop => {
              const url = shop.website?.startsWith('http') ? shop.website : `https://${shop.website}`
              return (
                <div key={shop.id} className="bg-[#f5f5f7] rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-sm text-gray-900">{shop.name}</h2>
                      {shop.location && (
                        <p className="text-xs text-gray-500 mt-0.5">{shop.location}</p>
                      )}
                    </div>
                    {shop.website && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-[#004cb9] hover:text-[#003a8c] font-medium shrink-0"
                      >
                        Visit &rarr;
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-100 pt-5 mt-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">Why visit worker-owned coffee shops?</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              At a worker-owned cafe, the baristas are the owners. They share in the profits and have a say in how the shop runs. These are community-rooted businesses where your money stays local.
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/coffee" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; All coffee shops
          </Link>
          <Link to="/guides/what-is-a-worker-cooperative" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            What is a co-op? &rarr;
          </Link>
        </div>
      </main>

      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs text-gray-400 mb-1">
          <a href="https://yourfairshare.info" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-[#004cb9] transition-colors">
            <img src="/logo-yourfairshare.png" alt="" className="h-3 w-3 inline" />
            Your Fair Share
          </a>
        </p>
      </footer>
    </div>
  )
}

export default CoffeeCityPage

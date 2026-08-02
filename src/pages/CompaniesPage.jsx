import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import marketplaceData from '../data/marketplace.json'
import { slugify, faviconUrl, dedupeByUrl } from '../lib/utils'
import { SECTIONS } from '../lib/categories'
import OwnershipBadge from '../components/OwnershipBadge'
import Footer from '../components/Footer'
import Breadcrumbs from '../components/Breadcrumbs'

const allStores = dedupeByUrl(marketplaceData)

function CompaniesPage() {
  useEffect(() => {
    document.title = 'All Worker and Employee Owned Companies | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Browse all worker and employee owned companies in the Worker Owned marketplace directory, sorted by category.')
    const canonical = 'https://www.workerowned.info/marketplace/companies'
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <Breadcrumbs items={[
          { label: 'Marketplace', to: '/marketplace' },
          { label: 'All Companies' },
        ]} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1><Link to="/" className="text-2xl font-bold tracking-tight text-gray-900">Worker and Employee Owned Companies</Link></h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            {allStores.length} companies across {SECTIONS.length} categories
          </p>

          {SECTIONS.map(section => {
            const stores = allStores
              .filter(s => s.site_section === section.sectionName)
              .sort((a, b) => a.name.localeCompare(b.name))
            if (stores.length === 0) return null
            return (
              <div key={section.slug} className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{section.sectionName}</h2>
                <div className="space-y-1.5">
                  {stores.map(store => (
                    <div key={store.id} className="bg-[#f5f5f7] rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/marketplace/store/${slugify(store.name)}`}
                          className="font-semibold text-sm text-[#004cb9] hover:text-[#003a8c] transition-colors truncate flex items-center gap-1.5"
                        >
                          {faviconUrl(store.url) && <img src={faviconUrl(store.url)} alt="" className="w-4 h-4 shrink-0" loading="lazy" />}
                          {store.name}
                        </Link>
                        <OwnershipBadge type={store.ownership_type} size="compact" />
                      </div>
                      {store.notes && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{store.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search
          </Link>
          <Link to="/submit" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Submit a business &rarr;
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default CompaniesPage

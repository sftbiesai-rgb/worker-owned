import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

function FAQPage() {
  useEffect(() => {
    document.title = 'FAQ | Worker Owned'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Frequently asked questions about Worker Owned, a searchable marketplace for worker and employee owned businesses.')
    const canonical = 'https://www.workerowned.info/faq'
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">FAQ</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-8">
            Frequently asked questions about Worker Owned.
          </p>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">What is Worker Owned?</h2>
              <p>
                Worker Owned is a searchable marketplace for products sold by worker and employee owned businesses. You can browse products across categories like coffee, food, apparel, and more, and buy directly from the companies that make them.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">What types of businesses do you include?</h2>
              <p>
                We include businesses where the workers or employees have meaningful ownership. This includes:
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li><strong>Worker cooperatives</strong> - businesses owned and democratically governed by the workers</li>
                <li><strong>ESOPs</strong> - companies where employees own more than 50% through an Employee Stock Ownership Plan</li>
                <li><strong>Employee-owned companies</strong> - other structures where employees hold significant ownership</li>
                <li><strong>Multi-stakeholder cooperatives</strong> - co-ops with worker-members alongside other stakeholder groups</li>
              </ul>
              <p className="mt-2">
                We do not include consumer cooperatives (like REI), investor-owned companies, or businesses where employee ownership is token or nominal.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">How do you decide what to list?</h2>
              <p>
                We research businesses using public sources including the <a href="https://www.usworker.coop/directory/" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c]">US Federation of Worker Cooperatives directory</a>, the <a href="https://institute.coop" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c]">Democracy at Work Institute</a>, regional cooperative networks, and direct submissions. We verify ownership structure before adding a business.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">How can I submit a business?</h2>
              <p>
                Use our <Link to="/submit" className="text-[#004cb9] hover:text-[#003a8c] font-medium">submission form</Link> to suggest a worker or employee owned business for inclusion. We review every submission.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Do you sell products directly?</h2>
              <p>
                No. Worker Owned is a directory and search engine. When you find a product, we link you directly to the company's own website to make your purchase. We don't process orders, handle shipping, or take a cut.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Where do product images and descriptions come from?</h2>
              <p>
                Product information, including images and descriptions, comes from the businesses' own websites. We display this information to help you find and identify products, and we always link back to the original source. This is the same approach used by any product search engine or shopping directory.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">I want my company or products de-listed.</h2>
              <p>
                No problem. Use our <Link to="/contact" className="text-[#004cb9] hover:text-[#003a8c] font-medium">general inquiries form</Link> and we'll take care of it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">I have another question.</h2>
              <p>
                For anything else, reach out through our <Link to="/contact" className="text-[#004cb9] hover:text-[#003a8c] font-medium">general inquiries form</Link>.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Back home
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

export default FAQPage

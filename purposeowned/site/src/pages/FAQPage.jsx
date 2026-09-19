import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../lib/categories'
import Footer from '../components/Footer'

export default function FAQPage() {
  useEffect(() => {
    document.title = 'About & FAQ — Purpose Owned'
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-2">About Purpose Owned</h1>
          <p className="text-center text-sm text-gray-500 mb-8">
            A searchable marketplace and directory of purpose-driven businesses.
          </p>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">What is Purpose Owned?</h2>
              <p>
                Purpose Owned is a searchable marketplace of products from businesses that have made a verifiable commitment to a mission beyond profit. You can search thousands of products across categories, filter by ownership type, and buy directly from the companies that make them. It's also a directory of purpose-driven companies, including those that don't sell products online.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">What types of businesses are included?</h2>
              <p>We include companies with verified commitments to purpose, specifically:</p>
              <ul className="mt-2 space-y-1.5 list-disc list-inside">
                <li><strong>Certified B Corporations</strong> — companies certified by <a href="https://www.bcorporation.net/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">B Lab</a> for meeting rigorous standards of social and environmental performance, accountability, and transparency</li>
                <li><strong>Benefit Corporations</strong> — companies legally structured as benefit corporations under state law, listed in the <a href="https://www.domoregood.com/benefit-corporation-directory" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">DoMoreGood directory</a></li>
                <li><strong>Purpose Pledge</strong> — companies that have signed the <a href="https://www.purposepledge.org/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">Purpose Pledge</a></li>
                <li><strong>Steward-Owned</strong> — companies structured under <a href="https://purpose-economy.org/en/companies/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">steward ownership</a> principles</li>
                <li><strong>100% for Purpose</strong> — members of <a href="https://100forpurpose.org/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">100% for Purpose</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Where does the data come from?</h2>
              <p>Company information comes from the following public directories and databases:</p>
              <ul className="mt-2 space-y-1.5 list-disc list-inside">
                <li><a href="https://www.bcorporation.net/en-us/find-a-b-corp/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">B Lab's B Corp Directory</a> — 3,400+ US-headquartered certified B Corps</li>
                <li><a href="https://www.domoregood.com/benefit-corporation-directory" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">DoMoreGood Benefit Corporation Directory</a> — 2,000+ benefit corporations in good standing</li>
                <li><a href="https://www.purposepledge.org/companies" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">Purpose Pledge</a></li>
                <li><a href="https://purpose-economy.org/en/companies/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">Purpose Economy (steward ownership)</a></li>
                <li><a href="https://100forpurpose.org/" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">100% for Purpose</a></li>
              </ul>
              <p className="mt-2">
                Product data (images, titles, prices) comes from the companies' own websites. We always link back to the original source.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Browse the directory</h2>
              <p className="mb-2">Browse purpose-owned companies by category:</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <Link key={c.slug} to={`/${c.slug}/directory`}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f5f5f7] text-gray-600 hover:text-[#1a6847] hover:bg-emerald-50 transition-colors">
                    {c.label}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Do you sell products directly?</h2>
              <p>
                No. Purpose Owned is a directory and search engine. When you find a product, we link you directly to the company's own website. We don't process orders, handle shipping, or earn a commission.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">How is this different from workerowned.info?</h2>
              <p>
                <a href="https://www.workerowned.info" target="_blank" rel="noopener" className="text-[#1a6847] hover:text-[#145236]">Worker Owned</a> focuses specifically on worker cooperatives, ESOPs, and employee-owned companies. Purpose Owned casts a wider net to include any company with a verified commitment to purpose beyond profit, including B Corps and benefit corporations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">I want my company or products de-listed.</h2>
              <p>
                No problem. Use our <Link to="/contact" className="text-[#1a6847] hover:text-[#145236] font-medium">contact form</Link> and we'll take care of it promptly.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <Link to="/" className="text-sm text-[#1a6847] hover:text-[#145236] transition-colors font-medium">
            &larr; Back home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

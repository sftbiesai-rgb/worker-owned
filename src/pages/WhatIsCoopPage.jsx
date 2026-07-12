import { useEffect } from 'react'
import { Link } from 'react-router-dom'

function WhatIsCoopPage() {
  useEffect(() => {
    document.title = 'What Is a Worker Cooperative? | Worker Owned Marketplace'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'A worker cooperative is a business owned and governed by the people who work there. Learn how co-ops work, how they differ from traditional companies, and where to find them.')
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 font-sans flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full px-6 py-8">

          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-marketplace.png" alt="" width="48" height="48" className="shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">What Is a Worker Cooperative?</h1>
          </div>
          <p className="text-center text-sm text-gray-500 mb-8">
            A business owned and run by the people who work there.
          </p>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">The short version</h2>
              <p>
                A worker cooperative is a business where the workers are the owners. They share profits, make decisions together, and each get one vote regardless of seniority or role. The people doing the work control the business.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">How is that different from a normal company?</h2>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#f5f5f7]">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500"></th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Traditional Company</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#004cb9]">Worker Co-op</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-3 py-2 font-medium">Who owns it?</td>
                      <td className="px-3 py-2">Shareholders or a founder</td>
                      <td className="px-3 py-2">The workers</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Who gets profits?</td>
                      <td className="px-3 py-2">Shareholders</td>
                      <td className="px-3 py-2">The workers, split equitably</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Who makes decisions?</td>
                      <td className="px-3 py-2">CEO/board</td>
                      <td className="px-3 py-2">Workers vote (one person, one vote)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Accountability?</td>
                      <td className="px-3 py-2">Top-down</td>
                      <td className="px-3 py-2">Peer-based</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">What about ESOPs?</h2>
              <p>
                An ESOP (Employee Stock Ownership Plan) is different from a worker co-op. In an ESOP, employees own shares of the company through a trust, but management structure is usually traditional. Companies like King Arthur Baking and Bob's Red Mill are ESOPs. Workers benefit financially but don't necessarily have democratic control over decisions.
              </p>
              <p className="mt-2">
                Both models are better for workers than conventional ownership. This directory includes both.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Are there real examples?</h2>
              <p>There are hundreds of worker cooperatives in the US. Here are a few you can buy from today:</p>
              <ul className="mt-2 space-y-1.5">
                <li><strong>Equal Exchange</strong> - Fair-trade coffee, tea, and chocolate. Worker-owned since 1986.</li>
                <li><strong>Alvarado Street Bakery</strong> - Organic sprouted grain bread. Worker-owned since 1977.</li>
                <li><strong>Defector</strong> - Sports and culture journalism. Worker-owned since 2020.</li>
                <li><strong>Cooperative Coffee Roasters</strong> - Small-batch coffee from Asheville, NC.</li>
                <li><strong>AK Press</strong> - Independent books and publishing. Worker-owned since 1990.</li>
              </ul>
              <Link to="/marketplace/companies" className="inline-block mt-2 text-[#004cb9] hover:text-[#003a8c] font-medium text-xs">
                Browse all 60+ worker-owned companies &rarr;
              </Link>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">How do I start one?</h2>
              <p>These organizations help people start worker cooperatives:</p>
              <ul className="mt-2 space-y-1">
                <li><a href="https://usworker.coop" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c]">US Federation of Worker Cooperatives</a> - National federation, resources and networking</li>
                <li><a href="https://institute.coop" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c]">Democracy at Work Institute</a> - Training, technical assistance, research</li>
                <li><a href="https://cooperationworks.coop" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c]">CooperationWorks!</a> - Network of cooperative development centers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">Why does this matter?</h2>
              <p>
                In a worker co-op, profits stay with the people who created them. It's a simple idea: the people who do the work share in what the business earns.
              </p>
              <p className="mt-2">
                Curious how much profit your employer keeps?{' '}
                <a href="https://yourfairshare.info" target="_blank" rel="noopener" className="text-[#004cb9] hover:text-[#003a8c] font-medium">
                  Check your fair share &rarr;
                </a>
              </p>
            </section>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-4">
          <Link to="/" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            &larr; Search all products
          </Link>
          <Link to="/guides/alternatives" className="text-sm text-[#004cb9] hover:text-[#BF0A30] transition-colors font-medium">
            Worker-owned alternatives &rarr;
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

export default WhatIsCoopPage

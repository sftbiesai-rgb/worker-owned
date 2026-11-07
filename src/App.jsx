import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import BrowsePage from './pages/BrowsePage.jsx'
import BarsPage from './pages/BarsPage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'
import MarketplacePage from './pages/MarketplacePage.jsx'
import MarketplaceIndexPage from './pages/MarketplaceIndexPage.jsx'
import StoreDetailPage from './pages/StoreDetailPage.jsx'
import StoreProductsPage from './pages/StoreProductsPage.jsx'
import CompaniesPage from './pages/CompaniesPage.jsx'
import CategoryDirectoryPage from './pages/CategoryDirectoryPage.jsx'
import AlternativesPage from './pages/AlternativesPage.jsx'
import WhatIsCoopPage from './pages/WhatIsCoopPage.jsx'
import CoffeeCityPage from './pages/CoffeeCityPage.jsx'
import FAQPage from './pages/FAQPage.jsx'
import ContactPage from './pages/ContactPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketplaceIndexPage />} />
      <Route path="/coffee" element={<BrowsePage category="coffee" />} />
      <Route path="/restaurants" element={<BrowsePage category="restaurant" />} />
      <Route path="/bars" element={<BarsPage />} />
      <Route path="/grocery" element={<BrowsePage category="grocery" />} />
      <Route path="/browse" element={<Navigate to="/coffee" replace />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/guides/alternatives" element={<AlternativesPage />} />
      <Route path="/guides/what-is-a-worker-cooperative" element={<WhatIsCoopPage />} />
      <Route path="/guides/worker-owned-coffee/:city" element={<CoffeeCityPage />} />
      <Route path="/companies" element={<CompaniesPage />} />
      <Route path="/store/:store" element={<StoreDetailPage />} />
      <Route path="/store/:store/:section" element={<StoreProductsPage />} />
      {/* Backwards compat: redirect old /marketplace URLs */}
      <Route path="/marketplace" element={<Navigate to="/" replace />} />
      <Route path="/marketplace/*" element={<Navigate to="/" replace />} />
      {/* Catch-all category routes must come AFTER all named routes */}
      <Route path="/:category/directory" element={<CategoryDirectoryPage />} />
      <Route path="/:category/:subcategory" element={<MarketplacePage />} />
      <Route path="/:category" element={<MarketplacePage />} />
    </Routes>
  )
}

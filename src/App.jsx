import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import BrowsePage from './pages/BrowsePage.jsx'
import BarsPage from './pages/BarsPage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'
import MarketplacePage from './pages/MarketplacePage.jsx'
import MarketplaceIndexPage from './pages/MarketplaceIndexPage.jsx'
import StoreDetailPage from './pages/StoreDetailPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/marketplace" replace />} />
      <Route path="/coffee" element={<BrowsePage category="coffee" />} />
      <Route path="/restaurants" element={<BrowsePage category="restaurant" />} />
      <Route path="/bars" element={<BarsPage />} />
      <Route path="/browse" element={<Navigate to="/coffee" replace />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/marketplace" element={<MarketplaceIndexPage />} />
      <Route path="/marketplace/store/:store" element={<StoreDetailPage />} />
      <Route path="/marketplace/:category/:subcategory" element={<MarketplacePage />} />
      <Route path="/marketplace/:category" element={<MarketplacePage />} />
    </Routes>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import StorePage from './pages/StorePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import CategoryDirectoryPage from './pages/CategoryDirectoryPage.jsx'
import FAQPage from './pages/FAQPage.jsx'
import ContactPage from './pages/ContactPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<FAQPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/store/:store" element={<StorePage />} />
      <Route path="/:category/directory" element={<CategoryDirectoryPage />} />
      <Route path="/:category" element={<CategoryPage />} />
    </Routes>
  )
}

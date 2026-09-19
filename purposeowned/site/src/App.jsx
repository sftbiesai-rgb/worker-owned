import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import StorePage from './pages/StorePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/store/:store" element={<StorePage />} />
      <Route path="/:category" element={<CategoryPage />} />
    </Routes>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import HomePage from './pages/HomePage.jsx'
import BrowsePage from './pages/BrowsePage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/coffee" element={<BrowsePage category="coffee" />} />
        <Route path="/restaurants" element={<BrowsePage category="restaurant" />} />
        <Route path="/browse" element={<Navigate to="/coffee" replace />} />
        <Route path="/submit" element={<SubmitPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
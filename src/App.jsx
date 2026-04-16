import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './components/Sidebar'
import CheckIn from './components/CheckIn'
import MissionBrief from './components/MissionBrief'
import WarRoom from './components/WarRoom'
import Dashboard from './components/Dashboard'
import History from './components/History'
import Settings from './components/Settings'

const MOBILE_BREAKPOINT = 900

function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

export default function App() {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(isMobileViewport)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(isMobileViewport())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [location.pathname, isMobile])

  useEffect(() => {
    document.body.style.overflow = isMobile && isSidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, isSidebarOpen])

  return (
    <div className="app-layout">
      {isMobile ? (
        <>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setIsSidebarOpen(open => !open)}
            aria-expanded={isSidebarOpen}
            aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {isSidebarOpen ? (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="Close navigation menu"
              onClick={() => setIsSidebarOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      <Sidebar
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/checkin" replace />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/mission" element={<MissionBrief />} />
          <Route path="/warroom" element={<WarRoom />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

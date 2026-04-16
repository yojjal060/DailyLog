import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { 
  Crosshair, Radar, Swords, LayoutDashboard, 
  Clock, Settings, X
} from 'lucide-react'
import { getStreak, getCheckinToday, getMissionToday, getWinsToday } from '../utils/api'

const navItems = [
  { 
    section: 'Daily Flow',
    items: [
      { to: '/checkin', icon: Crosshair, label: 'Check In' },
      { to: '/mission', icon: Radar, label: 'Mission Brief' },
      { to: '/warroom', icon: Swords, label: 'War Room' },
    ]
  },
  {
    section: 'Intel',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/history', icon: Clock, label: 'History' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ]
  }
]

export default function Sidebar({ isMobile = false, isOpen = false, onNavigate, onClose }) {
  const location = useLocation()
  const [streak, setStreak] = useState({ current_count: 0, longest_count: 0 })
  const [todayStatus, setTodayStatus] = useState({ checkedIn: false, missionActive: false, winsCount: 0 })

  useEffect(() => {
    async function loadStatus() {
      try {
        const [streakData, checkin, mission, wins] = await Promise.all([
          getStreak(),
          getCheckinToday(),
          getMissionToday(),
          getWinsToday()
        ])
        setStreak(streakData || { current_count: 0, longest_count: 0 })
        setTodayStatus({
          checkedIn: !!checkin,
          missionActive: !!mission,
          winsCount: Array.isArray(wins) ? wins.length : 0
        })
      } catch(e) {
        // Server might not be running yet
      }
    }
    loadStatus()
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [location.pathname])

  return (
    <aside className={`sidebar ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">⚔️</div>
          <div>
            <span className="sidebar__logo-text">War Room</span>
            <span className="sidebar__logo-sub">Daily Command</span>
          </div>
        </div>
        {isMobile ? (
          <button type="button" className="sidebar__mobile-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav className="sidebar__nav">
        {navItems.map(section => (
          <div key={section.section}>
            <div className="sidebar__section-label">{section.section}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (isMobile) onNavigate?.()
                }}
                className={({ isActive }) => 
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
              >
                <item.icon className="sidebar__link-icon" size={20} />
                <span>{item.label}</span>
                {item.to === '/warroom' && todayStatus.winsCount > 0 && (
                  <span className="sidebar__link-badge">{todayStatus.winsCount}</span>
                )}
                {item.to === '/checkin' && todayStatus.checkedIn && (
                  <span className="sidebar__link-badge">✓</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__streak">
          <span className="sidebar__streak-fire">🔥</span>
          <div>
            <span className="sidebar__streak-count">{streak.current_count}</span>
            <span className="sidebar__streak-label"> day streak</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

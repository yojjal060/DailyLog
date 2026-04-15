import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import CheckIn from './components/CheckIn'
import MissionBrief from './components/MissionBrief'
import WarRoom from './components/WarRoom'
import Dashboard from './components/Dashboard'
import History from './components/History'
import Settings from './components/Settings'

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
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

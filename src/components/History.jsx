import { useState, useEffect } from 'react'
import { Clock, Search, ChevronDown, Trophy, Target, Battery } from 'lucide-react'
import { getHistory } from '../utils/api'

const ENERGY_EMOJIS = { 1: '🧟', 2: '😴', 3: '😐', 4: '😊', 5: '🔥' }

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedDay, setExpandedDay] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoading(true)
    try {
      const data = await getHistory(60, 0, search || undefined)
      setHistory(data || [])
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    loadHistory()
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="history-page animate-in">
      <div className="page-header">
        <h1><Clock size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />History</h1>
        <p>Every day you showed up. Every win you logged.</p>
      </div>

      {/* Search */}
      <form className="history-search mb-lg" onSubmit={handleSearch}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            type="text"
            placeholder="Search wins..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {loading ? (
        <div className="empty-state"><div className="empty-state__icon">⏳</div><div className="empty-state__title">Loading...</div></div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <div className="empty-state__title">{search ? 'No results found' : 'No history yet'}</div>
          <div className="empty-state__text">{search ? 'Try a different search term' : 'Start by checking in and completing missions'}</div>
        </div>
      ) : (
        <div className="history-list stagger-children">
          {history.map(day => (
            <div
              key={day.date}
              className={`history-day glass-card animate-in ${expandedDay === day.date ? 'history-day--expanded' : ''}`}
              onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            >
              <div className="history-day__header">
                <div className="history-day__date">
                  <span className="history-day__date-text">{formatDate(day.date)}</span>
                  <span className="text-muted text-sm">{day.date}</span>
                </div>
                <div className="history-day__badges">
                  {day.checkIn && (
                    <span className="tag" title={`Energy: ${day.checkIn.energy}`}>
                      {ENERGY_EMOJIS[day.checkIn.energy] || '❓'} {day.checkIn.energy}/5
                    </span>
                  )}
                  {day.pomodoroCount > 0 && (
                    <span className="tag tag--dsa" title="Focus blocks">
                      🍅 {day.pomodoroCount}
                    </span>
                  )}
                  {day.wins.length > 0 && (
                    <span className="tag tag--frontend" title="Wins">
                      🏆 {day.wins.length}
                    </span>
                  )}
                  {day.missions.length > 0 && day.missions.some(m => m.status === 'completed') && (
                    <span className="tag" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)' }}>✅</span>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--text-muted)',
                    transform: expandedDay === day.date ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}
                />
              </div>

              {expandedDay === day.date && (
                <div className="history-day__details animate-in" onClick={e => e.stopPropagation()}>
                  {/* Check-in */}
                  {day.checkIn && (
                    <div className="history-detail">
                      <h4><Battery size={14} /> Check-In</h4>
                      <div className="history-detail__grid">
                        <span>Energy: {ENERGY_EMOJIS[day.checkIn.energy]} {day.checkIn.energy}/5</span>
                        <span>Gym: {day.checkIn.gym === 'yes' ? '💪 Yes' : day.checkIn.gym === 'later' ? '⏰ Later' : '❌ No'}</span>
                        <span>Sleep: 🛏️ {day.checkIn.sleep_hours}h</span>
                        {day.checkIn.mood_note && <span>Note: {day.checkIn.mood_note}</span>}
                      </div>
                    </div>
                  )}
                  
                  {/* Missions */}
                  {day.missions.length > 0 && (
                    <div className="history-detail">
                      <h4><Target size={14} /> Missions</h4>
                      {day.missions.map(m => (
                        <div key={m.id} className="history-mission">
                          <span className={`tag tag--${m.category?.toLowerCase().replace('/', '')}`}>{m.category}</span>
                          <span>{m.title}</span>
                          <span className={m.status === 'completed' ? 'text-accent' : 'text-muted'}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Wins */}
                  {day.wins.length > 0 && (
                    <div className="history-detail">
                      <h4><Trophy size={14} /> Wins</h4>
                      {day.wins.map(w => (
                        <div key={w.id} className="history-win">
                          <span>🏆</span>
                          <span>{w.text}</span>
                          <span className="text-muted text-sm">
                            {w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

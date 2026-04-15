import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, RefreshCw, ChevronRight, Target, Shield, Zap } from 'lucide-react'
import { getMissionToday, createMission, getCheckinToday } from '../utils/api'
import { generateMission } from '../engine/missionEngine'

export default function MissionBrief() {
  const navigate = useNavigate()
  const [mission, setMission] = useState(null)
  const [checkin, setCheckin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rerolls, setRerolls] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [missionData, checkinData] = await Promise.all([
        getMissionToday(),
        getCheckinToday()
      ])
      setCheckin(checkinData)
      if (missionData) {
        setMission(missionData)
      } else if (checkinData) {
        // Generate a new mission
        await generateNewMission(checkinData)
      }
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function generateNewMission(checkinData) {
    const generated = generateMission(checkinData || checkin)
    try {
      const saved = await createMission(generated)
      setMission(saved)
    } catch(e) {
      console.error(e)
    }
  }

  async function handleReroll() {
    if (rerolls >= 3) return
    setRerolls(r => r + 1)
    await generateNewMission(checkin)
  }

  function handleAccept() {
    navigate('/warroom')
  }

  const categoryColors = {
    'DSA': 'tag--dsa',
    'Frontend': 'tag--frontend',
    'Backend': 'tag--backend',
    'DevOps': 'tag--devops',
    'Reading': 'tag--reading',
    'Review': 'tag--review',
    'AI/ML': 'tag--aiml',
  }

  if (loading) {
    return (
      <div className="mission-page">
        <div className="page-header">
          <h1><Radar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Mission Brief</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">📡</div>
          <div className="empty-state__title">Loading intel...</div>
        </div>
      </div>
    )
  }

  if (!checkin) {
    return (
      <div className="mission-page">
        <div className="page-header">
          <h1><Radar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Mission Brief</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <div className="empty-state__title">Check in first, soldier.</div>
          <div className="empty-state__text">Complete your daily check-in to unlock today's mission.</div>
          <button className="btn btn-primary mt-lg" onClick={() => navigate('/checkin')}>
            Go to Check-In <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="mission-page">
        <div className="page-header">
          <h1><Radar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Mission Brief</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">⚙️</div>
          <div className="empty-state__title">Generating mission...</div>
        </div>
      </div>
    )
  }

  const difficultyLabels = { 1: 'Light', 2: 'Moderate', 3: 'Intense' }
  const difficultyColors = { 1: '#10b981', 2: '#f59e0b', 3: '#ef4444' }

  return (
    <div className="mission-page animate-in">
      <div className="page-header">
        <h1><Radar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Mission Brief</h1>
        <p>Your ONE mission for today. No list. No overwhelm.</p>
      </div>

      <div className="mission-card glass-card glass-card--static">
        <div className="mission-card__top">
          <span className={`tag ${categoryColors[mission.category] || 'tag--review'}`}>
            {mission.category}
          </span>
          <span className="mission-card__difficulty" style={{ color: difficultyColors[mission.difficulty] }}>
            {difficultyLabels[mission.difficulty] || 'Moderate'}
          </span>
        </div>

        <h2 className="mission-card__title">{mission.title}</h2>
        
        {mission.description && (
          <p className="mission-card__desc">{mission.description}</p>
        )}

        <div className="mission-card__meta">
          <div className="mission-card__meta-item">
            <Target size={16} />
            <span>{mission.estimated_blocks || 2} focus blocks</span>
          </div>
          <div className="mission-card__meta-item">
            <Zap size={16} />
            <span>Energy-matched to your check-in</span>
          </div>
        </div>

        <div className="mission-card__rule">
          <Shield size={16} />
          <span><strong>Anti-procrastination rule:</strong> If you feel the urge to switch tabs, type what you're thinking in the win log instead. Redirect, don't resist.</span>
        </div>
      </div>

      <div className="mission-actions">
        <button className="btn btn-primary btn-lg" onClick={handleAccept}>
          Accept Mission <Swords size={18} />
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleReroll}
          disabled={rerolls >= 3}
        >
          <RefreshCw size={16} />
          Re-roll ({3 - rerolls} left)
        </button>
      </div>
    </div>
  )
}

function Swords(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
  )
}

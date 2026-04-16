import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, RefreshCw, ChevronRight, Target, Shield, Zap, CheckCircle2 } from 'lucide-react'
import { getMissionToday, createMission, getCheckinToday, getMissions, updateMission } from '../utils/api'
import { generateMission } from '../engine/missionEngine'

const DAILY_TASK_LIMIT = Number(import.meta.env.VITE_DAILY_TASK_LIMIT || 10)

export default function MissionBrief() {
  const navigate = useNavigate()
  const [mission, setMission] = useState(null)
  const [checkin, setCheckin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rerolls, setRerolls] = useState(0)
  const [rerolling, setRerolling] = useState(false)
  const [rerollError, setRerollError] = useState('')
  const [tasksCompletedToday, setTasksCompletedToday] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setRerollError('')
    try {
      const [missionData, checkinData, missionList] = await Promise.all([
        getMissionToday(),
        getCheckinToday(),
        getMissions(200)
      ])

      const today = new Date().toISOString().split('T')[0]
      const todayMissions = (missionList || []).filter(m => {
        if (!m?.date) return false
        const missionDate = String(m.date).slice(0, 10)
        return missionDate === today
      }).sort((a, b) => Number(b.id || 0) - Number(a.id || 0))

      const latestMission = todayMissions[0] || missionData || null
      const completedCount = todayMissions.filter(m => m.status === 'completed').length
      setTasksCompletedToday(completedCount)

      let rerollsUsed = 0
      if (latestMission && latestMission.status !== 'completed') {
        const lastCompletedId = todayMissions
          .filter(m => m.status === 'completed')
          .reduce((max, m) => Math.max(max, Number(m.id || 0)), 0)

        rerollsUsed = todayMissions.filter(m => Number(m.id || 0) > lastCompletedId && m.status === 'skipped').length
      }
      const normalizedRerolls = Math.max(0, Math.min(3, rerollsUsed))
      setRerolls(normalizedRerolls)

      setCheckin(checkinData)

      if (latestMission?.status === 'completed' && completedCount < DAILY_TASK_LIMIT && checkinData) {
        try {
          const nextMission = await generateNewMission(checkinData)
          setMission(nextMission)
          setRerolls(0)
          return
        } catch (e) {
          console.error(e)
        }
      }

      if (latestMission?.status === 'skipped' && completedCount < DAILY_TASK_LIMIT && checkinData) {
        try {
          const nextMission = await generateNewMission(checkinData, { excludeTitle: latestMission.title })
          setMission(nextMission)
          setRerolls(normalizedRerolls)
          return
        } catch (e) {
          setRerollError('Could not generate a fresh mission right now. Please try reroll again.')
          console.error(e)
        }
      }

      if (latestMission) {
        setMission(latestMission)
      } else if (checkinData && completedCount < DAILY_TASK_LIMIT) {
        // Generate a new mission
        const nextMission = await generateNewMission(checkinData)
        setMission(nextMission)
        setRerolls(0)
      }
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function generateNewMission(checkinData, options = {}) {
    const sourceCheckin = checkinData || checkin
    const excludedTitle = String(options.excludeTitle || '').trim()

    let generated = generateMission(sourceCheckin)
    if (excludedTitle) {
      for (let i = 0; i < 6 && generated?.title === excludedTitle; i += 1) {
        generated = generateMission(sourceCheckin)
      }
    }

    const saved = await createMission(generated)
    setMission(saved)
    return saved
  }

  async function handleReroll() {
    if (mission?.status === 'completed' || rerolls >= 3 || rerolling) return

    setRerolling(true)
    setRerollError('')

    const previousMission = mission
    try {
      await updateMission(mission.id, { status: 'skipped' })
      await generateNewMission(checkin, { excludeTitle: mission?.title })
      setRerolls(r => Math.min(3, r + 1))
    } catch (e) {
      if (e?.status === 409) {
        try {
          if (previousMission?.id) {
            await updateMission(previousMission.id, { status: 'active' })
          }
        } catch (_) {}

        setRerollError('Reroll limit reached or another mission is still active.')
        await loadData()
      } else {
        try {
          if (previousMission?.id) {
            await updateMission(previousMission.id, { status: 'active' })
          }
        } catch (_) {}

        setRerollError('Could not reroll mission. Please try again.')
      }
      console.error(e)
    } finally {
      setRerolling(false)
    }
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
  const isCompleted = mission.status === 'completed'
  const rerollsLeft = Math.max(0, 3 - rerolls)
  const dailyLimitReached = tasksCompletedToday >= DAILY_TASK_LIMIT && isCompleted

  return (
    <div className="mission-page animate-in">
      <div className="page-header">
        <h1><Radar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Mission Brief</h1>
        <p>{isCompleted ? (dailyLimitReached ? 'Daily mission cap reached. Great work.' : 'Mission completed for today. Great work.') : 'Your ONE mission for today. No list. No overwhelm.'}</p>
      </div>

      <div className="mission-card glass-card glass-card--static">
        <div className="mission-card__top">
          <span className={`tag ${categoryColors[mission.category] || 'tag--review'}`}>
            {mission.category}
          </span>
          {isCompleted ? (
            <span className="tag" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)', fontSize: 'var(--fs-sm)', padding: '0.4rem 0.8rem' }}>
              ✅ Completed
            </span>
          ) : (
            <span className="mission-card__difficulty" style={{ color: difficultyColors[mission.difficulty] }}>
              {difficultyLabels[mission.difficulty] || 'Moderate'}
            </span>
          )}
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
            <span>{dailyLimitReached ? 'Daily cap reached' : 'Energy-matched to your check-in'}</span>
          </div>
        </div>

        {isCompleted ? (
          <div className="mission-card__rule">
            <CheckCircle2 size={16} />
            <span><strong>Mission status:</strong> Completed. Keep your momentum and continue logging wins in the War Room.</span>
          </div>
        ) : (
          <div className="mission-card__rule">
            <Shield size={16} />
            <span><strong>Anti-procrastination rule:</strong> If you feel the urge to switch tabs, type what you're thinking in the win log instead. Redirect, don't resist.</span>
          </div>
        )}
      </div>

      {isCompleted ? (
        <div className="mission-actions">
          {!dailyLimitReached ? (
            <button className="btn btn-success btn-lg" onClick={loadData}>
              Get Next Mission <ChevronRight size={18} />
            </button>
          ) : null}
          <button className="btn btn-success btn-lg" onClick={() => navigate('/warroom')}>
            View War Room <ChevronRight size={18} />
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="mission-actions">
          <button className="btn btn-primary btn-lg" onClick={handleAccept}>
            Accept Mission <Swords size={18} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReroll}
            disabled={rerollsLeft <= 0 || rerolling}
          >
            <RefreshCw size={16} />
            {rerolling ? 'Re-rolling...' : `Re-roll (${rerollsLeft} left)`}
          </button>
        </div>
      )}

      {rerollError ? (
        <p className="text-sm" style={{ marginTop: 'var(--space-sm)', color: 'var(--accent-red)' }}>
          {rerollError}
        </p>
      ) : null}
    </div>
  )
}

function Swords(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, Play, Pause, RotateCcw, Trophy, Send, CheckCircle2, Coffee } from 'lucide-react'
import { getMissionToday, updateMission, getWinsToday, createWin, createPomodoro, completePomodoro, updateStreak, getSettings } from '../utils/api'

export default function WarRoom() {
  const navigate = useNavigate()
  const [mission, setMission] = useState(null)
  const [wins, setWins] = useState([])
  const [winText, setWinText] = useState('')
  const [loading, setLoading] = useState(true)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [currentPomodoroId, setCurrentPomodoroId] = useState(null)

  // Timer state
  const [focusDuration, setFocusDuration] = useState(25)
  const [breakDuration, setBreakDuration] = useState(5)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const timerRef = useRef(null)
  const winsEndRef = useRef(null)

  useEffect(() => {
    loadData()
    return () => clearInterval(timerRef.current)
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [missionData, winsData, settings] = await Promise.all([
        getMissionToday(),
        getWinsToday(),
        getSettings()
      ])
      setMission(missionData)
      setWins(winsData || [])
      if (settings) {
        setFocusDuration(settings.focus_duration || 25)
        setBreakDuration(settings.break_duration || 5)
        setTimeLeft((settings.focus_duration || 25) * 60)
      }
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            handleTimerEnd()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRunning])

  async function handleTimerEnd() {
    setIsRunning(false)

    // Play sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = isBreak ? 440 : 880
      gain.gain.value = 0.3
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
      osc.stop(ctx.currentTime + 1.5)
    } catch(e) {}

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(isBreak ? '☕ Break over! Back to war.' : '🏆 Focus block complete! Log your win.')
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission()
    }

    if (isBreak) {
      // Break ended, start new focus
      setIsBreak(false)
      setTimeLeft(focusDuration * 60)
    } else {
      // Focus ended
      if (currentPomodoroId) {
        await completePomodoro(currentPomodoroId)
        setCurrentPomodoroId(null)
      }
      setPomodoroCount(c => c + 1)
      setIsBreak(true)
      setTimeLeft(breakDuration * 60)
    }
  }

  async function startTimer() {
    if (!isRunning && !isBreak) {
      // Start a new pomodoro session
      try {
        const pom = await createPomodoro({
          mission_id: mission?.id,
          duration_minutes: focusDuration
        })
        setCurrentPomodoroId(pom.id)
      } catch(e) {}
    }
    setIsRunning(true)
    // Request notification permission
    if (Notification.permission !== 'granted') {
      Notification.requestPermission()
    }
  }

  function pauseTimer() {
    setIsRunning(false)
  }

  function resetTimer() {
    setIsRunning(false)
    setIsBreak(false)
    setTimeLeft(focusDuration * 60)
    setCurrentPomodoroId(null)
  }

  async function handleWinSubmit(e) {
    e.preventDefault()
    if (!winText.trim()) return
    try {
      const win = await createWin({
        text: winText.trim(),
        mission_id: mission?.id
      })
      setWins(prev => [...prev, win])
      setWinText('')
      await updateStreak()
      setTimeout(() => winsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch(e) {
      console.error(e)
    }
  }

  async function handleMissionComplete() {
    if (!mission) return
    try {
      await updateMission(mission.id, {
        status: 'completed',
        pomodoros_used: pomodoroCount
      })
      await updateStreak()
      setMission(prev => ({ ...prev, status: 'completed' }))
    } catch(e) {
      console.error(e)
    }
  }

  // Format time
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const totalSeconds = (isBreak ? breakDuration : focusDuration) * 60
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100
  const circumference = 2 * Math.PI * 120

  if (loading) {
    return (
      <div className="warroom-page">
        <div className="page-header">
          <h1>⚔️ War Room</h1>
        </div>
        <div className="empty-state"><div className="empty-state__icon">⏳</div><div className="empty-state__title">Loading...</div></div>
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="warroom-page">
        <div className="page-header">
          <h1>⚔️ War Room</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <div className="empty-state__title">No active mission</div>
          <div className="empty-state__text">Get your mission brief first.</div>
          <button className="btn btn-primary mt-lg" onClick={() => navigate('/mission')}>Go to Mission Brief</button>
        </div>
      </div>
    )
  }

  return (
    <div className="warroom-page">
      {/* Mission header */}
      <div className="warroom-mission glass-card glass-card--static animate-in">
        <div className="flex items-center justify-between">
          <div>
            <span className={`tag tag--${mission.category?.toLowerCase().replace('/', '')}`}>{mission.category}</span>
            <h2 className="warroom-mission__title">{mission.title}</h2>
          </div>
          {mission.status !== 'completed' ? (
            <button className="btn btn-success" onClick={handleMissionComplete}>
              <CheckCircle2 size={18} /> Mission Complete
            </button>
          ) : (
            <span className="tag" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)', fontSize: 'var(--fs-sm)', padding: '0.4rem 0.8rem' }}>
              ✅ Completed
            </span>
          )}
        </div>
      </div>

      <div className="warroom-grid">
        {/* Timer */}
        <div className="warroom-timer glass-card glass-card--static">
          <div className="timer-label">
            {isBreak ? (
              <><Coffee size={16} /> Break Time</>
            ) : (
              <><Swords size={16} /> Focus Mode</>
            )}
          </div>

          <div className="timer-circle">
            <svg width="260" height="260" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r="120" fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
              <circle
                cx="130" cy="130" r="120" fill="none"
                stroke={isBreak ? 'var(--accent-green)' : 'var(--accent-blue)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (progress / 100) * circumference}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="timer-display">
              <span className="timer-time text-mono">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="timer-sessions text-muted text-sm">
                Session #{pomodoroCount + 1}
              </span>
            </div>
          </div>

          <div className="timer-controls">
            {!isRunning ? (
              <button className="btn btn-primary btn-lg" onClick={startTimer}>
                <Play size={20} /> {timeLeft < totalSeconds ? 'Resume' : 'Start'}
              </button>
            ) : (
              <button className="btn btn-secondary btn-lg" onClick={pauseTimer}>
                <Pause size={20} /> Pause
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={resetTimer} title="Reset">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="timer-stats">
            <div className="timer-stat">
              <span className="timer-stat__value text-mono">{pomodoroCount}</span>
              <span className="timer-stat__label">Completed</span>
            </div>
            <div className="timer-stat">
              <span className="timer-stat__value text-mono">{focusDuration}m</span>
              <span className="timer-stat__label">Focus</span>
            </div>
            <div className="timer-stat">
              <span className="timer-stat__value text-mono">{breakDuration}m</span>
              <span className="timer-stat__label">Break</span>
            </div>
          </div>
        </div>

        {/* Win Log */}
        <div className="warroom-wins glass-card glass-card--static">
          <h3 className="warroom-wins__title">
            <Trophy size={18} /> Win Log
          </h3>
          <p className="text-muted text-sm mb-md">
            After each focus block, type what you accomplished. Even small wins count.
          </p>

          <div className="warroom-wins__list">
            {wins.length === 0 ? (
              <div className="warroom-wins__empty">
                No wins yet today. Start a focus block and log your first win.
              </div>
            ) : (
              wins.map((win, i) => (
                <div key={win.id || i} className="warroom-win animate-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="warroom-win__bullet">🏆</span>
                  <div>
                    <span className="warroom-win__text">{win.text}</span>
                    <span className="warroom-win__time text-muted text-sm">
                      {win.created_at ? new Date(win.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={winsEndRef} />
          </div>

          <form className="warroom-wins__form" onSubmit={handleWinSubmit}>
            <input
              className="input"
              type="text"
              placeholder="What did you just accomplish?"
              value={winText}
              onChange={e => setWinText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-icon" disabled={!winText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

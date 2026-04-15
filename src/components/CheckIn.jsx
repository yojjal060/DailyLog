import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Battery, Dumbbell, Moon, MessageSquare, ChevronRight, Check } from 'lucide-react'
import { saveCheckin, getCheckinToday } from '../utils/api'

const ENERGY_LEVELS = [
  { value: 1, emoji: '🧟', label: 'Zombie', color: '#ef4444' },
  { value: 2, emoji: '😴', label: 'Drowsy', color: '#f59e0b' },
  { value: 3, emoji: '😐', label: 'Okay', color: '#eab308' },
  { value: 4, emoji: '😊', label: 'Good', color: '#10b981' },
  { value: 5, emoji: '🔥', label: 'On Fire', color: '#3b82f6' },
]

const GYM_OPTIONS = [
  { value: 'yes', emoji: '💪', label: 'Yes / Done' },
  { value: 'no', emoji: '❌', label: 'No' },
  { value: 'later', emoji: '⏰', label: 'Will Go Later' },
]

const SLEEP_OPTIONS = [4, 5, 6, 7, 8]

export default function CheckIn() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [energy, setEnergy] = useState(null)
  const [gym, setGym] = useState(null)
  const [sleepHours, setSleepHours] = useState(null)
  const [moodNote, setMoodNote] = useState('')
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCheckinToday().then(data => {
      if (data) {
        setAlreadyCheckedIn(true)
        setEnergy(data.energy)
        setGym(data.gym)
        setSleepHours(data.sleep_hours)
        setMoodNote(data.mood_note || '')
      }
    }).catch(() => {})
  }, [])

  if (alreadyCheckedIn) {
    const energyInfo = ENERGY_LEVELS.find(l => l.value === energy)
    const gymInfo = GYM_OPTIONS.find(o => o.value === gym)

    return (
      <div className="checkin-page">
        <div className="page-header">
          <h1><Crosshair size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Daily Check-In</h1>
          <p>You've already checked in today.</p>
        </div>

        <div className="checkin-step animate-in">
          <div className="checkin-step__header">
            <div className="checkin-step__icon">
              <Check size={24} />
            </div>
            <h2 className="checkin-step__title">Checked In For Today</h2>
            <p className="checkin-step__subtitle">Come back tomorrow for your next check-in.</p>
          </div>

          <div className="checkin-step__content">
            <div className="checkin-summary">
              <div className="checkin-summary__item">
                <span>Energy</span>
                <span>{energyInfo?.emoji} {energyInfo?.label}</span>
              </div>
              <div className="checkin-summary__item">
                <span>Gym</span>
                <span>{gymInfo?.emoji} {gymInfo?.label}</span>
              </div>
              <div className="checkin-summary__item">
                <span>Sleep</span>
                <span>🛏️ {sleepHours}{sleepHours === 8 ? '+' : ''} hours</span>
              </div>
            </div>

            {moodNote ? (
              <p className="text-muted mt-md">Note: {moodNote}</p>
            ) : null}

            <button
              className="btn btn-primary btn-lg w-full mt-lg"
              onClick={() => navigate('/mission')}
            >
              Go to Mission
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      await saveCheckin({
        energy,
        gym,
        sleep_hours: sleepHours,
        mood_note: moodNote,
      })
      navigate('/mission')
    } catch(e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    // Step 0: Energy
    {
      icon: Battery,
      title: "How's your energy right now?",
      subtitle: "Be honest. No judgment.",
      content: (
        <div className="select-grid">
          {ENERGY_LEVELS.map(level => (
            <button
              key={level.value}
              className={`select-btn ${energy === level.value ? 'select-btn--active' : ''}`}
              onClick={() => { setEnergy(level.value); setTimeout(() => setStep(1), 300) }}
              style={energy === level.value ? { borderColor: level.color, boxShadow: `0 0 20px ${level.color}33` } : {}}
            >
              <span className="select-btn__emoji">{level.emoji}</span>
              <span className="select-btn__label">{level.label}</span>
            </button>
          ))}
        </div>
      )
    },
    // Step 1: Gym
    {
      icon: Dumbbell,
      title: "Gym today?",
      subtitle: "Morning anchor = structured day",
      content: (
        <div className="select-grid">
          {GYM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`select-btn ${gym === opt.value ? 'select-btn--active' : ''}`}
              onClick={() => { setGym(opt.value); setTimeout(() => setStep(2), 300) }}
            >
              <span className="select-btn__emoji">{opt.emoji}</span>
              <span className="select-btn__label">{opt.label}</span>
            </button>
          ))}
        </div>
      )
    },
    // Step 2: Sleep
    {
      icon: Moon,
      title: "How many hours did you sleep?",
      subtitle: "Approximation is fine",
      content: (
        <div className="select-grid">
          {SLEEP_OPTIONS.map(h => (
            <button
              key={h}
              className={`select-btn ${sleepHours === h ? 'select-btn--active' : ''}`}
              onClick={() => { setSleepHours(h); setTimeout(() => setStep(3), 300) }}
            >
              <span className="select-btn__emoji">{h >= 7 ? '😴' : h >= 5 ? '😑' : '💀'}</span>
              <span className="select-btn__label">{h}{h === 8 ? '+' : ''} hrs</span>
            </button>
          ))}
        </div>
      )
    },
    // Step 3: Mood note + submit
    {
      icon: MessageSquare,
      title: "Anything on your mind?",
      subtitle: "Optional — skip if you want",
      content: (
        <div className="checkin-final">
          <input
            className="input"
            type="text"
            placeholder="One line... or skip it"
            value={moodNote}
            onChange={e => setMoodNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <div className="checkin-summary">
            <div className="checkin-summary__item">
              <span>Energy</span>
              <span>{ENERGY_LEVELS.find(l => l.value === energy)?.emoji} {ENERGY_LEVELS.find(l => l.value === energy)?.label}</span>
            </div>
            <div className="checkin-summary__item">
              <span>Gym</span>
              <span>{GYM_OPTIONS.find(o => o.value === gym)?.emoji} {GYM_OPTIONS.find(o => o.value === gym)?.label}</span>
            </div>
            <div className="checkin-summary__item">
              <span>Sleep</span>
              <span>🛏️ {sleepHours}{sleepHours === 8 ? '+' : ''} hours</span>
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg w-full mt-lg"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Get My Mission'}
            <ChevronRight size={18} />
          </button>
        </div>
      )
    }
  ]

  const currentStep = steps[step]
  const StepIcon = currentStep.icon

  return (
    <div className="checkin-page">
      <div className="page-header">
        <h1><Crosshair size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Daily Check-In</h1>
        <p>3 quick questions. Be honest.</p>
      </div>

      {/* Progress dots */}
      <div className="checkin-progress">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`checkin-progress__dot ${i <= step ? 'checkin-progress__dot--active' : ''} ${i < step ? 'checkin-progress__dot--done' : ''}`}
            onClick={() => {
              if (i < step) setStep(i)
            }}
          />
        ))}
      </div>

      {/* Current step */}
      <div className="checkin-step animate-in" key={step}>
        <div className="checkin-step__header">
          <div className="checkin-step__icon">
            <StepIcon size={24} />
          </div>
          <h2 className="checkin-step__title">{currentStep.title}</h2>
          <p className="checkin-step__subtitle">{currentStep.subtitle}</p>
        </div>
        <div className="checkin-step__content">
          {currentStep.content}
        </div>
      </div>

      {/* Back button */}
      {step > 0 && (
        <button className="btn btn-ghost mt-lg" onClick={() => setStep(step - 1)}>
          ← Back
        </button>
      )}
    </div>
  )
}

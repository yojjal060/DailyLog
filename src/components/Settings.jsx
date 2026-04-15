import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Clock, User, Download, Save } from 'lucide-react'
import { getSettings, getHistory, updateSettings } from '../utils/api'

export default function Settings() {
  const [settings, setSettings] = useState({ focus_duration: 25, break_duration: 5, name: 'Yojjal', goals_text: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(data => {
      if (data) setSettings(data)
    }).catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await updateSettings({
        focus_duration: settings.focus_duration,
        break_duration: settings.break_duration,
        name: settings.name,
        goals_text: settings.goals_text
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    try {
      const data = await getHistory(1000, 0)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `warroom-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) {
      console.error(e)
    }
  }

  return (
    <div className="settings-page animate-in">
      <div className="page-header">
        <h1><SettingsIcon size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Settings</h1>
        <p>Configure your War Room.</p>
      </div>

      {/* Timer Settings */}
      <div className="glass-card glass-card--static mb-lg">
        <h3 className="settings-section-title"><Clock size={18} /> Timer</h3>
        <div className="settings-grid">
          <div className="settings-field">
            <label className="settings-label">Focus Duration (minutes)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="120"
              value={settings.focus_duration}
              onChange={e => setSettings({ ...settings, focus_duration: parseInt(e.target.value) || 25 })}
            />
          </div>
          <div className="settings-field">
            <label className="settings-label">Break Duration (minutes)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={settings.break_duration}
              onChange={e => setSettings({ ...settings, break_duration: parseInt(e.target.value) || 5 })}
            />
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="glass-card glass-card--static mb-lg">
        <h3 className="settings-section-title"><User size={18} /> Profile</h3>
        <div className="settings-grid">
          <div className="settings-field">
            <label className="settings-label">Name</label>
            <input
              className="input"
              type="text"
              value={settings.name}
              onChange={e => setSettings({ ...settings, name: e.target.value })}
            />
          </div>
          <div className="settings-field">
            <label className="settings-label">Goals Reminder</label>
            <input
              className="input"
              type="text"
              placeholder="What are you fighting for?"
              value={settings.goals_text}
              onChange={e => setSettings({ ...settings, goals_text: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-md mb-lg">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>

      {/* Data */}
      <div className="glass-card glass-card--static mb-lg">
        <h3 className="settings-section-title"><Download size={18} /> Data</h3>
        <div className="flex gap-md">
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={16} /> Export All Data (JSON)
          </button>
        </div>
        <p className="text-muted text-sm mt-md">
          Database connection is managed by your server environment variables.
        </p>
      </div>
    </div>
  )
}

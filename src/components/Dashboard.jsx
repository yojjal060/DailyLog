import { useState, useEffect } from 'react'
import { LayoutDashboard, Flame, Trophy, Target, Zap, Dumbbell, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getStats } from '../utils/api'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899']

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats()
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <h1><LayoutDashboard size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Dashboard</h1>
        </div>
        <div className="empty-state"><div className="empty-state__icon">📊</div><div className="empty-state__title">Loading stats...</div></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <h1><LayoutDashboard size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Dashboard</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <div className="empty-state__title">No data yet</div>
          <div className="empty-state__text">Complete a check-in and some focus blocks to start seeing stats here.</div>
        </div>
      </div>
    )
  }

  const weekDiff = stats.thisWeekPomodoros - stats.lastWeekPomodoros
  const weekTrend = weekDiff > 0 ? 'up' : weekDiff < 0 ? 'down' : 'same'

  return (
    <div className="dashboard-page animate-in">
      <div className="page-header">
        <h1><LayoutDashboard size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />Dashboard</h1>
        <p>Your visual proof that you're making progress.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 stagger-children mb-lg">
        <div className="stat-card animate-in">
          <div className="stat-card__icon stat-card__icon--amber"><Flame size={20} /></div>
          <div className="stat-card__value" style={{ color: 'var(--accent-amber)' }}>{stats.streak?.current_count || 0}</div>
          <div className="stat-card__label">Day Streak</div>
          <div className="text-sm text-muted mt-sm">Best: {stats.streak?.longest_count || 0}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-card__icon stat-card__icon--green"><Trophy size={20} /></div>
          <div className="stat-card__value" style={{ color: 'var(--accent-green)' }}>{stats.totalWins}</div>
          <div className="stat-card__label">Total Wins</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-card__icon stat-card__icon--blue"><Target size={20} /></div>
          <div className="stat-card__value" style={{ color: 'var(--accent-blue)' }}>{stats.totalMissions}</div>
          <div className="stat-card__label">Missions Done</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-card__icon stat-card__icon--purple"><Zap size={20} /></div>
          <div className="stat-card__value" style={{ color: 'var(--accent-purple)' }}>{stats.avgEnergy || '—'}</div>
          <div className="stat-card__label">Avg Energy</div>
        </div>
      </div>

      {/* Weekly comparison */}
      <div className="glass-card glass-card--static mb-lg">
        <div className="flex items-center gap-md">
          {weekTrend === 'up' ? <TrendingUp size={20} style={{ color: 'var(--accent-green)' }} /> :
           weekTrend === 'down' ? <TrendingDown size={20} style={{ color: 'var(--accent-red)' }} /> :
           <Minus size={20} style={{ color: 'var(--text-muted)' }} />}
          <div>
            <span className="text-mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
              {stats.thisWeekPomodoros} pomodoros this week
            </span>
            <span className="text-muted text-sm" style={{ marginLeft: 'var(--space-md)' }}>
              {weekDiff > 0 ? `+${weekDiff}` : weekDiff} vs last week ({stats.lastWeekPomodoros})
            </span>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        {/* Activity Chart */}
        <div className="glass-card glass-card--static">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>📊 Daily Activity (30d)</h3>
          {stats.dailyActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
                <Bar dataKey="pomodoro_count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} name="Pomodoros" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted text-sm text-center" style={{ padding: '3rem 0' }}>No activity data yet</div>
          )}
        </div>

        {/* Energy Trend */}
        <div className="glass-card glass-card--static">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>⚡ Energy Trend (30d)</h3>
          {stats.energyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.energyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[1, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="energy" stroke="var(--accent-amber)" fill="var(--accent-amber-glow)" strokeWidth={2} name="Energy" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted text-sm text-center" style={{ padding: '3rem 0' }}>No energy data yet</div>
          )}
        </div>
      </div>

      <div className="grid-2 mb-lg">
        {/* Category Distribution */}
        <div className="glass-card glass-card--static">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>🎯 Category Breakdown</h3>
          {stats.categoryDist.length > 0 ? (
            <div className="flex items-center gap-xl">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={stats.categoryDist} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {stats.categoryDist.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-sm">
                {stats.categoryDist.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-sm">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm">{cat.category}</span>
                    <span className="text-mono text-sm text-muted">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted text-sm text-center" style={{ padding: '3rem 0' }}>Complete some missions first</div>
          )}
        </div>

        {/* Gym Correlation */}
        <div className="glass-card glass-card--static">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>
            <Dumbbell size={18} style={{ display: 'inline', marginRight: '0.4rem' }} /> Gym Correlation
          </h3>
          <div className="gym-correlation">
            <div className="gym-correlation__item">
              <span className="gym-correlation__emoji">💪</span>
              <span className="text-mono" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--accent-green)' }}>
                {stats.gymCorrelation.gymDays}
              </span>
              <span className="text-sm text-muted">avg pomodoros on gym days</span>
            </div>
            <div className="gym-correlation__vs text-muted">vs</div>
            <div className="gym-correlation__item">
              <span className="gym-correlation__emoji">🛋️</span>
              <span className="text-mono" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {stats.gymCorrelation.noGymDays}
              </span>
              <span className="text-sm text-muted">avg pomodoros on rest days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className="glass-card glass-card--static mb-lg">
        <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>🗓️ Activity Heatmap</h3>
        <CalendarHeatmap data={stats.heatmapData} />
      </div>
    </div>
  )
}

function CalendarHeatmap({ data }) {
  const heatmap = {}
  data.forEach(d => { heatmap[d.date] = d.count })

  // Generate last 180 days
  const days = []
  for (let i = 179; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({ date: key, count: heatmap[key] || 0, day: d.getDay() })
  }

  // Group into weeks
  const weeks = []
  let currentWeek = []
  days.forEach(d => {
    if (d.day === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(d)
  })
  if (currentWeek.length > 0) weeks.push(currentWeek)

  function getColor(count) {
    if (count === 0) return 'var(--bg-input)'
    if (count <= 2) return '#1a4731'
    if (count <= 4) return '#166534'
    if (count <= 6) return '#15803d'
    return '#22c55e'
  }

  return (
    <div className="heatmap">
      <div className="heatmap__grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap__week">
            {week.map((day, di) => (
              <div
                key={di}
                className="heatmap__day"
                style={{ background: getColor(day.count) }}
                title={`${day.date}: ${day.count} pomodoros`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap__legend">
        <span className="text-sm text-muted">Less</span>
        {[0, 2, 4, 6, 8].map(c => (
          <div key={c} className="heatmap__day" style={{ background: getColor(c), width: 12, height: 12 }} />
        ))}
        <span className="text-sm text-muted">More</span>
      </div>
    </div>
  )
}

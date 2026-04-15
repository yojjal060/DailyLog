const API_BASE = import.meta.env.VITE_API_URL || '/api';
const API = API_BASE.replace(/\/$/, '');

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Check-ins ──────────────────────────────────────────
export const getCheckinToday = () => request('/checkins/today');
export const getCheckins = (limit = 30) => request(`/checkins?limit=${limit}`);
export const saveCheckin = (data) => request('/checkins', {
  method: 'POST', body: JSON.stringify(data)
});

// ─── Missions ───────────────────────────────────────────
export const getMissionToday = () => request('/missions/today');
export const getMissions = (limit = 30) => request(`/missions?limit=${limit}`);
export const createMission = (data) => request('/missions', {
  method: 'POST', body: JSON.stringify(data)
});
export const updateMission = (id, data) => request(`/missions/${id}`, {
  method: 'PATCH', body: JSON.stringify(data)
});

// ─── Wins ───────────────────────────────────────────────
export const getWinsToday = () => request('/wins/today');
export const getWins = (limit = 50) => request(`/wins?limit=${limit}`);
export const createWin = (data) => request('/wins', {
  method: 'POST', body: JSON.stringify(data)
});

// ─── Pomodoros ───────────────────────────────────────────
export const getPomodoros = (date) => request(`/pomodoros${date ? `?date=${date}` : ''}`);
export const createPomodoro = (data) => request('/pomodoros', {
  method: 'POST', body: JSON.stringify(data)
});
export const completePomodoro = (id) => request(`/pomodoros/${id}`, {
  method: 'PATCH', body: JSON.stringify({ completed: true })
});

// ─── Streaks ────────────────────────────────────────────
export const getStreak = () => request('/streaks');
export const updateStreak = () => request('/streaks/update', { method: 'POST' });

// ─── Mission Pool ───────────────────────────────────────
export const getMissionPool = (category) => request(`/mission-pool${category ? `?category=${category}` : ''}`);
export const addToMissionPool = (data) => request('/mission-pool', {
  method: 'POST', body: JSON.stringify(data)
});
export const updatePoolMission = (id, data) => request(`/mission-pool/${id}`, {
  method: 'PATCH', body: JSON.stringify(data)
});
export const deletePoolMission = (id) => request(`/mission-pool/${id}`, {
  method: 'DELETE'
});

// ─── Settings ───────────────────────────────────────────
export const getSettings = () => request('/settings');
export const updateSettings = (data) => request('/settings', {
  method: 'PATCH', body: JSON.stringify(data)
});

// ─── Dashboard Stats ────────────────────────────────────
export const getStats = () => request('/stats');

// ─── History ────────────────────────────────────────────
export const getHistory = (limit = 30, offset = 0, search = '') => 
  request(`/history?limit=${limit}&offset=${offset}${search ? `&search=${search}` : ''}`);

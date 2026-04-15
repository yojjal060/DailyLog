import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : null;

app.use(cors(corsOrigin ? { origin: corsOrigin } : {}));
app.use(express.json());

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'warroom.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;

async function setupDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA foreign_keys = ON;');

  // ─── Schema ────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      energy INTEGER NOT NULL CHECK(energy BETWEEN 1 AND 5),
      gym TEXT NOT NULL DEFAULT 'no' CHECK(gym IN ('yes','no','later')),
      sleep_hours REAL NOT NULL,
      mood_note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS mission_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      pool_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      estimated_blocks INTEGER DEFAULT 2,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','skipped')),
      pomodoros_used INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (pool_id) REFERENCES mission_pool(id)
    );

    CREATE TABLE IF NOT EXISTS wins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      mission_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mission_id INTEGER,
      duration_minutes INTEGER DEFAULT 25,
      completed INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now','localtime')),
      ended_at TEXT,
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT UNIQUE DEFAULT 'daily',
      current_count INTEGER DEFAULT 0,
      longest_count INTEGER DEFAULT 0,
      last_active_date TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      focus_duration INTEGER DEFAULT 25,
      break_duration INTEGER DEFAULT 5,
      name TEXT DEFAULT 'Yojjal',
      goals_text TEXT DEFAULT 'Get job-ready in coding'
    );
  `);

  // ─── Seed defaults ─────────────────────────────────────────
  const streakExists = await db.get('SELECT COUNT(*) as c FROM streaks');
  if (streakExists.c === 0) {
    await db.run('INSERT INTO streaks (type, current_count, longest_count) VALUES (?, 0, 0)', ['daily']);
  }

  const settingsExists = await db.get('SELECT COUNT(*) as c FROM settings');
  if (settingsExists.c === 0) {
    await db.run('INSERT INTO settings (id, name) VALUES (1, ?)', ['Yojjal']);
  }
}

setupDatabase().then(() => {
  // ─── API Routes ────────────────────────────────────────────

  app.get('/api/health', async (req, res) => {
    const now = await db.get("SELECT datetime('now') as now");
    res.json({ ok: true, now: now?.now || null });
  });

  // --- Check-ins ---
  app.get('/api/checkins', async (req, res) => {
    const { limit = 30, offset = 0 } = req.query;
    const rows = await db.all('SELECT * FROM check_ins ORDER BY date DESC LIMIT ? OFFSET ?', [Number(limit), Number(offset)]);
    res.json(rows);
  });

  app.get('/api/checkins/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const row = await db.get('SELECT * FROM check_ins WHERE date = ?', [today]);
    res.json(row || null);
  });

  app.post('/api/checkins', async (req, res) => {
    const { date, energy, gym, sleep_hours, mood_note } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      await db.run(`
        INSERT INTO check_ins (date, energy, gym, sleep_hours, mood_note)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          energy = excluded.energy,
          gym = excluded.gym,
          sleep_hours = excluded.sleep_hours,
          mood_note = excluded.mood_note
      `, [d, energy, gym || 'no', sleep_hours, mood_note || '']);
      const row = await db.get('SELECT * FROM check_ins WHERE date = ?', [d]);
      res.json(row);
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Missions ---
  app.get('/api/missions/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const row = await db.get('SELECT * FROM missions WHERE date = ? ORDER BY id DESC LIMIT 1', [today]);
    res.json(row || null);
  });

  app.get('/api/missions', async (req, res) => {
    const { limit = 30 } = req.query;
    const rows = await db.all('SELECT * FROM missions ORDER BY date DESC LIMIT ?', [Number(limit)]);
    res.json(rows);
  });

  app.post('/api/missions', async (req, res) => {
    const { date, pool_id, title, description, category, difficulty, estimated_blocks } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      const result = await db.run(`
        INSERT INTO missions (date, pool_id, title, description, category, difficulty, estimated_blocks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [d, pool_id || null, title, description || '', category, difficulty, estimated_blocks || 2]);
      const row = await db.get('SELECT * FROM missions WHERE id = ?', [result.lastID]);
      res.json(row);
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch('/api/missions/:id', async (req, res) => {
    const { status, pomodoros_used } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (status === 'completed') { updates.push("completed_at = datetime('now','localtime')"); }
    if (pomodoros_used !== undefined) { updates.push('pomodoros_used = ?'); params.push(pomodoros_used); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await db.run(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await db.get('SELECT * FROM missions WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  // --- Wins ---
  app.get('/api/wins', async (req, res) => {
    const { date, limit = 50 } = req.query;
    if (date) {
      const rows = await db.all('SELECT * FROM wins WHERE date = ? ORDER BY created_at DESC', [date]);
      res.json(rows);
    } else {
      const rows = await db.all('SELECT * FROM wins ORDER BY created_at DESC LIMIT ?', [Number(limit)]);
      res.json(rows);
    }
  });

  app.get('/api/wins/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.all('SELECT * FROM wins WHERE date = ? ORDER BY created_at ASC', [today]);
    res.json(rows);
  });

  app.post('/api/wins', async (req, res) => {
    const { date, text, mission_id } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      const result = await db.run('INSERT INTO wins (date, text, mission_id) VALUES (?, ?, ?)', [d, text, mission_id || null]);
      const row = await db.get('SELECT * FROM wins WHERE id = ?', [result.lastID]);
      res.json(row);
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Pomodoro Sessions ---
  app.get('/api/pomodoros', async (req, res) => {
    const { date, limit = 50 } = req.query;
    if (date) {
      const rows = await db.all('SELECT * FROM pomodoro_sessions WHERE date = ? ORDER BY started_at DESC', [date]);
      res.json(rows);
    } else {
      const rows = await db.all('SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?', [Number(limit)]);
      res.json(rows);
    }
  });

  app.post('/api/pomodoros', async (req, res) => {
    const { date, mission_id, duration_minutes } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    const result = await db.run('INSERT INTO pomodoro_sessions (date, mission_id, duration_minutes) VALUES (?, ?, ?)', [d, mission_id || null, duration_minutes || 25]);
    const row = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [result.lastID]);
    res.json(row);
  });

  app.patch('/api/pomodoros/:id', async (req, res) => {
    const { completed } = req.body;
    await db.run("UPDATE pomodoro_sessions SET completed = ?, ended_at = datetime('now','localtime') WHERE id = ?", [completed ? 1 : 0, req.params.id]);
    const row = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  // --- Streaks ---
  app.get('/api/streaks', async (req, res) => {
    const row = await db.get('SELECT * FROM streaks WHERE type = ?', ['daily']);
    res.json(row);
  });

  app.post('/api/streaks/update', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const streak = await db.get('SELECT * FROM streaks WHERE type = ?', ['daily']);
    
    if (streak.last_active_date === today) {
      return res.json(streak);
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newCount;
    if (streak.last_active_date === yesterday) {
      newCount = streak.current_count + 1;
    } else {
      newCount = 1;
    }

    const newLongest = Math.max(newCount, streak.longest_count);
    await db.run('UPDATE streaks SET current_count = ?, longest_count = ?, last_active_date = ? WHERE type = ?', [newCount, newLongest, today, 'daily']);
    
    const updated = await db.get('SELECT * FROM streaks WHERE type = ?', ['daily']);
    res.json(updated);
  });

  // --- Mission Pool ---
  app.get('/api/mission-pool', async (req, res) => {
    const { category } = req.query;
    if (category) {
      const rows = await db.all('SELECT * FROM mission_pool WHERE category = ? AND active = 1', [category]);
      res.json(rows);
    } else {
      const rows = await db.all('SELECT * FROM mission_pool WHERE active = 1 ORDER BY category, difficulty');
      res.json(rows);
    }
  });

  app.post('/api/mission-pool', async (req, res) => {
    const { title, description, category, difficulty } = req.body;
    const result = await db.run('INSERT INTO mission_pool (title, description, category, difficulty) VALUES (?, ?, ?, ?)', [title, description || '', category, difficulty]);
    const row = await db.get('SELECT * FROM mission_pool WHERE id = ?', [result.lastID]);
    res.json(row);
  });

  app.patch('/api/mission-pool/:id', async (req, res) => {
    const { title, description, category, difficulty, active } = req.body;
    const updates = [];
    const params = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); params.push(difficulty); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    params.push(req.params.id);
    await db.run(`UPDATE mission_pool SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await db.get('SELECT * FROM mission_pool WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  app.delete('/api/mission-pool/:id', async (req, res) => {
    await db.run('DELETE FROM mission_pool WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // --- Settings ---
  app.get('/api/settings', async (req, res) => {
    const row = await db.get('SELECT * FROM settings WHERE id = 1');
    res.json(row);
  });

  app.patch('/api/settings', async (req, res) => {
    const { focus_duration, break_duration, name, goals_text } = req.body;
    const updates = [];
    const params = [];
    if (focus_duration !== undefined) { updates.push('focus_duration = ?'); params.push(focus_duration); }
    if (break_duration !== undefined) { updates.push('break_duration = ?'); params.push(break_duration); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (goals_text !== undefined) { updates.push('goals_text = ?'); params.push(goals_text); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    await db.run(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`, params);
    const row = await db.get('SELECT * FROM settings WHERE id = 1');
    res.json(row);
  });

  // --- Dashboard stats ---
  app.get('/api/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const totalWinsRes = await db.get('SELECT COUNT(*) as count FROM wins');
    const totalMissionsRes = await db.get("SELECT COUNT(*) as count FROM missions WHERE status = 'completed'");
    const avgEnergyRes = await db.get('SELECT AVG(energy) as avg FROM check_ins');
    const streak = await db.get('SELECT * FROM streaks WHERE type = ?', ['daily']);
    const totalPomodorosRes = await db.get('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE completed = 1');
    
    const dailyActivity = await db.all(`
      SELECT date, 
        COUNT(DISTINCT p.id) as pomodoro_count,
        (SELECT COUNT(*) FROM wins w WHERE w.date = p.date) as win_count
      FROM pomodoro_sessions p
      WHERE p.date >= date('now', '-30 days', 'localtime')
      GROUP BY date ORDER BY date
    `);
    
    const energyTrend = await db.all(`
      SELECT date, energy FROM check_ins 
      WHERE date >= date('now', '-30 days', 'localtime')
      ORDER BY date
    `);
    
    const categoryDist = await db.all(`
      SELECT category, COUNT(*) as count FROM missions 
      WHERE status = 'completed'
      GROUP BY category
    `);

    const gymDays = await db.get(`
      SELECT AVG(sub.pcount) as avg_pomodoros FROM (
        SELECT c.date, COUNT(p.id) as pcount
        FROM check_ins c
        LEFT JOIN pomodoro_sessions p ON p.date = c.date AND p.completed = 1
        WHERE c.gym = 'yes'
        GROUP BY c.date
      ) sub
    `);

    const noGymDays = await db.get(`
      SELECT AVG(sub.pcount) as avg_pomodoros FROM (
        SELECT c.date, COUNT(p.id) as pcount
        FROM check_ins c
        LEFT JOIN pomodoro_sessions p ON p.date = c.date AND p.completed = 1
        WHERE c.gym = 'no'
        GROUP BY c.date
      ) sub
    `);
    
    const heatmapData = await db.all(`
      SELECT date, COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 AND date >= date('now', '-180 days', 'localtime')
      GROUP BY date
    `);

    const thisWeekPomodoros = await db.get(`
      SELECT COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 AND date >= date('now', 'weekday 0', '-7 days', 'localtime')
    `);

    const lastWeekPomodoros = await db.get(`
      SELECT COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 
      AND date >= date('now', 'weekday 0', '-14 days', 'localtime')
      AND date < date('now', 'weekday 0', '-7 days', 'localtime')
    `);

    res.json({
      totalWins: totalWinsRes.count,
      totalMissions: totalMissionsRes.count,
      totalPomodoros: totalPomodorosRes.count,
      avgEnergy: Math.round((avgEnergyRes.avg || 0) * 10) / 10,
      streak: streak || { current_count: 0, longest_count: 0 },
      dailyActivity,
      energyTrend,
      categoryDist,
      gymCorrelation: {
        gymDays: Math.round((gymDays.avg_pomodoros || 0) * 10) / 10,
        noGymDays: Math.round((noGymDays.avg_pomodoros || 0) * 10) / 10
      },
      heatmapData,
      thisWeekPomodoros: thisWeekPomodoros.count,
      lastWeekPomodoros: lastWeekPomodoros.count
    });
  });

  // --- History ---
  app.get('/api/history', async (req, res) => {
    const { limit = 30, offset = 0, search } = req.query;
    
    let days = await db.all(`
      SELECT DISTINCT date FROM (
        SELECT date FROM check_ins
        UNION SELECT date FROM missions
        UNION SELECT date FROM wins
        UNION SELECT date FROM pomodoro_sessions
      ) ORDER BY date DESC LIMIT ? OFFSET ?
    `, [Number(limit), Number(offset)]);

    const result = [];
    for (const d of days) {
      const checkIn = await db.get('SELECT * FROM check_ins WHERE date = ?', [d.date]);
      const missions = await db.all('SELECT * FROM missions WHERE date = ?', [d.date]);
      let wins;
      if (search) {
        wins = await db.all('SELECT * FROM wins WHERE date = ? AND text LIKE ? ORDER BY created_at ASC', [d.date, `%${search}%`]);
      } else {
        wins = await db.all('SELECT * FROM wins WHERE date = ? ORDER BY created_at ASC', [d.date]);
      }
      const pomodoroRes = await db.get('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE date = ? AND completed = 1', [d.date]);
      
      if (search && wins.length === 0) continue; // Filter by search if applied

      result.push({ date: d.date, checkIn, missions, wins, pomodoroCount: pomodoroRes.count });
    }

    res.json(result);
  });

  // ─── Start ─────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`War Room API running on port ${PORT}`);
  });
}).catch(e => {
  console.error("Failed to start server", e);
});

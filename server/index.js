import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes('*');

const corsOptions = {
  origin(origin, callback) {
    if (allowAllOrigins) return callback(null, true);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const missingDbEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(key => !process.env[key]);
if (missingDbEnv.length > 0) {
  console.error(`Missing required database env vars: ${missingDbEnv.join(', ')}`);
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});

async function dbAll(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

async function setupDatabase() {
  // ─── Schema ────────────────────────────────────────────────
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS check_ins (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      date DATE UNIQUE NOT NULL,
      energy TINYINT NOT NULL,
      gym VARCHAR(10) NOT NULL DEFAULT 'no',
      sleep_hours DECIMAL(4,1) NOT NULL,
      mood_note TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mission_pool (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      difficulty TINYINT NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS missions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      date DATE NOT NULL,
      pool_id BIGINT UNSIGNED,
      title TEXT NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      difficulty TINYINT NOT NULL,
      estimated_blocks INT NOT NULL DEFAULT 2,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      pomodoros_used INT NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pool_id) REFERENCES mission_pool(id)
    )`,
    `CREATE TABLE IF NOT EXISTS wins (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      date DATE NOT NULL,
      text TEXT NOT NULL,
      mission_id BIGINT UNSIGNED,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      date DATE NOT NULL,
      mission_id BIGINT UNSIGNED,
      duration_minutes INT NOT NULL DEFAULT 25,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME NULL,
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS streaks (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      type VARCHAR(20) UNIQUE NOT NULL,
      current_count INT NOT NULL DEFAULT 0,
      longest_count INT NOT NULL DEFAULT 0,
      last_active_date DATE NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id TINYINT PRIMARY KEY,
      focus_duration INT NOT NULL DEFAULT 25,
      break_duration INT NOT NULL DEFAULT 5,
      name VARCHAR(255) NOT NULL DEFAULT 'Yojjal',
      goals_text TEXT
    )`
  ];

  for (const sql of schemaStatements) {
    await dbRun(sql);
  }

  // ─── Seed defaults ─────────────────────────────────────────
  const streakExists = await dbGet('SELECT COUNT(*) as c FROM streaks');
  if (streakExists.c === 0) {
    await dbRun('INSERT INTO streaks (type, current_count, longest_count) VALUES (?, 0, 0)', ['daily']);
  }

  const settingsExists = await dbGet('SELECT COUNT(*) as c FROM settings');
  if (settingsExists.c === 0) {
    await dbRun('INSERT INTO settings (id, name) VALUES (1, ?)', ['Yojjal']);
  }
}

setupDatabase().then(() => {
  // ─── API Routes ────────────────────────────────────────────

  app.get('/api/health', async (req, res) => {
    const now = await dbGet('SELECT NOW() as now');
    res.json({ ok: true, now: now?.now || null });
  });

  // --- Check-ins ---
  app.get('/api/checkins', async (req, res) => {
    const { limit = 30, offset = 0 } = req.query;
    const rows = await dbAll('SELECT * FROM check_ins ORDER BY date DESC LIMIT ? OFFSET ?', [Number(limit), Number(offset)]);
    res.json(rows);
  });

  app.get('/api/checkins/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const row = await dbGet('SELECT * FROM check_ins WHERE date = ?', [today]);
    res.json(row || null);
  });

  app.post('/api/checkins', async (req, res) => {
    const { date, energy, gym, sleep_hours, mood_note } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      await dbRun(`
        INSERT INTO check_ins (date, energy, gym, sleep_hours, mood_note)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          energy = VALUES(energy),
          gym = VALUES(gym),
          sleep_hours = VALUES(sleep_hours),
          mood_note = VALUES(mood_note)
      `, [d, energy, gym || 'no', sleep_hours, mood_note || '']);
      const row = await dbGet('SELECT * FROM check_ins WHERE date = ?', [d]);
      res.json(row);
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Missions ---
  app.get('/api/missions/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const row = await dbGet('SELECT * FROM missions WHERE date = ? ORDER BY id DESC LIMIT 1', [today]);
    res.json(row || null);
  });

  app.get('/api/missions', async (req, res) => {
    const { limit = 30 } = req.query;
    const rows = await dbAll('SELECT * FROM missions ORDER BY date DESC LIMIT ?', [Number(limit)]);
    res.json(rows);
  });

  app.post('/api/missions', async (req, res) => {
    const { date, pool_id, title, description, category, difficulty, estimated_blocks } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      const result = await dbRun(`
        INSERT INTO missions (date, pool_id, title, description, category, difficulty, estimated_blocks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [d, pool_id || null, title, description || '', category, difficulty, estimated_blocks || 2]);
      const row = await dbGet('SELECT * FROM missions WHERE id = ?', [result.insertId]);
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
    if (status === 'completed') { updates.push('completed_at = NOW()'); }
    if (pomodoros_used !== undefined) { updates.push('pomodoros_used = ?'); params.push(pomodoros_used); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await dbRun(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await dbGet('SELECT * FROM missions WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  // --- Wins ---
  app.get('/api/wins', async (req, res) => {
    const { date, limit = 50 } = req.query;
    if (date) {
      const rows = await dbAll('SELECT * FROM wins WHERE date = ? ORDER BY created_at DESC', [date]);
      res.json(rows);
    } else {
      const rows = await dbAll('SELECT * FROM wins ORDER BY created_at DESC LIMIT ?', [Number(limit)]);
      res.json(rows);
    }
  });

  app.get('/api/wins/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await dbAll('SELECT * FROM wins WHERE date = ? ORDER BY created_at ASC', [today]);
    res.json(rows);
  });

  app.post('/api/wins', async (req, res) => {
    const { date, text, mission_id } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    try {
      const result = await dbRun('INSERT INTO wins (date, text, mission_id) VALUES (?, ?, ?)', [d, text, mission_id || null]);
      const row = await dbGet('SELECT * FROM wins WHERE id = ?', [result.insertId]);
      res.json(row);
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Pomodoro Sessions ---
  app.get('/api/pomodoros', async (req, res) => {
    const { date, limit = 50 } = req.query;
    if (date) {
      const rows = await dbAll('SELECT * FROM pomodoro_sessions WHERE date = ? ORDER BY started_at DESC', [date]);
      res.json(rows);
    } else {
      const rows = await dbAll('SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?', [Number(limit)]);
      res.json(rows);
    }
  });

  app.post('/api/pomodoros', async (req, res) => {
    const { date, mission_id, duration_minutes } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    const result = await dbRun('INSERT INTO pomodoro_sessions (date, mission_id, duration_minutes) VALUES (?, ?, ?)', [d, mission_id || null, duration_minutes || 25]);
    const row = await dbGet('SELECT * FROM pomodoro_sessions WHERE id = ?', [result.insertId]);
    res.json(row);
  });

  app.patch('/api/pomodoros/:id', async (req, res) => {
    const { completed } = req.body;
    await dbRun('UPDATE pomodoro_sessions SET completed = ?, ended_at = NOW() WHERE id = ?', [completed ? 1 : 0, req.params.id]);
    const row = await dbGet('SELECT * FROM pomodoro_sessions WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  // --- Streaks ---
  app.get('/api/streaks', async (req, res) => {
    const row = await dbGet('SELECT * FROM streaks WHERE type = ?', ['daily']);
    res.json(row);
  });

  app.post('/api/streaks/update', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const streak = await dbGet('SELECT * FROM streaks WHERE type = ?', ['daily']);
    
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
    await dbRun('UPDATE streaks SET current_count = ?, longest_count = ?, last_active_date = ? WHERE type = ?', [newCount, newLongest, today, 'daily']);
    
    const updated = await dbGet('SELECT * FROM streaks WHERE type = ?', ['daily']);
    res.json(updated);
  });

  // --- Mission Pool ---
  app.get('/api/mission-pool', async (req, res) => {
    const { category } = req.query;
    if (category) {
      const rows = await dbAll('SELECT * FROM mission_pool WHERE category = ? AND active = 1', [category]);
      res.json(rows);
    } else {
      const rows = await dbAll('SELECT * FROM mission_pool WHERE active = 1 ORDER BY category, difficulty');
      res.json(rows);
    }
  });

  app.post('/api/mission-pool', async (req, res) => {
    const { title, description, category, difficulty } = req.body;
    const result = await dbRun('INSERT INTO mission_pool (title, description, category, difficulty) VALUES (?, ?, ?, ?)', [title, description || '', category, difficulty]);
    const row = await dbGet('SELECT * FROM mission_pool WHERE id = ?', [result.insertId]);
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
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await dbRun(`UPDATE mission_pool SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await dbGet('SELECT * FROM mission_pool WHERE id = ?', [req.params.id]);
    res.json(row);
  });

  app.delete('/api/mission-pool/:id', async (req, res) => {
    await dbRun('DELETE FROM mission_pool WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // --- Settings ---
  app.get('/api/settings', async (req, res) => {
    const row = await dbGet('SELECT * FROM settings WHERE id = 1');
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
    await dbRun(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`, params);
    const row = await dbGet('SELECT * FROM settings WHERE id = 1');
    res.json(row);
  });

  // --- Dashboard stats ---
  app.get('/api/stats', async (req, res) => {
    const last30Days = dateDaysAgo(30);
    const last180Days = dateDaysAgo(180);
    const thisWeekStart = dateDaysAgo(7);
    const lastWeekStart = dateDaysAgo(14);
    
    const totalWinsRes = await dbGet('SELECT COUNT(*) as count FROM wins');
    const totalMissionsRes = await dbGet("SELECT COUNT(*) as count FROM missions WHERE status = 'completed'");
    const avgEnergyRes = await dbGet('SELECT AVG(energy) as avg FROM check_ins');
    const streak = await dbGet('SELECT * FROM streaks WHERE type = ?', ['daily']);
    const totalPomodorosRes = await dbGet('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE completed = 1');
    
    const dailyActivity = await dbAll(`
      SELECT date, 
        COUNT(DISTINCT p.id) as pomodoro_count,
        (SELECT COUNT(*) FROM wins w WHERE w.date = p.date) as win_count
      FROM pomodoro_sessions p
      WHERE p.date >= ?
      GROUP BY date ORDER BY date
    `, [last30Days]);
    
    const energyTrend = await dbAll(`
      SELECT date, energy FROM check_ins 
      WHERE date >= ?
      ORDER BY date
    `, [last30Days]);
    
    const categoryDist = await dbAll(`
      SELECT category, COUNT(*) as count FROM missions 
      WHERE status = 'completed'
      GROUP BY category
    `);

    const gymDays = await dbGet(`
      SELECT AVG(sub.pcount) as avg_pomodoros FROM (
        SELECT c.date, COUNT(p.id) as pcount
        FROM check_ins c
        LEFT JOIN pomodoro_sessions p ON p.date = c.date AND p.completed = 1
        WHERE c.gym = 'yes'
        GROUP BY c.date
      ) sub
    `);

    const noGymDays = await dbGet(`
      SELECT AVG(sub.pcount) as avg_pomodoros FROM (
        SELECT c.date, COUNT(p.id) as pcount
        FROM check_ins c
        LEFT JOIN pomodoro_sessions p ON p.date = c.date AND p.completed = 1
        WHERE c.gym = 'no'
        GROUP BY c.date
      ) sub
    `);
    
    const heatmapData = await dbAll(`
      SELECT date, COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 AND date >= ?
      GROUP BY date
    `, [last180Days]);

    const thisWeekPomodoros = await dbGet(`
      SELECT COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 AND date >= ?
    `, [thisWeekStart]);

    const lastWeekPomodoros = await dbGet(`
      SELECT COUNT(*) as count FROM pomodoro_sessions 
      WHERE completed = 1 
      AND date >= ?
      AND date < ?
    `, [lastWeekStart, thisWeekStart]);

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
    
    let days = await dbAll(`
      SELECT DISTINCT date FROM (
        SELECT date FROM check_ins
        UNION SELECT date FROM missions
        UNION SELECT date FROM wins
        UNION SELECT date FROM pomodoro_sessions
      ) all_dates ORDER BY date DESC LIMIT ? OFFSET ?
    `, [Number(limit), Number(offset)]);

    const result = [];
    for (const d of days) {
      const checkIn = await dbGet('SELECT * FROM check_ins WHERE date = ?', [d.date]);
      const missions = await dbAll('SELECT * FROM missions WHERE date = ?', [d.date]);
      let wins;
      if (search) {
        wins = await dbAll('SELECT * FROM wins WHERE date = ? AND text LIKE ? ORDER BY created_at ASC', [d.date, `%${search}%`]);
      } else {
        wins = await dbAll('SELECT * FROM wins WHERE date = ? ORDER BY created_at ASC', [d.date]);
      }
      const pomodoroRes = await dbGet('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE date = ? AND completed = 1', [d.date]);
      
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

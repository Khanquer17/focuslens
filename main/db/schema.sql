CREATE TABLE IF NOT EXISTS usage_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_bundle_id TEXT,
  app_name TEXT NOT NULL,
  window_title TEXT,
  url TEXT,
  domain TEXT,
  category TEXT NOT NULL DEFAULT 'neutral',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER DEFAULT 0,
  was_afk INTEGER DEFAULT 0,
  was_sleep INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_started ON usage_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON usage_sessions(category);

CREATE TABLE IF NOT EXISTS category_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  category TEXT NOT NULL,
  is_default INTEGER DEFAULT 1,
  UNIQUE(match_type, match_value)
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  total_tracked_seconds INTEGER DEFAULT 0,
  productive_seconds INTEGER DEFAULT 0,
  neutral_seconds INTEGER DEFAULT 0,
  distracting_seconds INTEGER DEFAULT 0,
  focus_score REAL DEFAULT 0,
  app_switch_count INTEGER DEFAULT 0,
  avg_focus_duration_seconds INTEGER DEFAULT 0,
  focus_session_count INTEGER DEFAULT 0,
  top_apps TEXT
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  primary_app TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whoop_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  recovery_score REAL,
  hrv_milliseconds REAL,
  resting_heart_rate REAL,
  strain_score REAL,
  sleep_performance REAL,
  stress_score REAL,
  fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attention_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  app_switches INTEGER DEFAULT 0,
  avg_focus_duration_seconds INTEGER DEFAULT 0,
  UNIQUE(date, hour)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS whoop_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  due_date TEXT,
  type TEXT NOT NULL DEFAULT 'work',
  status TEXT NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  started_at TEXT,
  completed_at TEXT,
  time_in_progress_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

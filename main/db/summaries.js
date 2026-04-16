const { getDb } = require('./database');

function upsertDailySummary(dateStr, metrics) {
  const db = getDb();
  db.prepare(`
    INSERT INTO daily_summaries (date, total_tracked_seconds, productive_seconds, neutral_seconds, distracting_seconds, focus_score, app_switch_count, avg_focus_duration_seconds, focus_session_count, top_apps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_tracked_seconds = excluded.total_tracked_seconds,
      productive_seconds = excluded.productive_seconds,
      neutral_seconds = excluded.neutral_seconds,
      distracting_seconds = excluded.distracting_seconds,
      focus_score = excluded.focus_score,
      app_switch_count = excluded.app_switch_count,
      avg_focus_duration_seconds = excluded.avg_focus_duration_seconds,
      focus_session_count = excluded.focus_session_count,
      top_apps = excluded.top_apps
  `).run(
    dateStr,
    metrics.totalTrackedSeconds,
    metrics.productiveSeconds,
    metrics.neutralSeconds,
    metrics.distractingSeconds,
    metrics.focusScore,
    metrics.appSwitchCount,
    metrics.avgFocusDurationSeconds,
    metrics.focusSessionCount,
    JSON.stringify(metrics.topApps || [])
  );
}

function upsertAttentionMetric(dateStr, hour, switches, avgFocusDuration) {
  const db = getDb();
  db.prepare(`
    INSERT INTO attention_metrics (date, hour, app_switches, avg_focus_duration_seconds)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date, hour) DO UPDATE SET
      app_switches = excluded.app_switches,
      avg_focus_duration_seconds = excluded.avg_focus_duration_seconds
  `).run(dateStr, hour, switches, avgFocusDuration);
}

function insertFocusSession(session) {
  const db = getDb();
  db.prepare(`
    INSERT INTO focus_sessions (started_at, ended_at, duration_seconds, primary_app, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(session.started_at, session.ended_at, session.duration_seconds, session.primary_app, session.category);
}

function clearFocusSessionsForDate(dateStr) {
  const db = getDb();
  db.prepare('DELETE FROM focus_sessions WHERE date(started_at) = ?').run(dateStr);
}

function getDailySummary(dateStr) {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(dateStr);
}

function getDailySummariesRange(startDate, endDate) {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date ASC').all(startDate, endDate);
}

function getAttentionMetricsForDate(dateStr) {
  const db = getDb();
  return db.prepare('SELECT * FROM attention_metrics WHERE date = ? ORDER BY hour ASC').all(dateStr);
}

function getAttentionMetricsRange(startDate, endDate) {
  const db = getDb();
  return db.prepare('SELECT * FROM attention_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC, hour ASC').all(startDate, endDate);
}

function getFocusSessionsForDate(dateStr) {
  const db = getDb();
  return db.prepare('SELECT * FROM focus_sessions WHERE date(started_at) = ? ORDER BY started_at ASC').all(dateStr);
}

module.exports = {
  upsertDailySummary,
  upsertAttentionMetric,
  insertFocusSession,
  clearFocusSessionsForDate,
  getDailySummary,
  getDailySummariesRange,
  getAttentionMetricsForDate,
  getAttentionMetricsRange,
  getFocusSessionsForDate,
};

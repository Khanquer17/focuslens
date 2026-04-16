const { getDb } = require('./database');

function startSession({ appBundleId, appName, windowTitle, url, domain, category }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO usage_sessions (app_bundle_id, app_name, window_title, url, domain, category, started_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  const result = stmt.run(appBundleId || null, appName, windowTitle || null, url || null, domain || null, category || 'neutral');
  return result.lastInsertRowid;
}

function endSession(id, { wasAfk = false, wasSleep = false, endTime = null } = {}) {
  const db = getDb();
  if (endTime) {
    // Use explicit end time (e.g., exact sleep moment) to avoid including sleep in duration
    db.prepare(`
      UPDATE usage_sessions
      SET ended_at = ?,
          duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER),
          was_afk = ?, was_sleep = ?
      WHERE id = ?
    `).run(endTime, endTime, wasAfk ? 1 : 0, wasSleep ? 1 : 0, id);
  } else {
    // Use current time (normal case)
    db.prepare(`
      UPDATE usage_sessions
      SET ended_at = datetime('now', 'localtime'),
          duration_seconds = CAST((julianday(datetime('now', 'localtime')) - julianday(started_at)) * 86400 AS INTEGER),
          was_afk = ?, was_sleep = ?
      WHERE id = ?
    `).run(wasAfk ? 1 : 0, wasSleep ? 1 : 0, id);
  }
}

function getCurrentSession() {
  const db = getDb();
  return db.prepare('SELECT * FROM usage_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get();
}

function getTodaySessions() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM usage_sessions
    WHERE date(started_at) = date('now', 'localtime')
    ORDER BY started_at ASC
  `).all();
}

function getTodayTotalSeconds() {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM usage_sessions
    WHERE date(started_at) = date('now', 'localtime')
      AND ended_at IS NOT NULL
      AND was_afk = 0
      AND was_sleep = 0
  `).get();
  return row.total;
}

function getSessionsForDate(dateStr) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM usage_sessions
    WHERE date(started_at) = ?
    ORDER BY started_at ASC
  `).all(dateStr);
}

function getSessionsForDateRange(startDate, endDate) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM usage_sessions
    WHERE date(started_at) >= ? AND date(started_at) <= ?
    ORDER BY started_at ASC
  `).all(startDate, endDate);
}

function getTodayByCategory() {
  const db = getDb();
  return db.prepare(`
    SELECT category, SUM(duration_seconds) as total_seconds, COUNT(*) as session_count
    FROM usage_sessions
    WHERE date(started_at) = date('now', 'localtime')
      AND ended_at IS NOT NULL
      AND was_afk = 0 AND was_sleep = 0
    GROUP BY category
  `).all();
}

function getTodayTopApps(limit = 10) {
  const db = getDb();
  // For browser sessions, show domain instead of browser app name
  return db.prepare(`
    SELECT
      CASE WHEN domain IS NOT NULL AND domain != '' THEN domain ELSE app_name END as app_name,
      category,
      SUM(duration_seconds) as total_seconds,
      COUNT(*) as session_count
    FROM usage_sessions
    WHERE date(started_at) = date('now', 'localtime')
      AND ended_at IS NOT NULL
      AND was_afk = 0 AND was_sleep = 0
    GROUP BY CASE WHEN domain IS NOT NULL AND domain != '' THEN domain ELSE app_name END
    ORDER BY total_seconds DESC
    LIMIT ?
  `).all(limit);
}

function getTodayTimeline() {
  const db = getDb();
  return db.prepare(`
    SELECT
      CASE WHEN domain IS NOT NULL AND domain != '' THEN domain ELSE app_name END as app_name,
      category, started_at, ended_at, duration_seconds, domain
    FROM usage_sessions
    WHERE date(started_at) = date('now', 'localtime')
      AND ended_at IS NOT NULL
      AND was_afk = 0 AND was_sleep = 0
    ORDER BY started_at ASC
  `).all();
}

/**
 * Get all distinct apps ever used, with total time.
 */
function getUsedApps() {
  const db = getDb();
  return db.prepare(`
    SELECT app_bundle_id, app_name, category,
           SUM(duration_seconds) as total_seconds,
           COUNT(*) as session_count,
           MAX(started_at) as last_used
    FROM usage_sessions
    WHERE ended_at IS NOT NULL AND was_afk = 0 AND was_sleep = 0
      AND app_bundle_id IS NOT NULL AND app_bundle_id != ''
    GROUP BY app_bundle_id
    ORDER BY total_seconds DESC
  `).all();
}

/**
 * Get all distinct domains ever visited, with total time.
 */
function getUsedDomains() {
  const db = getDb();
  return db.prepare(`
    SELECT domain, category,
           SUM(duration_seconds) as total_seconds,
           COUNT(*) as session_count,
           MAX(started_at) as last_used
    FROM usage_sessions
    WHERE ended_at IS NOT NULL AND was_afk = 0 AND was_sleep = 0
      AND domain IS NOT NULL AND domain != ''
    GROUP BY domain
    ORDER BY total_seconds DESC
  `).all();
}

/**
 * Retroactively update category for all sessions matching an app bundle ID.
 */
function updateCategoryForApp(bundleId, category) {
  const db = getDb();
  // Update all sessions for this app, but respect domain-specific overrides
  return db.prepare(`
    UPDATE usage_sessions SET category = ?
    WHERE app_bundle_id = ?
      AND (domain IS NULL OR domain = '' OR domain NOT IN (
        SELECT match_value FROM category_mappings WHERE match_type = 'domain'
      ))
  `).run(category, bundleId);
}

/**
 * Retroactively update category for all sessions matching a domain.
 */
function updateCategoryForDomain(domain, category) {
  const db = getDb();
  return db.prepare(`
    UPDATE usage_sessions SET category = ?
    WHERE domain = ?
  `).run(category, domain);
}

/**
 * Get all distinct apps ever used, excluding browsers (show domains instead).
 */
function getUsedAppsNonBrowser(browserBundleIds) {
  const db = getDb();
  const placeholders = browserBundleIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT app_bundle_id, app_name, category,
           SUM(duration_seconds) as total_seconds,
           COUNT(*) as session_count,
           MAX(started_at) as last_used
    FROM usage_sessions
    WHERE ended_at IS NOT NULL AND was_afk = 0 AND was_sleep = 0
      AND app_bundle_id IS NOT NULL AND app_bundle_id != ''
      AND (domain IS NULL OR domain = '')
      AND app_bundle_id NOT IN (${placeholders})
    GROUP BY app_bundle_id
    ORDER BY total_seconds DESC
  `).all(...browserBundleIds);
}

module.exports = {
  startSession,
  endSession,
  getCurrentSession,
  getTodaySessions,
  getTodayTotalSeconds,
  getSessionsForDate,
  getSessionsForDateRange,
  getTodayByCategory,
  getTodayTopApps,
  getTodayTimeline,
  getUsedApps,
  getUsedDomains,
  updateCategoryForApp,
  updateCategoryForDomain,
  getUsedAppsNonBrowser,
};

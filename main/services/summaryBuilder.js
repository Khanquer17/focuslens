const sessions = require('../db/sessions');
const summariesDb = require('../db/summaries');
const { computeMetrics } = require('./metricsCalculator');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildSummaryForDate(dateStr) {
  const daySessions = sessions.getSessionsForDate(dateStr);
  if (daySessions.length === 0) return null;

  const metrics = computeMetrics(daySessions);

  // Upsert daily summary
  summariesDb.upsertDailySummary(dateStr, metrics);

  // Upsert hourly attention metrics
  for (const [hour, data] of Object.entries(metrics.hourlyMetrics)) {
    summariesDb.upsertAttentionMetric(dateStr, parseInt(hour), data.appSwitches, data.avgFocusDurationSeconds);
  }

  // Rebuild focus sessions for the date
  summariesDb.clearFocusSessionsForDate(dateStr);
  for (const fs of metrics.focusSessions) {
    summariesDb.insertFocusSession(fs);
  }

  return metrics;
}

function buildTodaySummary() {
  return buildSummaryForDate(todayStr());
}

// Periodically rebuild today's summary
let summaryInterval = null;

function startPeriodicSummary(intervalMs = 60000) {
  // Build immediately
  buildTodaySummary();

  // Then every minute
  summaryInterval = setInterval(() => {
    try {
      buildTodaySummary();
    } catch (err) {
      console.error('[SummaryBuilder] Error:', err.message);
    }
  }, intervalMs);

  console.log('[SummaryBuilder] Started periodic summary (every 60s)');
}

function stopPeriodicSummary() {
  if (summaryInterval) {
    clearInterval(summaryInterval);
    summaryInterval = null;
  }
}

module.exports = { buildSummaryForDate, buildTodaySummary, startPeriodicSummary, stopPeriodicSummary };

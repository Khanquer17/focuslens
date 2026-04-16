// Pure functions - no DB dependencies. Takes arrays of session objects.

const PRODUCTIVE_CATEGORIES = new Set(['veryProductive', 'productive']);
const DISTRACTING_CATEGORIES = new Set(['distracting', 'veryDistracting']);

function isProductive(category) {
  return PRODUCTIVE_CATEGORIES.has(category);
}

function isDistracting(category) {
  return DISTRACTING_CATEGORIES.has(category);
}

function sumSeconds(sessions, filterFn = () => true) {
  return sessions
    .filter(s => s.ended_at && !s.was_afk && !s.was_sleep && filterFn(s))
    .reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
}

function appSwitchCount(sessions) {
  // Count transitions between different apps (excluding AFK/sleep)
  return sessions.filter(s => s.ended_at && !s.was_afk && !s.was_sleep).length;
}

function appSwitchesPerHour(sessions, hour) {
  return sessions.filter(s => {
    if (!s.started_at || s.was_afk || s.was_sleep) return false;
    const h = new Date(s.started_at).getHours();
    return h === hour;
  }).length;
}

function averageFocusDuration(sessions) {
  const valid = sessions.filter(s => s.ended_at && !s.was_afk && !s.was_sleep && s.duration_seconds > 0);
  if (valid.length === 0) return 0;
  const total = valid.reduce((sum, s) => sum + s.duration_seconds, 0);
  return Math.round(total / valid.length);
}

/**
 * Detect focus sessions: contiguous blocks of 30+ minutes in productive apps.
 * Allow brief interruptions (< 2 min of neutral) without breaking the session.
 */
function detectFocusSessions(sessions, minDurationSec = 1800) {
  const valid = sessions.filter(s => s.ended_at && !s.was_afk && !s.was_sleep);
  if (valid.length === 0) return [];

  const focusSessions = [];
  let currentStart = null;
  let currentEnd = null;
  let currentApp = null;
  let accumulatedProductiveSec = 0;
  let neutralGapSec = 0;

  for (const s of valid) {
    const cat = s.category;
    const dur = s.duration_seconds || 0;

    if (isProductive(cat)) {
      if (!currentStart) {
        currentStart = s.started_at;
        currentApp = s.app_name;
      }
      accumulatedProductiveSec += dur + neutralGapSec;
      neutralGapSec = 0;
      currentEnd = s.ended_at;
    } else if (cat === 'neutral' && currentStart && dur <= 120) {
      // Allow brief neutral gaps (< 2 min)
      neutralGapSec += dur;
      currentEnd = s.ended_at;
    } else {
      // Non-productive or long neutral - end the focus session
      if (currentStart && accumulatedProductiveSec >= minDurationSec) {
        focusSessions.push({
          started_at: currentStart,
          ended_at: currentEnd,
          duration_seconds: accumulatedProductiveSec,
          primary_app: currentApp,
          category: 'productive',
        });
      }
      currentStart = null;
      currentEnd = null;
      currentApp = null;
      accumulatedProductiveSec = 0;
      neutralGapSec = 0;
    }
  }

  // Close any remaining focus session
  if (currentStart && accumulatedProductiveSec >= minDurationSec) {
    focusSessions.push({
      started_at: currentStart,
      ended_at: currentEnd,
      duration_seconds: accumulatedProductiveSec,
      primary_app: currentApp,
      category: 'productive',
    });
  }

  return focusSessions;
}

/**
 * Focus score formula (0-100):
 * - 50% productive time ratio
 * - 30% deep focus sessions (30+ min blocks)
 * - 20% low context-switching
 */
function focusScore({ productiveSeconds, totalTrackedSeconds, focusSessionCount, switchCount }) {
  if (totalTrackedSeconds === 0) return 0;

  const productiveRatio = (productiveSeconds / totalTrackedSeconds) * 50;
  const focusBonus = Math.min(focusSessionCount * 10, 30);
  const expectedSwitches = (totalTrackedSeconds / 3600) * 30; // baseline ~30/hr
  const switchPenalty = expectedSwitches > 0
    ? Math.max(0, 20 - (switchCount / expectedSwitches) * 20)
    : 20;

  return Math.round(Math.min(100, productiveRatio + focusBonus + switchPenalty));
}

/**
 * Build complete metrics for a set of sessions (typically a day's worth).
 */
function computeMetrics(sessions) {
  const valid = sessions.filter(s => s.ended_at && !s.was_afk && !s.was_sleep);

  const totalTrackedSeconds = sumSeconds(sessions);
  const productiveSeconds = sumSeconds(sessions, s => isProductive(s.category));
  const neutralSeconds = sumSeconds(sessions, s => s.category === 'neutral');
  const distractingSeconds = sumSeconds(sessions, s => isDistracting(s.category));
  const switchCount = appSwitchCount(sessions);
  const avgFocusDuration = averageFocusDuration(sessions);
  const focusSessions = detectFocusSessions(sessions);

  const score = focusScore({
    productiveSeconds,
    totalTrackedSeconds,
    focusSessionCount: focusSessions.length,
    switchCount,
  });

  // Top apps by time
  const appTotals = {};
  for (const s of valid) {
    if (!appTotals[s.app_name]) {
      appTotals[s.app_name] = { name: s.app_name, seconds: 0, category: s.category };
    }
    appTotals[s.app_name].seconds += s.duration_seconds || 0;
  }
  const topApps = Object.values(appTotals)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10)
    .map(a => a.name);

  // Hourly attention metrics
  const hourlyMetrics = {};
  for (let h = 0; h < 24; h++) {
    const hourSessions = valid.filter(s => new Date(s.started_at).getHours() === h);
    if (hourSessions.length > 0) {
      hourlyMetrics[h] = {
        hour: h,
        appSwitches: hourSessions.length,
        avgFocusDurationSeconds: averageFocusDuration(hourSessions),
      };
    }
  }

  return {
    totalTrackedSeconds,
    productiveSeconds,
    neutralSeconds,
    distractingSeconds,
    focusScore: score,
    appSwitchCount: switchCount,
    avgFocusDurationSeconds: avgFocusDuration,
    focusSessionCount: focusSessions.length,
    focusSessions,
    topApps,
    hourlyMetrics,
  };
}

module.exports = {
  focusScore,
  appSwitchCount,
  appSwitchesPerHour,
  averageFocusDuration,
  detectFocusSessions,
  computeMetrics,
  isProductive,
  isDistracting,
};

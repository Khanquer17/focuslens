const { getActiveWindow, isBrowser } = require('./activeWindow');
const { getBrowserUrl, extractDomain } = require('./browserUrl');
const { IdleDetector } = require('./idleDetector');
const { SleepDetector } = require('./sleepDetector');
const sessions = require('../db/sessions');
const categoryService = require('../services/categoryService');
const { NotificationService } = require('../services/notificationService');
const { detectFocusSessions } = require('../services/metricsCalculator');

const POLL_INTERVAL_MS = 5000;
const MIN_SESSION_SECONDS = 2;

class TrackingEngine {
  constructor() {
    this.idleDetector = new IdleDetector();
    this.sleepDetector = new SleepDetector();
    this.notificationService = new NotificationService();
    this.currentSessionId = null;
    this.currentKey = null;
    this.interval = null;
    this.paused = false;
    this.sleeping = false;
    this.wasIdle = false;
    this._lastFocusCheck = 0;
  }

  start() {
    console.log('[Engine] Starting tracking');

    // Wire sleep/wake
    this.sleepDetector.onSleep = () => this._handleSleep();
    this.sleepDetector.onWake = () => this._handleWake();
    this.sleepDetector.start();

    // Schedule daily summary notification at 6 PM
    const summaryBuilder = require('../services/summaryBuilder');
    this.notificationService.scheduleDailySummary(18, () => {
      return summaryBuilder.buildTodaySummary();
    });

    this.interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    this._poll(); // immediate first poll
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this._closeCurrentSession();
    this.notificationService.destroy();
    console.log('[Engine] Stopped');
  }

  pause() {
    this.paused = true;
    this._closeCurrentSession();
    console.log('[Engine] Paused');
  }

  resume() {
    this.paused = false;
    console.log('[Engine] Resumed');
  }

  async _poll() {
    if (this.paused || this.sleeping) return;

    try {
      // Check idle
      if (this.idleDetector.isIdle()) {
        if (!this.wasIdle) {
          this.wasIdle = true;
          this._closeCurrentSession({ wasAfk: true });
        }
        return;
      }

      if (this.wasIdle) {
        this.wasIdle = false;
      }

      const win = await getActiveWindow();
      if (!win) return;

      let url = null;
      let domain = null;

      if (isBrowser(win.bundleId)) {
        url = getBrowserUrl(win.bundleId);
        domain = extractDomain(url);
      }

      const key = `${win.bundleId}|${domain || ''}`;

      if (key === this.currentKey && this.currentSessionId) {
        return;
      }

      // Different app/domain - close current, start new
      this._closeCurrentSession();

      const category = categoryService.categorize(win.bundleId, domain);

      this.currentSessionId = sessions.startSession({
        appBundleId: win.bundleId,
        appName: win.appName,
        windowTitle: win.windowTitle,
        url,
        domain,
        category,
      });
      this.currentKey = key;

      // Periodically check for new focus sessions (every 5 minutes)
      this._checkFocusSessions();
    } catch (err) {
      console.error('[Engine] Poll error:', err.message);
    }
  }

  _closeCurrentSession(opts = {}) {
    if (!this.currentSessionId) return;

    try {
      const session = sessions.getCurrentSession();
      if (session) {
        const startedAt = new Date(session.started_at);
        const endAt = opts.endTime ? new Date(opts.endTime) : new Date();
        const durationSec = (endAt - startedAt) / 1000;

        if (durationSec < MIN_SESSION_SECONDS) {
          const { getDb } = require('../db/database');
          getDb().prepare('DELETE FROM usage_sessions WHERE id = ?').run(this.currentSessionId);
        } else {
          sessions.endSession(this.currentSessionId, opts);

          // Notify about the closed session (for distraction tracking)
          const closed = sessions.getCurrentSession() || session;
          closed.duration_seconds = Math.round(durationSec);
          closed.was_afk = opts.wasAfk ? 1 : 0;
          closed.was_sleep = opts.wasSleep ? 1 : 0;
          this.notificationService.onSessionClosed(closed);
        }
      }
    } catch (err) {
      console.error('[Engine] Error closing session:', err.message);
    }

    this.currentSessionId = null;
    this.currentKey = null;
  }

  _checkFocusSessions() {
    const now = Date.now();
    if (now - this._lastFocusCheck < 5 * 60 * 1000) return; // every 5 min
    this._lastFocusCheck = now;

    try {
      const todaySessions = sessions.getTodaySessions();
      const focusSessions = detectFocusSessions(todaySessions);

      for (const fs of focusSessions) {
        this.notificationService.onFocusSessionComplete(fs);
      }
    } catch (err) {
      console.error('[Engine] Focus session check error:', err.message);
    }
  }

  _handleSleep() {
    this.sleeping = true;

    // Stop polling — prevents accumulated timers from firing on wake
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Capture the exact sleep moment so duration doesn't include sleep time
    const now = new Date();
    const endTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    this._closeCurrentSession({ wasSleep: true, endTime });

    console.log('[Engine] Paused for sleep');
  }

  _handleWake() {
    this.wasIdle = false;
    this.sleeping = false;

    // Brief delay before resuming — let the system fully wake up
    setTimeout(() => {
      if (!this.interval && !this.paused) {
        this.interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
        this._poll(); // immediate first poll after wake
        console.log('[Engine] Resumed after wake');
      }
    }, 3000);
  }

  setAfkThreshold(seconds) {
    this.idleDetector.setThreshold(seconds);
  }

  setDistractionThresholds(thresholds) {
    this.notificationService.updateThresholds(thresholds);
  }
}

module.exports = { TrackingEngine };

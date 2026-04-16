const { Notification } = require('electron');

const DEFAULT_THRESHOLDS = {
  distractingMinutes: 30,
  veryDistractingMinutes: 15,
};

class NotificationService {
  constructor() {
    this.runningTotals = {}; // category -> seconds
    this.lastAlertTime = {}; // category -> timestamp
    this.cooldownMs = 30 * 60 * 1000; // 30 minutes between same-category alerts
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    this.notifiedFocusSessions = new Set();
    this.dailySummaryTimeout = null;
  }

  updateThresholds(thresholds) {
    Object.assign(this.thresholds, thresholds);
  }

  resetDaily() {
    this.runningTotals = {};
    this.lastAlertTime = {};
    this.notifiedFocusSessions = new Set();
  }

  /**
   * Called by the engine after each session closes.
   */
  onSessionClosed(session) {
    if (session.was_afk || session.was_sleep) return;

    const cat = session.category;
    if (!this.runningTotals[cat]) this.runningTotals[cat] = 0;
    this.runningTotals[cat] += session.duration_seconds || 0;

    this._checkDistraction(cat);
  }

  _checkDistraction(category) {
    const totalMin = (this.runningTotals[category] || 0) / 60;
    let threshold = null;

    if (category === 'veryDistracting') {
      threshold = this.thresholds.veryDistractingMinutes;
    } else if (category === 'distracting') {
      threshold = this.thresholds.distractingMinutes;
    }

    if (!threshold || totalMin < threshold) return;

    // Check cooldown
    const now = Date.now();
    const lastAlert = this.lastAlertTime[category] || 0;
    if (now - lastAlert < this.cooldownMs) return;

    this.lastAlertTime[category] = now;

    const label = category === 'veryDistracting' ? 'very distracting' : 'distracting';
    this._send(
      'Distraction Alert',
      `You've spent ${Math.round(totalMin)} minutes on ${label} activities today.`,
    );
  }

  /**
   * Called when a new focus session is detected.
   */
  onFocusSessionComplete(focusSession) {
    const key = focusSession.started_at;
    if (this.notifiedFocusSessions.has(key)) return;
    this.notifiedFocusSessions.add(key);

    const minutes = Math.round(focusSession.duration_seconds / 60);
    this._send(
      'Focus Session Complete!',
      `Great work! ${minutes} minute focus session in ${focusSession.primary_app}.`,
    );
  }

  /**
   * Send daily summary notification.
   */
  sendDailySummary(metrics) {
    if (!metrics) return;

    const hours = (metrics.totalTrackedSeconds / 3600).toFixed(1);
    const prodHours = (metrics.productiveSeconds / 3600).toFixed(1);
    const score = metrics.focusScore;
    const focusCount = metrics.focusSessionCount;

    this._send(
      'Daily Summary',
      `${hours}h tracked, ${prodHours}h productive. Focus Score: ${score}. ${focusCount} deep focus session${focusCount !== 1 ? 's' : ''}.`,
    );
  }

  /**
   * Schedule daily summary notification at a given hour (default 18:00).
   */
  scheduleDailySummary(hour = 18, getSummaryFn) {
    this._clearDailySummaryTimer();

    const schedule = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(hour, 0, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      const delay = target - now;

      this.dailySummaryTimeout = setTimeout(() => {
        const metrics = getSummaryFn();
        if (metrics) {
          this.sendDailySummary(metrics);
        }
        this.resetDaily();
        // Schedule for next day
        schedule();
      }, delay);

      console.log(`[Notifications] Daily summary scheduled for ${target.toLocaleTimeString()}`);
    };

    schedule();
  }

  _clearDailySummaryTimer() {
    if (this.dailySummaryTimeout) {
      clearTimeout(this.dailySummaryTimeout);
      this.dailySummaryTimeout = null;
    }
  }

  _send(title, body) {
    try {
      const notification = new Notification({
        title,
        body,
        silent: false,
      });
      notification.show();
      console.log(`[Notification] ${title}: ${body}`);
    } catch (err) {
      console.error('[Notification] Error:', err.message);
    }
  }

  destroy() {
    this._clearDailySummaryTimer();
  }
}

module.exports = { NotificationService };

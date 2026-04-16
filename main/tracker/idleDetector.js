const { execSync } = require('child_process');

const DEFAULT_AFK_THRESHOLD_SECONDS = 300; // 5 minutes

class IdleDetector {
  constructor(thresholdSeconds = DEFAULT_AFK_THRESHOLD_SECONDS) {
    this.thresholdSeconds = thresholdSeconds;
  }

  getIdleTime() {
    try {
      // Use ioreg to get HIDIdleTime (in nanoseconds)
      const result = execSync(
        'ioreg -c IOHIDSystem | grep HIDIdleTime',
        { timeout: 2000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();

      const match = result.match(/= (\d+)/);
      if (match) {
        const nanoseconds = parseInt(match[1], 10);
        return Math.floor(nanoseconds / 1000000000); // convert to seconds
      }
      return 0;
    } catch {
      return 0;
    }
  }

  isIdle() {
    return this.getIdleTime() >= this.thresholdSeconds;
  }

  setThreshold(seconds) {
    this.thresholdSeconds = seconds;
  }
}

module.exports = { IdleDetector };

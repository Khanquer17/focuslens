const { powerMonitor } = require('electron');

class SleepDetector {
  constructor() {
    this.onSleep = null;
    this.onWake = null;
    this._bound = false;
  }

  start() {
    if (this._bound) return;
    this._bound = true;

    powerMonitor.on('suspend', () => {
      console.log('[Sleep] System suspending');
      if (this.onSleep) this.onSleep();
    });

    powerMonitor.on('resume', () => {
      console.log('[Sleep] System resumed');
      if (this.onWake) this.onWake();
    });

    powerMonitor.on('lock-screen', () => {
      console.log('[Sleep] Screen locked');
      if (this.onSleep) this.onSleep();
    });

    powerMonitor.on('unlock-screen', () => {
      console.log('[Sleep] Screen unlocked');
      if (this.onWake) this.onWake();
    });
  }
}

module.exports = { SleepDetector };

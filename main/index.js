const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// File logger for debugging
const logFile = path.join(require('os').tmpdir(), 'focuslens-debug.log');
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); fs.appendFileSync(logFile, `[LOG] ${args.join(' ')}\n`); };
console.error = (...args) => { origErr(...args); fs.appendFileSync(logFile, `[ERR] ${args.join(' ')}\n`); };
process.on('uncaughtException', (err) => { fs.appendFileSync(logFile, `[FATAL] ${err.stack}\n`); });

const database = require('./db/database');
const categoriesDb = require('./db/categories');
const { TrackingEngine } = require('./tracker/engine');
const { createTray, startSessionPoller, stopSessionPoller } = require('./tray');
const { registerHandlers } = require('./ipc/handlers');
const { startPeriodicSummary, stopPeriodicSummary } = require('./services/summaryBuilder');

// Hide from dock - menubar only
if (app.dock) {
  app.dock.hide();
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let engine = null;

app.whenReady().then(() => {
  console.log('[FocusLens] Starting up...');

  // Auto-start on login
  app.setLoginItemSettings({ openAtLogin: true });

  // Initialize database
  database.init();

  // Seed default categories
  categoriesDb.seedDefaults();

  // Register IPC handlers
  registerHandlers();

  // Create tray
  createTray(engine);

  // Start tracking engine
  engine = new TrackingEngine();
  engine.start();

  // Start periodic summary builder (every 60s)
  startPeriodicSummary(60000);

  // Update tray with engine reference
  const { updateTrayMenu } = require('./tray');
  updateTrayMenu(engine);

  // Poll claude sessions for approval indicators on tray
  startSessionPoller();

  console.log('[FocusLens] Ready and tracking');
});

app.on('window-all-closed', (e) => {
  // Don't quit when all windows closed - we're a menubar app
  e.preventDefault();
});

app.on('before-quit', () => {
  if (engine) {
    engine.stop();
  }
  stopPeriodicSummary();
  stopSessionPoller();
  database.close();
});

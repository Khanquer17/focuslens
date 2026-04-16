const { Tray, Menu, BrowserWindow, nativeImage, shell, Notification } = require('electron');
const path = require('path');
const claudeSessionService = require('./services/claudeSessionService');

let tray = null;
let dashboardWindow = null;
let sessionPollInterval = null;
let previousPermissionPids = new Set();

function createTrayIcon() {
  // Create a 22x22 template image programmatically (lens/eye icon)
  // Base64 encoded 22x22 PNG with a simple lens shape
  // Using a data URL for a simple black circle as template image
  const size = 22;
  const buf = Buffer.alloc(size * size * 4, 0);
  const cx = 11, cy = 11, r = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * size + x) * 4;
      if (dist >= r - 2 && dist <= r) {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 255;
      } else if (dist <= 3) {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 255;
      }
    }
  }
  const image = nativeImage.createFromBuffer(buf, { width: size, height: size });
  image.setTemplateImage(true);
  return image;
}

function createTray(engine) {
  if (tray) {
    tray.destroy();
    tray = null;
  }

  const image = createTrayIcon();

  tray = new Tray(image);
  tray.setToolTip('FocusLens - Tracking');

  updateTrayMenu(engine);

  tray.on('click', () => {
    toggleDashboard();
  });

  return tray;
}

function updateTrayMenu(engine) {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'FocusLens', enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => toggleDashboard(),
    },
    {
      label: engine && engine.paused ? 'Resume Tracking' : 'Pause Tracking',
      click: () => {
        if (engine.paused) {
          engine.resume();
        } else {
          engine.pause();
        }
        updateTrayMenu(engine);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit FocusLens',
      click: () => {
        const { app } = require('electron');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'ipc', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Always load from pre-built renderer files (no dev server needed)
  dashboardWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));

  // Log all renderer messages to debug log
  dashboardWindow.webContents.on('console-message', (_, level, message) => {
    if (level >= 2) console.error(`[Renderer] ${message}`);
    else console.log(`[Renderer] ${message}`);
  });

  // Catch renderer crashes and errors
  dashboardWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(`[Renderer] Failed to load: ${errorCode} ${errorDescription}`);
  });
  dashboardWindow.webContents.on('render-process-gone', (_, details) => {
    console.error(`[Renderer] Process gone: ${JSON.stringify(details)}`);
  });

  dashboardWindow.on('close', (e) => {
    // Don't destroy, just hide
    e.preventDefault();
    dashboardWindow.hide();
  });

  return dashboardWindow;
}

function toggleDashboard() {
  if (!dashboardWindow) {
    createDashboardWindow();
  }

  if (dashboardWindow.isVisible()) {
    dashboardWindow.hide();
  } else {
    dashboardWindow.show();
    dashboardWindow.focus();
  }
}

function getDashboardWindow() {
  return dashboardWindow;
}

function startSessionPoller() {
  const poll = () => {
    try {
      if (!tray) return;
      const { sessions } = claudeSessionService.getActiveSessions();
      const permissionSessions = sessions.filter(s => s.status === 'permission');
      const count = permissionSessions.length;

      tray.setTitle(count > 0 ? String(count) : '');
      tray.setToolTip(
        count > 0
          ? `FocusLens - ${count} approval${count !== 1 ? 's' : ''} needed`
          : 'FocusLens - Tracking'
      );

      // Notify for newly-entered permission sessions
      const currentPids = new Set(permissionSessions.map(s => s.pid));
      for (const s of permissionSessions) {
        if (!previousPermissionPids.has(s.pid)) {
          const n = new Notification({
            title: 'Claude needs approval',
            body: `Session in ${s.projectName} is waiting for permission`,
            silent: false,
          });
          n.show();
        }
      }
      previousPermissionPids = currentPids;
    } catch (err) {
      console.error('[Tray] Session poll error:', err.message);
    }
  };

  poll();
  sessionPollInterval = setInterval(poll, 5000);
  console.log('[Tray] Session poller started (every 5s)');
}

function stopSessionPoller() {
  if (sessionPollInterval) {
    clearInterval(sessionPollInterval);
    sessionPollInterval = null;
  }
}

module.exports = { createTray, updateTrayMenu, toggleDashboard, getDashboardWindow, startSessionPoller, stopSessionPoller };

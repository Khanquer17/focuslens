const { execSync } = require('child_process');

// Use AppleScript to get active window info - no native bindings needed
function getActiveWindowSync() {
  try {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        set bundleId to bundle identifier of frontApp
        try
          set winTitle to name of front window of frontApp
        on error
          set winTitle to ""
        end try
        return appName & "|||" & bundleId & "|||" & winTitle
      end tell
    `;

    const result = execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const parts = result.split('|||');
    if (parts.length < 2) return null;

    return {
      appName: parts[0] || 'Unknown',
      bundleId: parts[1] || '',
      windowTitle: parts[2] || '',
    };
  } catch (err) {
    console.error('[ActiveWindow] Error:', err.message);
    return null;
  }
}

async function getActiveWindow() {
  return getActiveWindowSync();
}

const BROWSER_BUNDLE_IDS = new Set([
  'com.apple.Safari',
  'com.google.Chrome',
  'com.google.Chrome.canary',
  'com.brave.Browser',
  'com.microsoft.edgemac',
  'company.thebrowser.Browser', // Arc
  'org.mozilla.firefox',
  'org.mozilla.Firefox',
  'com.operasoftware.Opera',
  'com.vivaldi.Vivaldi',
]);

function isBrowser(bundleId) {
  return BROWSER_BUNDLE_IDS.has(bundleId);
}

module.exports = { getActiveWindow, isBrowser, BROWSER_BUNDLE_IDS };

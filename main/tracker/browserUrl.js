const { execSync } = require('child_process');

const BROWSER_SCRIPTS = {
  'com.apple.Safari': `tell application "Safari" to get URL of current tab of front window`,
  'com.google.Chrome': `tell application "Google Chrome" to get URL of active tab of front window`,
  'com.google.Chrome.canary': `tell application "Google Chrome Canary" to get URL of active tab of front window`,
  'com.brave.Browser': `tell application "Brave Browser" to get URL of active tab of front window`,
  'com.microsoft.edgemac': `tell application "Microsoft Edge" to get URL of active tab of front window`,
  'company.thebrowser.Browser': `tell application "Arc" to get URL of active tab of front window`,
  'com.operasoftware.Opera': `tell application "Opera" to get URL of active tab of front window`,
  'com.vivaldi.Vivaldi': `tell application "Vivaldi" to get URL of active tab of front window`,
};

function getBrowserUrl(bundleId) {
  const script = BROWSER_SCRIPTS[bundleId];
  if (!script) return null;

  try {
    const result = execSync(`osascript -e '${script}'`, {
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!result || result === 'missing value') return null;
    return result;
  } catch {
    return null;
  }
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

module.exports = { getBrowserUrl, extractDomain };

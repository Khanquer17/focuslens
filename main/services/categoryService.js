const categoriesDb = require('../db/categories');

let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30000;

function loadCache() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return;

  const all = categoriesDb.getAll();
  cache = { app: {}, domain: {} };

  for (const m of all) {
    const map = cache[m.match_type];
    if (!map) continue;
    map[m.match_value] = m.category;
  }
  cacheTime = now;
}

function categorize(bundleId, domain) {
  loadCache();

  // Check saved mappings first (user overrides > defaults)
  if (domain && cache.domain[domain]) {
    return cache.domain[domain];
  }
  if (bundleId && cache.app[bundleId]) {
    return cache.app[bundleId];
  }

  // Auto-categorize based on heuristics
  return autoCategorizeDomain(domain) || autoCategorizeApp(bundleId) || 'neutral';
}

/**
 * Heuristic auto-categorization for domains that don't have explicit mappings.
 * This runs when no saved mapping exists.
 */
function autoCategorizeDomain(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();

  // Code / Dev
  if (/github\.|gitlab\.|bitbucket\.|stackoverflow\.com|stackexchange\.com|npmjs\.com|pypi\.org|crates\.io|pkg\.go\.dev|docs\.rs|rubygems\.org|packagist\.org|hub\.docker\.com|developer\.|devdocs\.io|mdn\.|w3schools\.com/.test(d)) return 'veryProductive';
  if (/codepen\.io|codesandbox\.io|replit\.com|glitch\.com|jsfiddle\.net|leetcode\.com|hackerrank\.com|codewars\.com|exercism\.org|codeforces\.com/.test(d)) return 'veryProductive';
  if (/vercel\.com|netlify\.com|heroku\.com|render\.com|railway\.app|supabase\.com|firebase\.google\.com|cloudflare\.com/.test(d)) return 'veryProductive';
  if (/aws\.amazon\.com|console\.cloud\.google|portal\.azure\.com|digitalocean\.com/.test(d)) return 'veryProductive';

  // Productivity / Work
  if (/docs\.google\.com|sheets\.google|slides\.google|drive\.google|notion\.so|coda\.io|airtable\.com|clickup\.com/.test(d)) return 'productive';
  if (/figma\.com|canva\.com|miro\.com|whimsical\.com|excalidraw\.com|lucidchart\.com/.test(d)) return 'productive';
  if (/linear\.app|asana\.com|trello\.com|monday\.com|basecamp\.com|jira\.atlassian|confluence\.atlassian/.test(d)) return 'productive';
  if (/slack\.com|zoom\.us|meet\.google\.com|teams\.microsoft|gather\.town/.test(d)) return 'productive';
  if (/medium\.com|dev\.to|hashnode\.com|substack\.com|hackernoon\.com/.test(d)) return 'productive';
  if (/coursera\.org|udemy\.com|edx\.org|khanacademy\.org|pluralsight\.com|egghead\.io|frontendmasters\.com|udacity\.com/.test(d)) return 'productive';
  if (/wikipedia\.org|arxiv\.org|scholar\.google/.test(d)) return 'productive';

  // Social media / Distraction
  if (/twitter\.com|x\.com|reddit\.com|facebook\.com|instagram\.com|threads\.net|bsky\.app|mastodon/.test(d)) return 'distracting';
  if (/youtube\.com|twitch\.tv|discord\.com|pinterest\.com|tumblr\.com|snapchat\.com/.test(d)) return 'distracting';
  if (/news\.ycombinator\.com|buzzfeed\.com|9gag\.com|imgur\.com/.test(d)) return 'distracting';

  // Streaming / Very distracting
  if (/netflix\.com|hulu\.com|disneyplus\.com|primevideo\.com|hotstar\.com|hbomax\.com|peacocktv\.com|crunchyroll\.com/.test(d)) return 'veryDistracting';
  if (/tiktok\.com|twitch\.tv/.test(d)) return 'veryDistracting';

  // Email / Neutral
  if (/mail\.google|outlook\.com|outlook\.live|protonmail\.com|fastmail\.com|yahoo\.com\/mail/.test(d)) return 'neutral';
  if (/calendar\.google|google\.com|bing\.com|duckduckgo\.com|search\.brave/.test(d)) return 'neutral';
  if (/amazon\.com|amazon\.in|flipkart\.com|ebay\.com/.test(d)) return 'neutral';

  return null; // truly unknown
}

/**
 * Heuristic auto-categorization for apps by bundle ID.
 */
function autoCategorizeApp(bundleId) {
  if (!bundleId) return null;
  const b = bundleId.toLowerCase();

  // IDEs / Code editors
  if (/xcode|vscode|visual.studio|intellij|pycharm|webstorm|goland|rider|clion|rubymine|phpstorm|android.studio|sublime|atom|zed|nova|bbedit/.test(b)) return 'veryProductive';
  // Terminals
  if (/terminal|iterm|warp|hyper|kitty|alacritty/.test(b)) return 'veryProductive';
  // Git
  if (/tower|gitkraken|sourcetree|fork/.test(b)) return 'veryProductive';
  // API tools
  if (/postman|insomnia|paw|httpie/.test(b)) return 'veryProductive';
  // Databases
  if (/tableplus|sequel|dbeaver|datagrip|pgadmin|mongodb.compass/.test(b)) return 'veryProductive';
  // Docker
  if (/docker/.test(b)) return 'veryProductive';

  // Design / Productive
  if (/figma|sketch|adobe\.photoshop|adobe\.illustrator|adobe\.xd|affinity|pixelmator/.test(b)) return 'productive';
  // Notes / Writing
  if (/obsidian|notion|logseq|bear|ulysses|ia.writer|typora|craft|apple\.notes/.test(b)) return 'productive';
  // Office
  if (/pages|numbers|keynote|microsoft\.word|microsoft\.excel|microsoft\.powerpoint|libreoffice|openoffice/.test(b)) return 'productive';
  // Slack / Comms (work)
  if (/slack|microsoft\.teams|zoom\.us|discord/.test(b)) return 'productive';
  // Linear / PM
  if (/linear|height/.test(b)) return 'productive';

  // System / Neutral
  if (/apple\.finder|apple\.systempreferences|apple\.systemsettings|apple\.preview|apple\.textedit/.test(b)) return 'neutral';
  if (/apple\.mail|apple\.ical|apple\.addressbook|apple\.reminders/.test(b)) return 'neutral';
  if (/1password|bitwarden|lastpass|dashlane/.test(b)) return 'neutral';
  if (/spotify|apple\.music|apple\.podcasts/.test(b)) return 'neutral';
  if (/apple\.calculator|apple\.archiveutility|apple\.activitymonitor/.test(b)) return 'neutral';
  if (/cleanmymac|bartender|raycast|alfred|karabiner/.test(b)) return 'neutral';

  // Chat / Distracting
  if (/apple\.mobilesms|messages|whatsapp|telegram|signal/.test(b)) return 'distracting';
  if (/facebook|instagram/.test(b)) return 'distracting';

  // Games
  if (/steam|epic.games|battle\.net|minecraft|chess/.test(b)) return 'veryDistracting';

  return null;
}

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

module.exports = { categorize, invalidateCache, autoCategorizeDomain, autoCategorizeApp };

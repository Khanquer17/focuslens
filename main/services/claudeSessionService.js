const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const STATS_CACHE = path.join(CLAUDE_DIR, 'stats-cache.json');
const HOOK_STATE_FILE = '/tmp/focuslens-claude-sessions.json';

// Sessions with no hook event for longer than this are hidden (stale tabs)
const STALE_THRESHOLD_S = 3600; // 1 hour

function isPidAlive(pid) {
  try {
    execSync(`ps -p ${pid} -o pid=`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function cwdToProjectKey(cwd) {
  return cwd.replace(/\//g, '-');
}

function getProjectName(cwd) {
  return path.basename(cwd);
}

/**
 * Read hook-based session state written by focuslens-state.sh.
 * Returns: { "<pid>": { status, timestamp } }
 */
function readHookState() {
  try {
    if (!fs.existsSync(HOOK_STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(HOOK_STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Fallback: read JSONL tail to determine status when no hook data exists.
 */
function detectStatusFromJsonl(sessionId, cwd) {
  const projectKey = cwdToProjectKey(cwd);
  const jsonlPath = path.join(PROJECTS_DIR, projectKey, `${sessionId}.jsonl`);

  try {
    const stat = fs.statSync(jsonlPath);
    if (stat.size === 0) return { status: 'unknown', mtimeMs: null };

    const readSize = Math.min(8192, stat.size);
    const buf = Buffer.alloc(readSize);
    const fd = fs.openSync(jsonlPath, 'r');
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'last-prompt') continue;
        const role = entry.message?.role;
        if (role === 'assistant') return { status: 'waiting', mtimeMs: stat.mtimeMs };
        if (role === 'user') return { status: 'working', mtimeMs: stat.mtimeMs };
      } catch { continue; }
    }
    return { status: 'unknown', mtimeMs: stat.mtimeMs };
  } catch {
    return { status: 'unknown', mtimeMs: null };
  }
}

function getActiveSessions() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return { sessions: [], summary: { totalActive: 0, needsAttention: 0, working: 0, longestRunningMs: 0 } };
    }

    const hookState = readHookState();
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const now = Date.now();
    const nowS = Math.floor(now / 1000);
    const sessions = [];

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8'));
        const pid = String(data.pid);
        const alive = isPidAlive(data.pid);
        if (!alive) continue; // skip dead sessions entirely

        let status;
        let lastActivityAgo;
        const hook = hookState[pid];

        if (hook && hook.timestamp) {
          // Hook state available — use it directly (explicit signal)
          const ageS = nowS - hook.timestamp;
          if (ageS > STALE_THRESHOLD_S) continue; // stale, skip

          status = hook.status;

          // Infer permission state: if pretool fired but no posttool followed
          // within 5 seconds, the session is likely blocked on a permission prompt
          if (hook.pretool_at && hook.status === 'working') {
            const waitingS = nowS - hook.pretool_at;
            if (waitingS > 5) status = 'permission';
          }

          lastActivityAgo = ageS * 1000;
        } else {
          // No hook data — fall back to JSONL parsing
          const jsonl = detectStatusFromJsonl(data.sessionId, data.cwd);
          if (!jsonl.mtimeMs) continue;
          lastActivityAgo = now - jsonl.mtimeMs;
          if (lastActivityAgo > STALE_THRESHOLD_S * 1000) continue; // stale
          status = jsonl.status === 'unknown' ? 'waiting' : jsonl.status;
        }

        sessions.push({
          pid: data.pid,
          sessionId: data.sessionId,
          cwd: data.cwd,
          projectName: getProjectName(data.cwd),
          startedAt: data.startedAt,
          kind: data.kind || 'interactive',
          entrypoint: data.entrypoint || 'unknown',
          status,
          durationMs: now - data.startedAt,
          lastActivityAgo,
        });
      } catch {
        continue;
      }
    }

    sessions.sort((a, b) => (a.lastActivityAgo || 0) - (b.lastActivityAgo || 0));

    const summary = {
      totalActive: sessions.length,
      needsAttention: sessions.filter(s => s.status === 'waiting' || s.status === 'permission').length,
      working: sessions.filter(s => s.status === 'working').length,
      longestRunningMs: sessions.length > 0 ? Math.max(...sessions.map(s => s.durationMs)) : 0,
    };

    return { sessions, summary };
  } catch (err) {
    console.error('[ClaudeService] getActiveSessions error:', err.message);
    return { sessions: [], summary: { totalActive: 0, needsAttention: 0, working: 0, longestRunningMs: 0 } };
  }
}

function getClaudeStats() {
  try {
    if (!fs.existsSync(STATS_CACHE)) {
      return { dailyActivity: [] };
    }
    const data = JSON.parse(fs.readFileSync(STATS_CACHE, 'utf8'));
    return {
      dailyActivity: data.dailyActivity || [],
    };
  } catch (err) {
    console.error('[ClaudeService] getClaudeStats error:', err.message);
    return { dailyActivity: [] };
  }
}

module.exports = { getActiveSessions, getClaudeStats };

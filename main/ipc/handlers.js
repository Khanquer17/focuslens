const { ipcMain } = require('electron');
const sessions = require('../db/sessions');
const categoriesDb = require('../db/categories');
const summariesDb = require('../db/summaries');
const tasksDb = require('../db/tasks');
const categoryService = require('../services/categoryService');
const { buildTodaySummary } = require('../services/summaryBuilder');
const { computeMetrics } = require('../services/metricsCalculator');
const claudeSessionService = require('../services/claudeSessionService');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function registerHandlers() {
  // ─── Today ───
  ipcMain.handle('get-today', () => {
    try {
      const totalSeconds = sessions.getTodayTotalSeconds();
      const byCategory = sessions.getTodayByCategory();
      const topApps = sessions.getTodayTopApps(10);

      // Get or compute today's metrics
      let summary = summariesDb.getDailySummary(todayStr());
      if (!summary) {
        buildTodaySummary();
        summary = summariesDb.getDailySummary(todayStr());
      }

      const focusSessions = summariesDb.getFocusSessionsForDate(todayStr());
      const attentionMetrics = summariesDb.getAttentionMetricsForDate(todayStr());

      const taskMetrics = tasksDb.getTaskMetricsForDate(todayStr());

      return {
        totalSeconds,
        byCategory,
        topApps,
        focusScore: summary ? summary.focus_score : 0,
        focusSessionCount: summary ? summary.focus_session_count : 0,
        appSwitchCount: summary ? summary.app_switch_count : 0,
        avgFocusDuration: summary ? summary.avg_focus_duration_seconds : 0,
        focusSessions,
        attentionMetrics,
        taskMetrics,
      };
    } catch (err) {
      console.error('[IPC] get-today error:', err.message, err.stack);
      return { totalSeconds: 0, byCategory: [], topApps: [], focusScore: 0, focusSessionCount: 0, appSwitchCount: 0, avgFocusDuration: 0, focusSessions: [], attentionMetrics: [], taskMetrics: { tasksCompleted: 0, tasksCreated: 0, avgCompletionSeconds: null } };
    }
  });

  ipcMain.handle('get-today-sessions', () => {
    return sessions.getTodaySessions();
  });

  ipcMain.handle('get-today-timeline', () => {
    return sessions.getTodayTimeline();
  });

  ipcMain.handle('get-today-top-apps', (_, limit = 10) => {
    return sessions.getTodayTopApps(limit);
  });

  ipcMain.handle('get-today-by-category', () => {
    return sessions.getTodayByCategory();
  });

  // ─── Trends ───
  ipcMain.handle('get-weekly-trends', (_, weeks = 4) => {
    const endDate = todayStr();
    const startDate = dateStr(weeks * 7);
    return summariesDb.getDailySummariesRange(startDate, endDate);
  });

  ipcMain.handle('get-monthly-trends', (_, months = 3) => {
    const endDate = todayStr();
    const startDate = dateStr(months * 30);
    return summariesDb.getDailySummariesRange(startDate, endDate);
  });

  ipcMain.handle('get-attention-trends', (_, days = 7) => {
    const endDate = todayStr();
    const startDate = dateStr(days);
    return summariesDb.getAttentionMetricsRange(startDate, endDate);
  });

  // ─── Categories (usage-driven) ───

  // Returns apps and domains actually used, with their current category
  // Browsers (Chrome, Safari, etc.) are excluded from apps — only their domains are shown
  ipcMain.handle('get-categories', () => {
    const { BROWSER_BUNDLE_IDS } = require('../tracker/activeWindow');
    const browserIds = Array.from(BROWSER_BUNDLE_IDS);
    const usedApps = sessions.getUsedAppsNonBrowser(browserIds);
    const usedDomains = sessions.getUsedDomains();

    const apps = usedApps.map(a => {
      // Check if user has saved a mapping
      const saved = categoriesDb.findByApp(a.app_bundle_id);
      return {
        type: 'app',
        value: a.app_bundle_id,
        displayName: a.app_name,
        category: saved ? saved.category : categoryService.categorize(a.app_bundle_id, null),
        totalSeconds: a.total_seconds,
        sessionCount: a.session_count,
        lastUsed: a.last_used,
        isCustom: saved ? !saved.is_default : false,
        mappingId: saved ? saved.id : null,
      };
    });

    const domains = usedDomains.map(d => {
      const saved = categoriesDb.findByDomain(d.domain);
      return {
        type: 'domain',
        value: d.domain,
        displayName: d.domain,
        category: saved ? saved.category : categoryService.categorize(null, d.domain),
        totalSeconds: d.total_seconds,
        sessionCount: d.session_count,
        lastUsed: d.last_used,
        isCustom: saved ? !saved.is_default : false,
        mappingId: saved ? saved.id : null,
      };
    });

    return [...apps, ...domains];
  });

  // Save/update a category mapping (upsert) + retroactively update existing sessions
  ipcMain.handle('update-category', (_, matchType, matchValue, category) => {
    categoriesDb.add({ matchType, matchValue, category });
    categoryService.invalidateCache();

    // Retroactively update all existing sessions so charts reflect the change immediately
    if (matchType === 'app') {
      sessions.updateCategoryForApp(matchValue, category);
    } else if (matchType === 'domain') {
      sessions.updateCategoryForDomain(matchValue, category);
    }

    // Rebuild today's summary so focus score etc. reflect the change
    try {
      buildTodaySummary();
    } catch (err) {
      console.error('[IPC] Error rebuilding summary after category update:', err.message);
    }

    return { success: true };
  });

  ipcMain.handle('add-category', (_, mapping) => {
    categoriesDb.add(mapping);
    categoryService.invalidateCache();
    return { success: true };
  });

  ipcMain.handle('delete-category', (_, id) => {
    categoriesDb.remove(id);
    categoryService.invalidateCache();
    return { success: true };
  });

  // ─── Settings ───
  ipcMain.handle('get-settings', () => {
    const { getDb } = require('../db/database');
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  });

  ipcMain.handle('update-setting', (_, key, value) => {
    const { getDb } = require('../db/database');
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    return { success: true };
  });

  // ─── Tasks ───
  ipcMain.handle('tasks-create', (_, taskData) => {
    try {
      return tasksDb.createTask(taskData);
    } catch (err) {
      console.error('[IPC] tasks-create error:', err.message);
      return null;
    }
  });

  ipcMain.handle('tasks-get-today', () => {
    try {
      return tasksDb.getTodayTasks();
    } catch (err) {
      console.error('[IPC] tasks-get-today error:', err.message);
      return [];
    }
  });

  ipcMain.handle('tasks-update', (_, id, updates) => {
    try {
      return tasksDb.updateTask(id, updates);
    } catch (err) {
      console.error('[IPC] tasks-update error:', err.message);
      return null;
    }
  });

  ipcMain.handle('tasks-move', (_, id, newStatus, newPosition) => {
    try {
      return tasksDb.moveTask(id, newStatus, newPosition);
    } catch (err) {
      console.error('[IPC] tasks-move error:', err.message);
      return null;
    }
  });

  ipcMain.handle('tasks-archive', (_, id) => {
    try {
      return tasksDb.archiveTask(id);
    } catch (err) {
      console.error('[IPC] tasks-archive error:', err.message);
      return { success: false };
    }
  });

  ipcMain.handle('tasks-delete', (_, id) => {
    try {
      return tasksDb.deleteTask(id);
    } catch (err) {
      console.error('[IPC] tasks-delete error:', err.message);
      return { success: false };
    }
  });

  ipcMain.handle('tasks-metrics-today', () => {
    try {
      return tasksDb.getTaskMetricsForDate(todayStr());
    } catch (err) {
      console.error('[IPC] tasks-metrics-today error:', err.message);
      return { tasksCompleted: 0, tasksCreated: 0, avgCompletionSeconds: null };
    }
  });

  ipcMain.handle('tasks-metrics-range', (_, startDate, endDate) => {
    try {
      return tasksDb.getTaskMetricsRange(startDate, endDate);
    } catch (err) {
      console.error('[IPC] tasks-metrics-range error:', err.message);
      return [];
    }
  });

  // ─── Claude Sessions ───
  ipcMain.handle('get-claude-sessions', () => {
    try {
      return claudeSessionService.getActiveSessions();
    } catch (err) {
      console.error('[IPC] get-claude-sessions error:', err.message);
      return { sessions: [], summary: { totalActive: 0, needsAttention: 0, working: 0, longestRunningMs: 0 } };
    }
  });

  ipcMain.handle('get-claude-stats', () => {
    try {
      return claudeSessionService.getClaudeStats();
    } catch (err) {
      console.error('[IPC] get-claude-stats error:', err.message);
      return { dailyActivity: [] };
    }
  });

  // ─── Export ───
  ipcMain.handle('export-csv', (_, dateRange) => {
    const { dialog } = require('electron');
    const fs = require('fs');

    const startDate = dateRange?.start || dateStr(90);
    const endDate = dateRange?.end || todayStr();
    const summaries = summariesDb.getDailySummariesRange(startDate, endDate);

    const header = 'Date,Total Tracked (s),Productive (s),Neutral (s),Distracting (s),Focus Score,App Switches,Avg Focus Duration (s),Focus Sessions,Top Apps\n';
    const rows = summaries.map(s =>
      `${s.date},${s.total_tracked_seconds},${s.productive_seconds},${s.neutral_seconds},${s.distracting_seconds},${s.focus_score},${s.app_switch_count},${s.avg_focus_duration_seconds},${s.focus_session_count},"${s.top_apps || ''}"`
    ).join('\n');

    return { csv: header + rows, filename: `focuslens-export-${todayStr()}.csv` };
  });
}

module.exports = { registerHandlers };

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Today
  getToday: () => ipcRenderer.invoke('get-today'),
  getTodaySessions: () => ipcRenderer.invoke('get-today-sessions'),
  getTodayTimeline: () => ipcRenderer.invoke('get-today-timeline'),
  getTodayTopApps: (limit) => ipcRenderer.invoke('get-today-top-apps', limit),
  getTodayByCategory: () => ipcRenderer.invoke('get-today-by-category'),

  // Trends
  getWeeklyTrends: (weeks) => ipcRenderer.invoke('get-weekly-trends', weeks),
  getMonthlyTrends: (months) => ipcRenderer.invoke('get-monthly-trends', months),
  getAttentionTrends: (days) => ipcRenderer.invoke('get-attention-trends', days),

  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  updateCategory: (matchType, matchValue, category) => ipcRenderer.invoke('update-category', matchType, matchValue, category),
  addCategory: (mapping) => ipcRenderer.invoke('add-category', mapping),
  deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value),

  // Whoop
  connectWhoop: () => ipcRenderer.invoke('connect-whoop'),
  getWhoopData: (days) => ipcRenderer.invoke('get-whoop-data', days),
  disconnectWhoop: () => ipcRenderer.invoke('disconnect-whoop'),
  getWhoopStatus: () => ipcRenderer.invoke('get-whoop-status'),

  // Correlation
  getCorrelation: (days) => ipcRenderer.invoke('get-correlation', days),

  // Export
  exportCSV: (dateRange) => ipcRenderer.invoke('export-csv', dateRange),

  // Claude
  getClaudeSessions: () => ipcRenderer.invoke('get-claude-sessions'),
  getClaudeStats: () => ipcRenderer.invoke('get-claude-stats'),

  // Tasks
  createTask: (taskData) => ipcRenderer.invoke('tasks-create', taskData),
  getTodayTasks: () => ipcRenderer.invoke('tasks-get-today'),
  updateTask: (id, updates) => ipcRenderer.invoke('tasks-update', id, updates),
  moveTask: (id, newStatus, newPosition) => ipcRenderer.invoke('tasks-move', id, newStatus, newPosition),
  archiveTask: (id) => ipcRenderer.invoke('tasks-archive', id),
  deleteTask: (id) => ipcRenderer.invoke('tasks-delete', id),
  getTaskMetricsToday: () => ipcRenderer.invoke('tasks-metrics-today'),
  getTaskMetricsRange: (startDate, endDate) => ipcRenderer.invoke('tasks-metrics-range', startDate, endDate),
});

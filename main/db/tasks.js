const { getDb } = require('./database');

function createTask({ title, dueDate, type }) {
  const db = getDb();
  const maxPos = db.prepare(`
    SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM tasks WHERE status = 'todo'
  `).get();

  const stmt = db.prepare(`
    INSERT INTO tasks (title, due_date, type, status, position, created_at)
    VALUES (?, ?, ?, 'todo', ?, datetime('now', 'localtime'))
  `);
  const result = stmt.run(title, dueDate || null, type || 'work', maxPos.next_pos);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
}

function getTodayTasks() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM tasks
    WHERE (
      date(due_date) = date('now', 'localtime')
      OR date(created_at) = date('now', 'localtime')
      OR status = 'inprogress'
      OR status = 'todo'
      OR (status = 'done' AND date(completed_at) = date('now', 'localtime'))
    )
    AND status != 'archived'
    ORDER BY
      CASE status
        WHEN 'todo' THEN 1
        WHEN 'inprogress' THEN 2
        WHEN 'done' THEN 3
      END,
      position ASC
  `).all();
}

function updateTask(id, updates) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return null;

  const title = updates.title !== undefined ? updates.title : task.title;
  const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.due_date;
  const type = updates.type !== undefined ? updates.type : task.type;

  db.prepare(`
    UPDATE tasks SET title = ?, due_date = ?, type = ? WHERE id = ?
  `).run(title, dueDate, type, id);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function moveTask(id, newStatus, newPosition) {
  const db = getDb();

  const move = db.transaction(() => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return null;

    const oldStatus = task.status;
    let startedAt = task.started_at;
    let completedAt = task.completed_at;
    let timeInProgress = task.time_in_progress_seconds;

    // State transition logic
    if (newStatus === 'inprogress' && oldStatus !== 'inprogress') {
      startedAt = db.prepare("SELECT datetime('now', 'localtime') as now").get().now;
      completedAt = null;
      // Keep timeInProgress so resumed tasks preserve accumulated time
    }

    if (newStatus === 'done' && startedAt) {
      completedAt = db.prepare("SELECT datetime('now', 'localtime') as now").get().now;
      const elapsed = db.prepare(`
        SELECT CAST((julianday(datetime('now', 'localtime')) - julianday(?)) * 86400 AS INTEGER) as seconds
      `).get(startedAt).seconds;
      timeInProgress = (timeInProgress || 0) + elapsed;
    }

    if (newStatus === 'todo') {
      if (oldStatus === 'inprogress' && startedAt) {
        const elapsed = db.prepare(`
          SELECT CAST((julianday(datetime('now', 'localtime')) - julianday(?)) * 86400 AS INTEGER) as seconds
        `).get(startedAt).seconds;
        timeInProgress = (timeInProgress || 0) + elapsed;
      }
      startedAt = null;
      completedAt = null;
    }

    // Shift positions in target column to make room
    db.prepare(`
      UPDATE tasks SET position = position + 1
      WHERE status = ? AND position >= ? AND id != ?
    `).run(newStatus, newPosition, id);

    // Update the task
    db.prepare(`
      UPDATE tasks
      SET status = ?, position = ?, started_at = ?, completed_at = ?, time_in_progress_seconds = ?
      WHERE id = ?
    `).run(newStatus, newPosition, startedAt, completedAt, timeInProgress, id);

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  });

  return move();
}

function archiveTask(id) {
  const db = getDb();
  db.prepare("UPDATE tasks SET status = 'archived' WHERE id = ?").run(id);
  return { success: true };
}

function deleteTask(id) {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { success: true };
}

function getTaskMetricsForDate(dateStr) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(CASE WHEN status IN ('done', 'archived') AND date(completed_at) = ? THEN 1 END) as tasks_completed,
      COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as tasks_created,
      AVG(CASE WHEN status IN ('done', 'archived') AND date(completed_at) = ? THEN time_in_progress_seconds END) as avg_completion_seconds
    FROM tasks
    WHERE date(created_at) = ? OR date(completed_at) = ?
  `).get(dateStr, dateStr, dateStr, dateStr, dateStr);

  return {
    tasksCompleted: row.tasks_completed || 0,
    tasksCreated: row.tasks_created || 0,
    avgCompletionSeconds: row.avg_completion_seconds ? Math.round(row.avg_completion_seconds) : null,
  };
}

function getTaskMetricsRange(startDate, endDate) {
  const db = getDb();
  return db.prepare(`
    SELECT
      date(completed_at) as date,
      COUNT(*) as tasks_completed,
      AVG(time_in_progress_seconds) as avg_completion_seconds
    FROM tasks
    WHERE status IN ('done', 'archived')
      AND date(completed_at) >= ? AND date(completed_at) <= ?
      AND time_in_progress_seconds IS NOT NULL
    GROUP BY date(completed_at)
    ORDER BY date(completed_at) ASC
  `).all(startDate, endDate);
}

module.exports = {
  createTask,
  getTodayTasks,
  updateTask,
  moveTask,
  archiveTask,
  deleteTask,
  getTaskMetricsForDate,
  getTaskMetricsRange,
};

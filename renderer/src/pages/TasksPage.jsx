import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import {
  GLASS_BORDER, CARD_SHADOW, CARD_HOVER_SHADOW, CARD_BG, FONT_STACK,
  TASK_TYPE_COLORS, TASK_STATUS_COLORS, HoverDiv,
} from '../lib/theme.jsx';

const TYPE_LABELS = { work: 'Work', personal: 'Personal' };
const STATUS_LABELS = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
const COLUMNS = ['todo', 'inprogress', 'done'];

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return dueDate < todayStr();
}

// ─── Elapsed Timer for In-Progress Tasks ───
function ElapsedTimer({ startedAt, previousSeconds = 0 }) {
  const [elapsed, setElapsed] = useState(previousSeconds);

  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsed(previousSeconds + Math.max(0, seconds));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [startedAt, previousSeconds]);

  return (
    <span style={styles.elapsedTimer}>
      <span style={styles.timerDot}>●</span>
      {formatDuration(elapsed)}
    </span>
  );
}

// ─── Task Card ───
function TaskCard({ task, onMove, onDelete, onUpdate, dragState, setDragState }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editType, setEditType] = useState(task.type);
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const isDragging = dragState && dragState.taskId === task.id;

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(task.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDragStart(e) {
    setDragState({ taskId: task.id, sourceStatus: task.status });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  }

  function handleDragEnd() {
    setDragState(null);
  }

  function handleSaveEdit() {
    if (editTitle.trim()) {
      onUpdate(task.id, { title: editTitle.trim(), type: editType, dueDate: editDueDate || null });
    }
    setEditing(false);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') {
      setEditing(false);
      setEditTitle(task.title);
      setEditType(task.type);
      setEditDueDate(task.due_date || '');
    }
  }

  if (editing) {
    return (
      <div style={styles.card} data-task-card={task.id}>
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleEditKeyDown}
          style={styles.editInput}
          placeholder="Task title"
        />
        <div style={styles.editRow}>
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            style={styles.editSelect}
          >
            <option value="work">Work</option>
            <option value="personal">Personal</option>
          </select>
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            style={styles.editDateInput}
          />
        </div>
        <div style={styles.editActions}>
          <button onClick={handleSaveEdit} style={styles.editSaveBtn}>Save</button>
          <button onClick={() => { setEditing(false); setEditTitle(task.title); setEditType(task.type); setEditDueDate(task.due_date || ''); }} style={styles.editCancelBtn}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-task-card={task.id}
      style={{
        ...styles.card,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: hovered && !isDragging ? 'translateY(-1px)' : 'none',
        boxShadow: hovered && !isDragging ? CARD_HOVER_SHADOW : CARD_SHADOW,
      }}
    >
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{task.title}</div>
        {hovered && (
          <div style={styles.cardActions}>
            <button onClick={handleCopy} style={styles.actionBtn} title={copied ? "Copied!" : "Copy"}>
              {copied ? '✓' : '⧉'}
            </button>
            <button onClick={() => setEditing(true)} style={styles.actionBtn} title="Edit">
              &#9998;
            </button>
            <button onClick={() => onDelete(task.id)} style={styles.actionBtn} title="Delete">
              &times;
            </button>
          </div>
        )}
      </div>

      <div style={styles.cardMeta}>
        <span style={{
          ...styles.typeBadge,
          background: TASK_TYPE_COLORS[task.type] + '18',
          color: TASK_TYPE_COLORS[task.type],
        }}>
          {TYPE_LABELS[task.type]}
        </span>
        {task.due_date && (
          <span style={{
            ...styles.dueDateBadge,
            color: isOverdue(task.due_date) && task.status !== 'done' ? '#ef4444' : '#666',
          }}>
            {task.due_date === todayStr() ? 'Today' : task.due_date.slice(5)}
          </span>
        )}
      </div>

      {task.status === 'inprogress' && task.started_at && (
        <ElapsedTimer startedAt={task.started_at} previousSeconds={task.time_in_progress_seconds || 0} />
      )}

      {task.status === 'done' && task.time_in_progress_seconds != null && (
        <span style={styles.completionTime}>
          Completed in {formatDuration(task.time_in_progress_seconds)}
        </span>
      )}
    </div>
  );
}

// ─── Add Task Form (inline) ───
function AddTaskForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('work');
  const [dueDate, setDueDate] = useState(todayStr());
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (title.trim()) {
      onSubmit({ title: title.trim(), type, dueDate: dueDate || null });
      setTitle('');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div style={styles.addForm}>
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title..."
        style={styles.addInput}
      />
      <div style={styles.addFormRow}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={styles.addSelect}>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={styles.addDateInput}
        />
      </div>
      <div style={styles.addFormActions}>
        <button onClick={handleSubmit} style={styles.addSubmitBtn}>Add</button>
        <button onClick={onCancel} style={styles.addCancelBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Kanban Column ───
function KanbanColumn({ status, tasks, onMove, onDelete, onUpdate, onAddTask, dragState, setDragState, showDone, setShowDone }) {
  const columnRef = useRef(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState(-1);
  const [addingTask, setAddingTask] = useState(false);

  const isDone = status === 'done';
  const collapsed = isDone && !showDone;

  function getDropPosition(e) {
    const cards = columnRef.current?.querySelectorAll('[data-task-card]');
    if (!cards) return 0;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) return i;
    }
    return cards.length;
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
      setDropIndex(-1);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!collapsed) {
      setDropIndex(getDropPosition(e));
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    setDropIndex(-1);

    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!taskId) return;

    const pos = collapsed ? 0 : getDropPosition(e);
    onMove(taskId, status, pos);

    // Auto-expand done column when something is dropped into it
    if (isDone && !showDone) {
      setShowDone(true);
    }
  }

  const statusColor = TASK_STATUS_COLORS[status];

  return (
    <div
      ref={columnRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...styles.column,
        ...(dragOver ? { boxShadow: `inset 0 0 0 2px ${statusColor}33` } : {}),
      }}
    >
      <div style={styles.columnHeader}>
        <div style={styles.columnHeaderLeft}>
          <span style={{ ...styles.columnDot, background: statusColor, boxShadow: `0 0 8px ${statusColor}60` }} />
          <span style={styles.columnTitle}>{STATUS_LABELS[status]}</span>
          <span style={styles.columnCount}>{tasks.length}</span>
        </div>
        {isDone && (
          <button
            onClick={() => setShowDone(!showDone)}
            style={styles.collapseBtn}
          >
            {showDone ? '▾' : '▸'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={styles.columnBody}>
          {tasks.map((task, i) => (
            <React.Fragment key={task.id}>
              {dropIndex === i && dragOver && (
                <div style={styles.dropIndicator} />
              )}
              <TaskCard
                task={task}
                onMove={onMove}
                onDelete={onDelete}
                onUpdate={onUpdate}
                dragState={dragState}
                setDragState={setDragState}
              />
            </React.Fragment>
          ))}
          {dropIndex === tasks.length && dragOver && (
            <div style={styles.dropIndicator} />
          )}

          {addingTask ? (
            <AddTaskForm
              onSubmit={(data) => {
                onAddTask(data, status);
                setAddingTask(false);
              }}
              onCancel={() => setAddingTask(false)}
            />
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              style={styles.addTaskBtn}
            >
              + Add task
            </button>
          )}
        </div>
      )}

      {collapsed && dragOver && (
        <div style={{ ...styles.columnBody, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#666', fontSize: 12 }}>Drop here to complete</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───
export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [dragState, setDragState] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const result = await api.getTodayTasks();
      setTasks(result || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  async function handleAddTask(data, targetStatus) {
    await api.createTask(data);
    // If adding directly to inprogress, move it there
    if (targetStatus === 'inprogress') {
      const allTasks = await api.getTodayTasks();
      const newest = allTasks && allTasks[allTasks.length - 1];
      if (newest) {
        await api.moveTask(newest.id, 'inprogress', 0);
      }
    }
    fetchTasks();
  }

  async function handleMove(taskId, newStatus, newPosition) {
    await api.moveTask(taskId, newStatus, newPosition);
    fetchTasks();
  }

  async function handleDelete(taskId) {
    await api.deleteTask(taskId);
    fetchTasks();
  }

  async function handleUpdate(taskId, updates) {
    await api.updateTask(taskId, updates);
    fetchTasks();
  }

  const todoTasks = tasks.filter(t => t.status === 'todo').sort((a, b) => a.position - b.position);
  const inProgressTasks = tasks.filter(t => t.status === 'inprogress').sort((a, b) => a.position - b.position);
  const doneTasks = tasks.filter(t => t.status === 'done').sort((a, b) => a.position - b.position);

  const tasksByStatus = { todo: todoTasks, inprogress: inProgressTasks, done: doneTasks };

  if (loading) {
    return (
      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={styles.title}>Tasks</h1>
        <div style={styles.board}>
          {COLUMNS.map((col, i) => (
            <div key={col} style={styles.column}>
              <div style={{
                height: 20, width: 80, background: '#1a1a1a', borderRadius: 6, marginBottom: 12,
                animation: `shimmer 1.5s infinite ${i * 0.1}s`,
                backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
                backgroundSize: '200% 100%',
              }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={styles.title}>Tasks</h1>
      <div style={styles.board}>
        {COLUMNS.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onMove={handleMove}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onAddTask={handleAddTask}
            dragState={dragState}
            setDragState={setDragState}
            showDone={showDone}
            setShowDone={setShowDone}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Styles ───
const styles = {
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 24,
    letterSpacing: '-0.5px',
  },
  board: {
    display: 'flex',
    gap: 14,
    height: 'calc(100vh - 130px)',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    background: 'rgba(18,18,18,0.5)',
    borderRadius: 14,
    border: GLASS_BORDER,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 120,
    maxHeight: '100%',
    transition: 'box-shadow 0.2s ease',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: '0 4px',
  },
  columnHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  columnDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ccc',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  columnCount: {
    fontSize: 11,
    color: '#555',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 7px',
    borderRadius: 10,
    fontWeight: 600,
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: FONT_STACK,
  },
  columnBody: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    background: CARD_BG,
    borderRadius: 10,
    padding: '12px 14px',
    border: GLASS_BORDER,
    boxShadow: CARD_SHADOW,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
    userSelect: 'none',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: '#eee',
    lineHeight: '1.4',
    flex: 1,
    wordBreak: 'break-word',
  },
  cardActions: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: '#555',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 4px',
    borderRadius: 4,
    lineHeight: 1,
    fontFamily: FONT_STACK,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  typeBadge: {
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 4,
    fontWeight: 600,
  },
  dueDateBadge: {
    fontSize: 10,
    fontWeight: 500,
  },
  elapsedTimer: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    fontSize: 11,
    color: TASK_STATUS_COLORS.inprogress,
    fontWeight: 500,
  },
  timerDot: {
    fontSize: 6,
    animation: 'fadeIn 1s ease infinite alternate',
  },
  completionTime: {
    display: 'block',
    marginTop: 8,
    fontSize: 11,
    color: TASK_STATUS_COLORS.done,
    fontWeight: 500,
  },
  dropIndicator: {
    height: 2,
    background: '#22c55e',
    borderRadius: 1,
    margin: '-2px 0',
    boxShadow: '0 0 6px rgba(34,197,94,0.4)',
  },
  addTaskBtn: {
    background: 'none',
    border: `1px dashed rgba(255,255,255,0.08)`,
    borderRadius: 8,
    color: '#555',
    fontSize: 12,
    fontWeight: 500,
    padding: '10px 0',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: FONT_STACK,
    transition: 'all 0.15s ease',
    marginTop: 4,
  },
  addForm: {
    background: CARD_BG,
    borderRadius: 10,
    padding: '12px 14px',
    border: GLASS_BORDER,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  addInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#eee',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
    fontFamily: FONT_STACK,
  },
  addFormRow: {
    display: 'flex',
    gap: 6,
  },
  addSelect: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: FONT_STACK,
    cursor: 'pointer',
  },
  addDateInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: FONT_STACK,
    colorScheme: 'dark',
  },
  addFormActions: {
    display: 'flex',
    gap: 6,
  },
  addSubmitBtn: {
    flex: 1,
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 6,
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 0',
    cursor: 'pointer',
    fontFamily: FONT_STACK,
  },
  addCancelBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    color: '#666',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 0',
    cursor: 'pointer',
    fontFamily: FONT_STACK,
  },
  editInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#eee',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
    fontFamily: FONT_STACK,
    width: '100%',
    boxSizing: 'border-box',
  },
  editRow: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  },
  editSelect: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: FONT_STACK,
    cursor: 'pointer',
  },
  editDateInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: FONT_STACK,
    colorScheme: 'dark',
  },
  editActions: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  },
  editSaveBtn: {
    flex: 1,
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 6,
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 0',
    cursor: 'pointer',
    fontFamily: FONT_STACK,
  },
  editCancelBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    color: '#666',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 0',
    cursor: 'pointer',
    fontFamily: FONT_STACK,
  },
};

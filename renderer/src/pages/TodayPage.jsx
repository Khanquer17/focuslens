import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../lib/api';
import { CATEGORY_COLORS, CATEGORY_LABELS, GLASS_BORDER, CARD_SHADOW, CARD_HOVER_SHADOW, CARD_BG, TOOLTIP_STYLE, HoverDiv, TASK_STATUS_COLORS } from '../lib/theme.jsx';
import TimelineBar from '../components/TimelineBar';
import FocusScoreGauge from '../components/FocusScoreGauge';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Skeleton Loading ───
function SkeletonCard({ height = 80, delay = 0 }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
      backgroundSize: '200% 100%',
      animation: `shimmer 1.5s infinite ${delay}s`,
      borderRadius: 14,
      height,
      border: GLASS_BORDER,
    }} />
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div style={{ height: 28, width: 80, background: '#1a1a1a', borderRadius: 8, marginBottom: 24 }} />
      <div style={styles.cardGrid}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} delay={i * 0.1} />)}
      </div>
      <div style={{ ...styles.row, marginTop: 16 }}>
        <SkeletonCard height={300} delay={0.4} />
        <SkeletonCard height={300} delay={0.5} />
      </div>
    </div>
  );
}

// ─── Summary Card Gradients ───
const CARD_GRADIENTS = [
  'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(26,26,26,0.8) 100%)',
  'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(26,26,26,0.8) 100%)',
  'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(26,26,26,0.8) 100%)',
  'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(26,26,26,0.8) 100%)',
];

export default function TodayPage() {
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [claudeData, setClaudeData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [result, timelineData, claudeResult] = await Promise.all([
        api.getToday(),
        api.getTodayTimeline(),
        api.getClaudeSessions(),
      ]);
      setData(result);
      setTimeline(timelineData || []);
      setClaudeData(claudeResult);
    } catch (err) {
      console.error('Failed to fetch today data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div style={styles.emptyState}>No data available</div>;

  const { totalSeconds, byCategory, topApps, focusScore, focusSessionCount, appSwitchCount, avgFocusDuration, focusSessions, attentionMetrics, taskMetrics } = data;

  const chartData = (byCategory || []).map(c => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    value: c.total_seconds,
    color: CATEGORY_COLORS[c.category] || '#666',
    category: c.category,
  }));

  const productiveSeconds = (byCategory || [])
    .filter(c => c.category === 'veryProductive' || c.category === 'productive')
    .reduce((sum, c) => sum + c.total_seconds, 0);

  const distractingSeconds = (byCategory || [])
    .filter(c => c.category === 'distracting' || c.category === 'veryDistracting')
    .reduce((sum, c) => sum + c.total_seconds, 0);

  const attentionData = (attentionMetrics || []).map(m => ({
    hour: `${m.hour}:00`,
    switches: m.app_switches,
    avgFocus: m.avg_focus_duration_seconds,
  }));

  const summaryCards = [
    { label: 'Total Tracked', value: formatDuration(totalSeconds), color: '#fff' },
    { label: 'Productive', value: formatDuration(productiveSeconds), color: '#22c55e' },
    { label: 'Distracting', value: formatDuration(distractingSeconds), color: '#ef4444' },
    { label: 'App Switches', value: String(appSwitchCount || 0), color: '#eab308' },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={styles.title}>Today</h1>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        {summaryCards.map((card, i) => (
          <HoverDiv
            key={i}
            style={{
              ...styles.card,
              background: CARD_GRADIENTS[i],
              opacity: 0,
              animation: `fadeInUp 0.4s ease forwards`,
              animationDelay: `${i * 0.06}s`,
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={{ ...styles.cardValue, color: card.color }}>{card.value}</div>
          </HoverDiv>
        ))}
      </div>

      {/* Task Metrics */}
      {taskMetrics && (taskMetrics.tasksCompleted > 0 || taskMetrics.tasksCreated > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
          <HoverDiv
            style={{
              ...styles.card,
              background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(26,26,26,0.8) 100%)',
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards',
              animationDelay: '0.3s',
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>Tasks Done</div>
            <div style={{ ...styles.cardValue, color: TASK_STATUS_COLORS.done }}>{taskMetrics.tasksCompleted}</div>
          </HoverDiv>
          <HoverDiv
            style={{
              ...styles.card,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(26,26,26,0.8) 100%)',
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards',
              animationDelay: '0.36s',
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>Avg Completion Time</div>
            <div style={{ ...styles.cardValue, color: '#3b82f6' }}>
              {taskMetrics.avgCompletionSeconds ? formatDuration(taskMetrics.avgCompletionSeconds) : '--'}
            </div>
          </HoverDiv>
        </div>
      )}

      {/* Claude Sessions */}
      {claudeData && claudeData.summary && claudeData.summary.totalActive > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
          <HoverDiv
            style={{
              ...styles.card,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(26,26,26,0.8) 100%)',
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards',
              animationDelay: '0.4s',
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>Claude Sessions</div>
            <div style={{ ...styles.cardValue, color: '#fff' }}>{claudeData.summary.totalActive}</div>
          </HoverDiv>
          <HoverDiv
            style={{
              ...styles.card,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(26,26,26,0.8) 100%)',
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards',
              animationDelay: '0.46s',
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>Needs Approval</div>
            <div style={{ ...styles.cardValue, color: '#ef4444' }}>{(claudeData.sessions || []).filter(s => s.status === 'permission').length}</div>
          </HoverDiv>
        </div>
      )}

      {/* Focus Score + Donut */}
      <div style={styles.row}>
        <HoverDiv
          style={{ ...styles.card, flex: '0 0 220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
        >
          <div style={styles.cardLabel}>Focus Score</div>
          <FocusScoreGauge score={focusScore || 0} size={150} />
          <div style={styles.focusStats}>
            <div style={styles.focusStat}>
              <span style={styles.focusStatValue}>{focusSessionCount || 0}</span>
              <span style={styles.focusStatLabel}>Sessions</span>
            </div>
            <div style={styles.focusStat}>
              <span style={styles.focusStatValue}>{formatDuration(avgFocusDuration || 0)}</span>
              <span style={styles.focusStatLabel}>Avg Focus</span>
            </div>
          </div>
        </HoverDiv>

        <HoverDiv
          style={{ ...styles.card, flex: 1, minWidth: 280 }}
          hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
        >
          <div style={styles.cardLabel}>Time by Category</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <defs>
                  {chartData.map((entry, i) => (
                    <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                  <filter id="pieGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={`url(#pieGrad${i})`} filter="url(#pieGlow)" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatDuration(value)}
                  contentStyle={TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={styles.emptyState}>No data yet</div>
          )}
          <div style={styles.legend}>
            {chartData.map((entry, i) => (
              <div key={i} style={styles.legendItem}>
                <div style={{
                  ...styles.legendDot,
                  background: entry.color,
                  boxShadow: `0 0 6px ${entry.color}60`,
                }} />
                <span style={styles.legendLabel}>{entry.name}</span>
                <span style={styles.legendValue}>{formatDuration(entry.value)}</span>
              </div>
            ))}
          </div>
        </HoverDiv>
      </div>

      {/* Timeline */}
      <HoverDiv
        style={{ ...styles.card, marginTop: 16 }}
        hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}
      >
        <div style={styles.cardLabel}>Timeline</div>
        <TimelineBar sessions={timeline} />
      </HoverDiv>

      {/* Attention + Top Apps */}
      <div style={{ ...styles.row, marginTop: 16 }}>
        <HoverDiv
          style={{ ...styles.card, flex: 1, minWidth: 300 }}
          hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
        >
          <div style={styles.cardLabel}>App Switches per Hour</div>
          {attentionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attentionData}>
                <defs>
                  <linearGradient id="barGradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hour" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="switches" fill="url(#barGradBlue)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={styles.emptyState}>Building attention data...</div>
          )}
        </HoverDiv>

        <HoverDiv
          style={{ ...styles.card, flex: 1, minWidth: 300 }}
          hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
        >
          <div style={styles.cardLabel}>Top Apps & Sites</div>
          <div style={styles.appList}>
            {(topApps || []).map((app, i) => (
              <HoverDiv
                key={i}
                style={styles.appRow}
                hoverStyle={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div style={styles.appRank}>{i + 1}</div>
                <div style={styles.appInfo}>
                  <div style={styles.appName}>{app.app_name}</div>
                  <span
                    style={{
                      ...styles.categoryBadge,
                      background: (CATEGORY_COLORS[app.category] || '#555') + '15',
                      color: CATEGORY_COLORS[app.category] || '#555',
                    }}
                  >
                    {CATEGORY_LABELS[app.category] || app.category}
                  </span>
                </div>
                <div style={styles.appTime}>{formatDuration(app.total_seconds)}</div>
              </HoverDiv>
            ))}
            {(!topApps || topApps.length === 0) && (
              <div style={styles.emptyState}>No app usage recorded yet</div>
            )}
          </div>
        </HoverDiv>
      </div>

      {/* Focus Sessions */}
      {focusSessions && focusSessions.length > 0 && (
        <HoverDiv
          style={{ ...styles.card, marginTop: 16 }}
          hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}
        >
          <div style={styles.cardLabel}>Focus Sessions (30+ min productive blocks)</div>
          <div style={styles.focusSessionList}>
            {focusSessions.map((fs, i) => (
              <HoverDiv
                key={i}
                style={styles.focusSessionRow}
                hoverStyle={{ background: 'rgba(34,197,94,0.04)' }}
              >
                <div style={styles.focusSessionIcon}>●</div>
                <div style={styles.focusSessionInfo}>
                  <div style={styles.focusSessionApp}>{fs.primary_app}</div>
                  <div style={styles.focusSessionTime}>
                    {new Date(fs.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(fs.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={styles.focusSessionDuration}>{formatDuration(fs.duration_seconds)}</div>
              </HoverDiv>
            ))}
          </div>
        </HoverDiv>
      )}
    </div>
  );
}

const styles = {
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 24,
    letterSpacing: '-0.5px',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
    marginBottom: 16,
  },
  card: {
    background: CARD_BG,
    borderRadius: 14,
    padding: 20,
    border: GLASS_BORDER,
    boxShadow: CARD_SHADOW,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: 600,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  row: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap',
  },
  focusStats: {
    display: 'flex',
    gap: 24,
    marginTop: 14,
  },
  focusStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  focusStatValue: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
  },
  focusStatLabel: {
    fontSize: 10,
    color: '#555',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 18px',
    marginTop: 12,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 12,
    color: '#888',
  },
  legendValue: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  appList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 300,
    overflowY: 'auto',
  },
  appRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 10px',
    borderRadius: 8,
    transition: 'background 0.15s ease',
  },
  appRank: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: '#666',
    flexShrink: 0,
    fontWeight: 600,
  },
  appInfo: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    fontSize: 13,
    color: '#eee',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  categoryBadge: {
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 4,
    fontWeight: 500,
    display: 'inline-block',
    marginTop: 3,
  },
  appTime: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  emptyState: {
    color: '#444',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
  focusSessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  focusSessionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 10px',
    borderRadius: 8,
    transition: 'background 0.15s ease',
  },
  focusSessionIcon: {
    color: '#22c55e',
    fontSize: 10,
    textShadow: '0 0 8px rgba(34,197,94,0.6)',
  },
  focusSessionInfo: {
    flex: 1,
  },
  focusSessionApp: {
    fontSize: 13,
    color: '#eee',
    fontWeight: 500,
  },
  focusSessionTime: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  focusSessionDuration: {
    fontSize: 15,
    fontWeight: 600,
    color: '#22c55e',
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 0 12px rgba(34,197,94,0.3)',
  },
};

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import api from '../lib/api';
import { GLASS_BORDER, CARD_SHADOW, CARD_HOVER_SHADOW, CARD_BG, TOOLTIP_STYLE, HoverDiv, TASK_STATUS_COLORS } from '../lib/theme.jsx';
import HeatmapCalendar from '../components/HeatmapCalendar';

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CARD_GRADIENTS = [
  (score) => `linear-gradient(135deg, ${score >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(251,146,60,0.1)'} 0%, rgba(26,26,26,0.8) 100%)`,
  () => 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(26,26,26,0.8) 100%)',
  () => 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(26,26,26,0.8) 100%)',
  () => 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(26,26,26,0.8) 100%)',
];

export default function TrendsPage() {
  const [range, setRange] = useState('week');
  const [summaries, setSummaries] = useState([]);
  const [attention, setAttention] = useState([]);
  const [taskTrends, setTaskTrends] = useState([]);
  const [claudeStats, setClaudeStats] = useState(null);
  const [hoveredRange, setHoveredRange] = useState(null);

  function dateStr(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function fetchData() {
    try {
      const weeks = range === 'week' ? 1 : range === 'month' ? 4 : 12;
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
      const startDate = dateStr(days);
      const endDate = dateStr(0);
      const [s, a, t, cs] = await Promise.all([
        api.getWeeklyTrends(weeks),
        api.getAttentionTrends(days),
        api.getTaskMetricsRange(startDate, endDate),
        api.getClaudeStats(),
      ]);
      setSummaries(s || []);
      setAttention(a || []);
      setTaskTrends(t || []);
      setClaudeStats(cs);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  }

  useEffect(() => { fetchData(); }, [range]);

  const focusData = summaries.map(s => ({
    date: s.date.slice(5),
    fullDate: s.date,
    focusScore: Math.round(s.focus_score),
    productiveHours: +(s.productive_seconds / 3600).toFixed(1),
    distractingHours: +(s.distracting_seconds / 3600).toFixed(1),
    totalHours: +(s.total_tracked_seconds / 3600).toFixed(1),
  }));

  const timeData = summaries.map(s => ({
    date: s.date.slice(5),
    productive: +(s.productive_seconds / 3600).toFixed(1),
    neutral: +(s.neutral_seconds / 3600).toFixed(1),
    distracting: +(s.distracting_seconds / 3600).toFixed(1),
  }));

  const dailySwitches = {};
  for (const a of attention) {
    if (!dailySwitches[a.date]) dailySwitches[a.date] = 0;
    dailySwitches[a.date] += a.app_switches;
  }
  const switchData = Object.entries(dailySwitches).map(([date, switches]) => ({
    date: date.slice(5),
    switches,
  }));

  const heatmapData = {};
  for (const s of summaries) heatmapData[s.date] = s.focus_score;

  // Exclude today from averages — partial day skews results
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const pastSummaries = summaries.filter(s => s.date !== todayDateStr);
  const pastSwitchData = switchData.filter(s => s.date !== todayDateStr.slice(5));

  const avgScore = pastSummaries.length > 0
    ? Math.round(pastSummaries.reduce((s, d) => s + d.focus_score, 0) / pastSummaries.length) : 0;
  const avgProductiveHrs = pastSummaries.length > 0
    ? (pastSummaries.reduce((s, d) => s + d.productive_seconds, 0) / pastSummaries.length / 3600).toFixed(1) : '0';
  const avgSwitches = pastSwitchData.length > 0
    ? Math.round(pastSwitchData.reduce((s, d) => s + d.switches, 0) / pastSwitchData.length) : 0;
  const totalFocusSessions = summaries.reduce((s, d) => s + d.focus_session_count, 0);

  const summaryCards = [
    { label: 'Avg Focus Score', value: String(avgScore), color: avgScore >= 50 ? '#22c55e' : '#fb923c' },
    { label: 'Avg Productive/Day', value: `${avgProductiveHrs}h`, color: '#22c55e' },
    { label: 'Avg Switches/Day', value: String(avgSwitches), color: '#3b82f6' },
    { label: 'Focus Sessions', value: String(totalFocusSessions), color: '#a855f7' },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div style={styles.header}>
        <h1 style={styles.title}>Trends</h1>
        <div style={styles.rangeToggle}>
          {['week', 'month', 'quarter'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              onMouseEnter={() => setHoveredRange(r)}
              onMouseLeave={() => setHoveredRange(null)}
              style={{
                ...styles.rangeButton,
                ...(range === r ? styles.rangeButtonActive : {}),
                ...(hoveredRange === r && range !== r ? { background: 'rgba(255,255,255,0.04)', color: '#bbb' } : {}),
              }}
            >
              {r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        {summaryCards.map((card, i) => (
          <HoverDiv
            key={i}
            style={{
              ...styles.card,
              background: CARD_GRADIENTS[i](avgScore),
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

      {/* Focus Score Chart */}
      <HoverDiv style={{ ...styles.card, marginBottom: 14 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
        <div style={styles.cardLabel}>Daily Focus Score</div>
        {focusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={focusData}>
              <defs>
                <linearGradient id="focusBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="focusScore" fill="url(#focusBarGrad)" radius={[6, 6, 0, 0]} name="Focus Score" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={styles.emptyState}>No trend data yet. Check back after a few days of tracking.</div>
        )}
      </HoverDiv>

      {/* Time Breakdown + Switches */}
      <div style={styles.row}>
        <HoverDiv style={{ ...styles.card, flex: 1 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
          <div style={styles.cardLabel}>Daily Time Breakdown (hours)</div>
          {timeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeData}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="neutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="productive" stackId="a" fill="url(#prodGrad)" name="Productive" />
                <Bar dataKey="neutral" stackId="a" fill="url(#neutGrad)" name="Neutral" />
                <Bar dataKey="distracting" stackId="a" fill="url(#distGrad)" name="Distracting" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={styles.emptyState}>No data</div>
          )}
        </HoverDiv>

        <HoverDiv style={{ ...styles.card, flex: 1 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
          <div style={styles.cardLabel}>App Switches per Day</div>
          {switchData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={switchData}>
                <defs>
                  <linearGradient id="areaGradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="switches" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGradBlue)" name="Switches" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={styles.emptyState}>No data</div>
          )}
        </HoverDiv>
      </div>

      {/* Heatmap */}
      {range !== 'week' && (
        <HoverDiv style={{ ...styles.card, marginTop: 14 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
          <div style={styles.cardLabel}>Focus Score Heatmap</div>
          <HeatmapCalendar data={heatmapData} weeks={range === 'month' ? 5 : 13} />
        </HoverDiv>
      )}

      {/* Claude Usage */}
      {claudeStats && claudeStats.dailyActivity && claudeStats.dailyActivity.length > 0 && (() => {
        const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

        const filtered = claudeStats.dailyActivity
          .filter(d => d.date >= cutoffStr)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (filtered.length === 0) return null;

        const totalMessages = filtered.reduce((s, d) => s + d.messageCount, 0);
        const totalSessions = filtered.reduce((s, d) => s + d.sessionCount, 0);
        const totalToolCalls = filtered.reduce((s, d) => s + d.toolCallCount, 0);

        const chartData = filtered.map(d => ({
          date: d.date.slice(5),
          messages: d.messageCount,
          toolCalls: d.toolCallCount,
          sessions: d.sessionCount,
        }));

        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14, marginBottom: 14 }}>
              <HoverDiv
                style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(26,26,26,0.8) 100%)' }}
                hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
              >
                <div style={styles.cardLabel}>Claude Messages</div>
                <div style={{ ...styles.cardValue, color: '#eab308' }}>{totalMessages.toLocaleString()}</div>
              </HoverDiv>
              <HoverDiv
                style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(26,26,26,0.8) 100%)' }}
                hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
              >
                <div style={styles.cardLabel}>Claude Sessions</div>
                <div style={{ ...styles.cardValue, color: '#3b82f6' }}>{totalSessions.toLocaleString()}</div>
              </HoverDiv>
              <HoverDiv
                style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(26,26,26,0.8) 100%)' }}
                hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
              >
                <div style={styles.cardLabel}>Tool Calls</div>
                <div style={{ ...styles.cardValue, color: '#a855f7' }}>{totalToolCalls.toLocaleString()}</div>
              </HoverDiv>
            </div>

            <HoverDiv style={{ ...styles.card, marginBottom: 14 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
              <div style={styles.cardLabel}>Claude Activity</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="claudeMsgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#eab308" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#eab308" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="claudeToolGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="messages" fill="url(#claudeMsgGrad)" radius={[6, 6, 0, 0]} name="Messages" />
                  <Bar dataKey="toolCalls" fill="url(#claudeToolGrad)" radius={[6, 6, 0, 0]} name="Tool Calls" />
                </BarChart>
              </ResponsiveContainer>
            </HoverDiv>
          </>
        );
      })()}

      {/* Task Metrics */}
      {taskTrends.length > 0 && (() => {
        const taskChartData = taskTrends.map(t => ({
          date: t.date.slice(5),
          completed: t.tasks_completed,
          avgTime: t.avg_completion_seconds ? +(t.avg_completion_seconds / 60).toFixed(0) : 0,
        }));
        const totalCompleted = taskTrends.reduce((s, t) => s + t.tasks_completed, 0);
        const avgCompletionAll = taskTrends.reduce((s, t) => s + (t.avg_completion_seconds || 0), 0) / taskTrends.length;

        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginTop: 14 }}>
              <HoverDiv
                style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(26,26,26,0.8) 100%)' }}
                hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
              >
                <div style={styles.cardLabel}>Tasks Completed</div>
                <div style={{ ...styles.cardValue, color: TASK_STATUS_COLORS.done }}>{totalCompleted}</div>
              </HoverDiv>
              <HoverDiv
                style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(26,26,26,0.8) 100%)' }}
                hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
              >
                <div style={styles.cardLabel}>Avg Completion Time</div>
                <div style={{ ...styles.cardValue, color: '#3b82f6' }}>{formatDuration(Math.round(avgCompletionAll))}</div>
              </HoverDiv>
            </div>

            <HoverDiv style={{ ...styles.card, marginTop: 14 }} hoverStyle={{ boxShadow: CARD_HOVER_SHADOW }}>
              <div style={styles.cardLabel}>Tasks Completed per Day</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={taskChartData}>
                  <defs>
                    <linearGradient id="taskBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="completed" fill="url(#taskBarGrad)" radius={[6, 6, 0, 0]} name="Tasks Completed" />
                </BarChart>
              </ResponsiveContainer>
            </HoverDiv>
          </>
        );
      })()}
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  rangeToggle: {
    display: 'flex',
    gap: 2,
    background: 'rgba(20,20,20,0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 10,
    padding: 3,
    border: GLASS_BORDER,
  },
  rangeButton: {
    padding: '7px 16px',
    border: 'none',
    background: 'transparent',
    color: '#666',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  rangeButtonActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
    marginBottom: 14,
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
  emptyState: {
    color: '#444',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
};

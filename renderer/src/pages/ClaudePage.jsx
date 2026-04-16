import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { GLASS_BORDER, CARD_SHADOW, CARD_HOVER_SHADOW, CARD_BG, HoverDiv } from '../lib/theme.jsx';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeAgo(ms) {
  if (!ms) return '--';
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

const STATUS_CONFIG = {
  waiting: { color: '#eab308', label: 'Idle', glow: 'rgba(234,179,8,0.4)' },
  permission: { color: '#ef4444', label: 'Needs approval', glow: 'rgba(239,68,68,0.4)' },
  working: { color: '#22c55e', label: 'Working...', glow: 'rgba(34,197,94,0.4)' },
  dead: { color: '#555', label: 'Dead', glow: 'none' },
};

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.dead;
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: cfg.color,
      boxShadow: cfg.glow !== 'none' ? `0 0 8px ${cfg.glow}` : 'none',
      animation: status !== 'dead' ? 'pulse 2s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }} />
  );
}

function Badge({ children, color = '#555' }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      color,
      background: `${color}18`,
      padding: '2px 8px',
      borderRadius: 4,
      border: `1px solid ${color}30`,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

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

export default function ClaudePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  async function fetchData() {
    try {
      const result = await api.getClaudeSessions();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch claude sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div>
        <div style={{ height: 28, width: 160, background: '#1a1a1a', borderRadius: 8, marginBottom: 24 }} />
        <div style={styles.summaryGrid}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} delay={i * 0.1} />)}
        </div>
        <SkeletonCard height={200} delay={0.3} />
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const summary = data?.summary || { totalActive: 0, needsAttention: 0, working: 0, longestRunningMs: 0 };

  // Group by project
  const groups = {};
  for (const s of sessions) {
    if (!groups[s.projectName]) groups[s.projectName] = [];
    groups[s.projectName].push(s);
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  const needsApproval = sessions.filter(s => s.status === 'permission').length;

  const summaryCards = [
    { label: 'Active Sessions', value: String(summary.totalActive), color: '#fff', gradient: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(26,26,26,0.8) 100%)' },
    { label: 'Working', value: String(summary.working), color: '#22c55e', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(26,26,26,0.8) 100%)' },
    { label: 'Needs Approval', value: String(needsApproval), color: '#ef4444', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(26,26,26,0.8) 100%)' },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={styles.title}>Claude Sessions</h1>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        {summaryCards.map((card, i) => (
          <HoverDiv
            key={i}
            style={{
              ...styles.card,
              background: card.gradient,
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards',
              animationDelay: `${i * 0.06}s`,
            }}
            hoverStyle={{ transform: 'translateY(-2px)', boxShadow: CARD_HOVER_SHADOW }}
          >
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={{ ...styles.cardValue, color: card.color }}>{card.value}</div>
          </HoverDiv>
        ))}
      </div>

      {/* Session List */}
      {sessions.length === 0 ? (
        <div style={styles.emptyState}>No active Claude sessions</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sortedGroups.map(([projectName, projectSessions]) => (
            <div key={projectName}>
              {/* Project header */}
              <div style={styles.projectHeader}>
                <span style={styles.projectName}>{projectName}</span>
                <span style={styles.projectCount}>{projectSessions.length} session{projectSessions.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Session cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projectSessions.map(session => {
                  const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.dead;
                  return (
                    <HoverDiv
                      key={session.pid}
                      style={{
                        ...styles.sessionCard,
                        borderLeft: `3px solid ${cfg.color}`,
                      }}
                      hoverStyle={{ background: 'rgba(255,255,255,0.05)', boxShadow: CARD_HOVER_SHADOW }}
                    >
                      <div style={styles.sessionRow}>
                        <div style={styles.sessionMain}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusDot status={session.status} />
                            <span style={{ ...styles.statusText, color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <div style={styles.sessionMeta}>
                            <span style={styles.metaItem}>Running {formatDuration(session.durationMs)}</span>
                            <span style={styles.metaDot} />
                            <span style={styles.metaItem}>Last active {formatTimeAgo(session.lastActivityAgo)}</span>
                          </div>
                        </div>
                        <div style={styles.sessionBadges}>
                          <Badge color="#666">{session.kind}</Badge>
                          <Badge color="#555">PID {session.pid}</Badge>
                        </div>
                      </div>
                    </HoverDiv>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Longest running info */}
      {summary.longestRunningMs > 0 && (
        <div style={styles.footer}>
          Longest running: {formatDuration(summary.longestRunningMs)}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    marginBottom: 24,
    color: '#fff',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
    marginBottom: 24,
  },
  card: {
    background: CARD_BG,
    border: GLASS_BORDER,
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: CARD_SHADOW,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#555',
    fontSize: 14,
    padding: '60px 0',
  },
  projectHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingLeft: 4,
  },
  projectName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#ddd',
    letterSpacing: '-0.2px',
  },
  projectCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: 500,
  },
  sessionCard: {
    background: 'rgba(26,26,26,0.5)',
    border: GLASS_BORDER,
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: CARD_SHADOW,
    transition: 'all 0.2s ease',
  },
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sessionMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: 600,
  },
  sessionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
  },
  metaItem: {
    fontSize: 11,
    color: '#777',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: '#444',
  },
  sessionBadges: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  footer: {
    marginTop: 24,
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
  },
};

import React, { useMemo, useState } from 'react';
import { CATEGORY_COLORS, CATEGORY_LABELS, GLASS_BORDER } from '../lib/theme.jsx';

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function TimelineBar({ sessions }) {
  const [hoveredSeg, setHoveredSeg] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { segments, startHour, endHour } = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      const now = new Date();
      return { segments: [], startHour: 9, endHour: now.getHours() + 1 };
    }

    const first = new Date(sessions[0].started_at);
    const last = sessions[sessions.length - 1];
    const lastEnd = last.ended_at ? new Date(last.ended_at) : new Date();

    const sH = first.getHours();
    const eH = Math.min(lastEnd.getHours() + 1, 24);

    const totalMinutes = (eH - sH) * 60;
    if (totalMinutes <= 0) return { segments: [], startHour: sH, endHour: eH };

    const segs = sessions.map(s => {
      const start = new Date(s.started_at);
      const end = s.ended_at ? new Date(s.ended_at) : new Date();
      const startMin = (start.getHours() - sH) * 60 + start.getMinutes();
      const endMin = (end.getHours() - sH) * 60 + end.getMinutes();
      const left = (startMin / totalMinutes) * 100;
      const width = Math.max(((endMin - startMin) / totalMinutes) * 100, 0.3);

      return {
        left,
        width,
        color: CATEGORY_COLORS[s.category] || '#555',
        appName: s.app_name,
        domain: s.domain,
        category: s.category,
        duration: s.duration_seconds,
        startTime: formatTime(s.started_at),
      };
    });

    return { segments: segs, startHour: sH, endHour: eH };
  }, [sessions]);

  const hourMarkers = [];
  for (let h = startHour; h <= endHour; h++) {
    const pct = ((h - startHour) / (endHour - startHour)) * 100;
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    hourMarkers.push({ pct, label });
  }

  return (
    <div style={styles.container}>
      {/* Hour labels */}
      <div style={styles.hourRow}>
        {hourMarkers.map((m, i) => (
          <span key={i} style={{ ...styles.hourLabel, left: `${m.pct}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Timeline bar */}
      <div style={styles.barContainer}>
        {/* Grid lines */}
        {hourMarkers.map((m, i) => (
          <div key={i} style={{ ...styles.gridLine, left: `${m.pct}%` }} />
        ))}

        {/* Session segments */}
        {segments.map((seg, i) => (
          <div
            key={i}
            onMouseEnter={(e) => { setHoveredSeg(seg); setMousePos({ x: e.clientX, y: e.clientY }); }}
            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoveredSeg(null)}
            style={{
              ...styles.segment,
              left: `${seg.left}%`,
              width: `${seg.width}%`,
              background: seg.color,
              boxShadow: `0 0 8px ${seg.color}40`,
              opacity: hoveredSeg && hoveredSeg !== seg ? 0.5 : 1,
            }}
          />
        ))}

        {segments.length === 0 && (
          <div style={styles.empty}>No sessions recorded yet</div>
        )}
      </div>

      {/* Custom glass tooltip */}
      {hoveredSeg && (
        <div style={{
          ...styles.tooltip,
          left: mousePos.x + 12,
          top: mousePos.y - 60,
        }}>
          <div style={styles.tooltipApp}>{hoveredSeg.appName}{hoveredSeg.domain ? ` · ${hoveredSeg.domain}` : ''}</div>
          <div style={styles.tooltipMeta}>
            <span style={{
              ...styles.tooltipBadge,
              background: `${hoveredSeg.color}20`,
              color: hoveredSeg.color,
            }}>
              {CATEGORY_LABELS[hoveredSeg.category] || hoveredSeg.category}
            </span>
            <span style={styles.tooltipDuration}>{hoveredSeg.startTime} · {formatDuration(hoveredSeg.duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginTop: 8,
    position: 'relative',
  },
  hourRow: {
    position: 'relative',
    height: 20,
    marginBottom: 4,
  },
  hourLabel: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    fontSize: 10,
    color: '#444',
    fontWeight: 500,
  },
  barContainer: {
    position: 'relative',
    height: 36,
    background: 'linear-gradient(180deg, rgba(17,17,17,0.8) 0%, rgba(12,12,12,1) 100%)',
    borderRadius: 10,
    overflow: 'hidden',
    border: GLASS_BORDER,
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.03)',
  },
  segment: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
    minWidth: 3,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#444',
    fontSize: 12,
  },
  tooltip: {
    position: 'fixed',
    background: 'rgba(20,20,20,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '10px 14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: '#fff',
    pointerEvents: 'none',
    zIndex: 1000,
    maxWidth: 280,
  },
  tooltipApp: {
    fontSize: 13,
    fontWeight: 600,
    color: '#eee',
    marginBottom: 4,
  },
  tooltipMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tooltipBadge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 500,
  },
  tooltipDuration: {
    fontSize: 11,
    color: '#888',
  },
};

import React, { useState } from 'react';

function getColor(score) {
  if (score === null || score === undefined) return '#111';
  if (score >= 90) return '#15803d';
  if (score >= 75) return '#16a34a';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#86efac';
  if (score >= 20) return '#fde047';
  if (score > 0) return '#fb923c';
  return '#1a1a1a';
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HeatmapCalendar({ data, weeks = 12 }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const grid = [];
  const today = new Date();
  const totalDays = weeks * 7;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayOfWeek = (d.getDay() + 6) % 7;
    const weekIndex = Math.floor((totalDays - 1 - i) / 7);

    grid.push({
      date: key,
      score: data[key] ?? null,
      dayOfWeek,
      weekIndex,
    });
  }

  const cellSize = 14;
  const cellGap = 3;

  const monthLabels = [];
  let lastMonth = -1;
  for (const cell of grid) {
    const month = new Date(cell.date).getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      monthLabels.push({
        label: new Date(cell.date).toLocaleDateString('en-US', { month: 'short' }),
        weekIndex: cell.weekIndex,
      });
    }
  }

  return (
    <div style={styles.container}>
      {/* Month labels */}
      <div style={{ ...styles.monthRow, paddingLeft: 30 }}>
        {monthLabels.map((m, i) => (
          <span
            key={i}
            style={{ ...styles.monthLabel, left: 30 + m.weekIndex * (cellSize + cellGap) }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div style={styles.gridWrapper}>
        {/* Day labels */}
        <div style={styles.dayLabels}>
          {DAYS.map((d, i) => (
            <span key={i} style={{ ...styles.dayLabel, top: i * (cellSize + cellGap) }}>
              {i % 2 === 0 ? d : ''}
            </span>
          ))}
        </div>

        {/* Cells */}
        <svg
          width={weeks * (cellSize + cellGap)}
          height={7 * (cellSize + cellGap)}
          style={{ display: 'block' }}
        >
          {grid.map((cell, i) => (
            <rect
              key={i}
              x={cell.weekIndex * (cellSize + cellGap)}
              y={cell.dayOfWeek * (cellSize + cellGap)}
              width={cellSize}
              height={cellSize}
              rx={4}
              fill={getColor(cell.score)}
              stroke={hoveredCell === i ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.03)'}
              strokeWidth={1}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.15s ease, stroke 0.15s ease',
                filter: hoveredCell === i ? 'brightness(1.3)' : 'none',
              }}
              onMouseEnter={(e) => { setHoveredCell(i); setMousePos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredCell(null)}
            />
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredCell !== null && (
        <div style={{
          ...styles.tooltip,
          left: mousePos.x + 12,
          top: mousePos.y - 50,
        }}>
          <div style={styles.tooltipDate}>{grid[hoveredCell].date}</div>
          <div style={styles.tooltipScore}>
            {grid[hoveredCell].score !== null
              ? `Score: ${Math.round(grid[hoveredCell].score)}`
              : 'No data'}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendText}>Less</span>
        {[0, 20, 40, 60, 75, 90].map((s, i) => (
          <div key={i} style={{
            ...styles.legendCell,
            background: getColor(s),
            border: '1px solid rgba(255,255,255,0.04)',
          }} />
        ))}
        <span style={styles.legendText}>More</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    animation: 'fadeIn 0.4s ease',
  },
  monthRow: {
    position: 'relative',
    height: 20,
    marginBottom: 4,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 11,
    color: '#555',
    fontWeight: 500,
  },
  gridWrapper: {
    display: 'flex',
    gap: 4,
  },
  dayLabels: {
    position: 'relative',
    width: 26,
  },
  dayLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#444',
    fontWeight: 500,
  },
  tooltip: {
    position: 'fixed',
    background: 'rgba(20,20,20,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: '#fff',
    pointerEvents: 'none',
    zIndex: 1000,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: 600,
    color: '#eee',
  },
  tooltipScore: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#555',
    marginRight: 3,
    marginLeft: 3,
    fontWeight: 500,
  },
};

import React from 'react';

function getScoreColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#fb923c';
  return '#ef4444';
}

function getScoreLabel(score) {
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Low';
}

export default function FocusScoreGauge({ score = 0, size = 160 }) {
  const strokeWidth = 10;
  const bgStrokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = getScoreColor(score);
  const center = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
          <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={bgStrokeWidth}
        />

        {/* Progress arc with glow */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          filter="url(#gaugeGlow)"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
        />

        {/* Score number */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.26}
          fontWeight="700"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
          style={{ filter: `drop-shadow(0 0 10px ${color}50)` }}
        >
          {Math.round(score)}
        </text>

        {/* Label */}
        <text
          x={center}
          y={center + 18}
          textAnchor="middle"
          fill="#555"
          fontSize={11}
          fontWeight="500"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
          letterSpacing="0.5"
        >
          {getScoreLabel(score)}
        </text>
      </svg>
    </div>
  );
}

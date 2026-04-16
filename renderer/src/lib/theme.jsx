import React, { useState } from 'react';

// ─── Design Tokens ───
export const GLASS_BORDER = '1px solid rgba(255,255,255,0.06)';
export const CARD_SHADOW = '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)';
export const CARD_HOVER_SHADOW = '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)';
export const CARD_BG = 'rgba(26,26,26,0.7)';
export const TOOLTIP_STYLE = {
  background: 'rgba(20,20,20,0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: '#fff',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};
export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif';

export const CATEGORY_COLORS = {
  veryProductive: '#22c55e',
  productive: '#86efac',
  neutral: '#94a3b8',
  distracting: '#fb923c',
  veryDistracting: '#ef4444',
};

export const CATEGORY_LABELS = {
  veryProductive: 'Very Productive',
  productive: 'Productive',
  neutral: 'Neutral',
  distracting: 'Distracting',
  veryDistracting: 'Very Distracting',
};

export const TASK_TYPE_COLORS = { work: '#3b82f6', personal: '#a855f7' };
export const TASK_STATUS_COLORS = { todo: '#94a3b8', inprogress: '#eab308', done: '#22c55e' };

// ─── Reusable HoverDiv (inline styles can't do :hover) ───
export function HoverDiv({ style, hoverStyle, children, ...props }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      {...props}
      style={{ ...style, ...(hovered ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

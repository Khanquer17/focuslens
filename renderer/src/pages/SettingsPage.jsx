import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { CATEGORY_COLORS, CATEGORY_LABELS, GLASS_BORDER, CARD_SHADOW, CARD_BG, HoverDiv } from '../lib/theme.jsx';

const CATEGORIES = ['veryProductive', 'productive', 'neutral', 'distracting', 'veryDistracting'];

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SettingsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time'); // time, recent, name
  const [saving, setSaving] = useState({});
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredFilter, setHoveredFilter] = useState(null);
  const [hoveredSort, setHoveredSort] = useState(null);

  async function fetchCategories() {
    try {
      const result = await api.getCategories();
      setItems(result || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  async function handleCategoryChange(item, newCategory) {
    const key = `${item.type}:${item.value}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    try {
      await api.updateCategory(item.type, item.value, newCategory);
      setItems(prev => prev.map(i =>
        i.type === item.type && i.value === item.value
          ? { ...i, category: newCategory, isCustom: true }
          : i
      ));
    } catch (err) {
      console.error('Failed to update:', err);
    }

    setTimeout(() => {
      setSaving(prev => ({ ...prev, [key]: false }));
    }, 800);
  }

  const filtered = items.filter(i => {
    if (filter === 'apps' && i.type !== 'app') return false;
    if (filter === 'domains' && i.type !== 'domain') return false;
    if (filter === 'edited' && !i.isCustom) return false;
    if (filter === 'notEdited' && (i.isCustom || i.category !== 'neutral')) return false;
    if (search) {
      const s = search.toLowerCase();
      return i.displayName.toLowerCase().includes(s) || i.value.toLowerCase().includes(s);
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'time') return b.totalSeconds - a.totalSeconds;
    if (sortBy === 'recent') return new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0);
    if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
    return 0;
  });

  const appCount = items.filter(i => i.type === 'app').length;
  const domainCount = items.filter(i => i.type === 'domain').length;
  const editedCount = items.filter(i => i.isCustom).length;
  const notEditedCount = items.filter(i => !i.isCustom && i.category === 'neutral').length;

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={styles.title}>Settings</h1>

      <div style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>App & Website Categories</div>
            <p style={styles.sectionDesc}>
              Auto-categorized based on your actual usage. Change any category and it'll apply retroactively.
            </p>
          </div>
        </div>

        {/* Filter tabs + Sort + Search */}
        <div style={styles.toolbar}>
          <div style={styles.toolbarRow}>
            <div style={styles.filterTabs}>
              {[
                { id: 'all', label: `All (${items.length})` },
                { id: 'apps', label: `Apps (${appCount})` },
                { id: 'domains', label: `Websites (${domainCount})` },
                { id: 'notEdited', label: `Neutral (${notEditedCount})` },
                { id: 'edited', label: `Edited (${editedCount})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  onMouseEnter={() => setHoveredFilter(tab.id)}
                  onMouseLeave={() => setHoveredFilter(null)}
                  style={{
                    ...styles.filterTab,
                    ...(filter === tab.id ? styles.filterTabActive : {}),
                    ...(hoveredFilter === tab.id && filter !== tab.id ? { background: 'rgba(255,255,255,0.04)', color: '#bbb' } : {}),
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search apps & websites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                ...styles.searchInput,
                ...(searchFocused ? styles.searchInputFocused : {}),
              }}
            />
          </div>
          <div style={styles.toolbarRow}>
            <div style={styles.sortTabs}>
              {[
                { id: 'time', label: 'Most Used' },
                { id: 'recent', label: 'Recent' },
                { id: 'name', label: 'A–Z' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSortBy(tab.id)}
                  onMouseEnter={() => setHoveredSort(tab.id)}
                  onMouseLeave={() => setHoveredSort(null)}
                  style={{
                    ...styles.sortTab,
                    ...(sortBy === tab.id ? styles.sortTabActive : {}),
                    ...(hoveredSort === tab.id && sortBy !== tab.id ? { background: 'rgba(255,255,255,0.04)', color: '#bbb' } : {}),
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items list */}
        <div style={styles.list}>
          {filtered.map(item => {
            const key = `${item.type}:${item.value}`;
            const isSaving = saving[key];

            return (
              <HoverDiv
                key={key}
                style={styles.row}
                hoverStyle={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {/* Icon + Name */}
                <div style={styles.nameCol}>
                  <div style={{
                    ...styles.typeIcon,
                    background: item.type === 'app' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                    color: item.type === 'app' ? '#a855f7' : '#3b82f6',
                  }}>
                    {item.type === 'app' ? '◻' : '◎'}
                  </div>
                  <div style={styles.nameInfo}>
                    <div style={styles.displayName}>{item.displayName}</div>
                    {item.type === 'app' && item.displayName !== item.value && (
                      <div style={styles.bundleId}>{item.value}</div>
                    )}
                  </div>
                </div>

                {/* Usage stats */}
                <div style={styles.statsCol}>
                  <span style={styles.statTime}>{formatDuration(item.totalSeconds)}</span>
                  <span style={styles.statMeta}>{item.sessionCount} sessions</span>
                  <span style={styles.statMeta}>{timeAgo(item.lastUsed)}</span>
                </div>

                {/* Category selector */}
                <div style={styles.categoryCol}>
                  <select
                    value={item.category}
                    onChange={(e) => handleCategoryChange(item, e.target.value)}
                    style={{
                      ...styles.categorySelect,
                      color: CATEGORY_COLORS[item.category] || '#888',
                      ...(isSaving ? {
                        borderColor: 'rgba(34,197,94,0.5)',
                        boxShadow: '0 0 0 2px rgba(34,197,94,0.15)',
                      } : {}),
                    }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                  {item.isCustom && (
                    <span style={styles.customBadge}>edited</span>
                  )}
                </div>
              </HoverDiv>
            );
          })}

          {filtered.length === 0 && (
            <div style={styles.emptyState}>
              {items.length === 0
                ? 'No usage data yet. Start using your Mac and apps/websites will appear here automatically.'
                : 'No results match your search.'}
            </div>
          )}
        </div>
      </div>
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
  card: {
    background: CARD_BG,
    borderRadius: 14,
    padding: 24,
    border: GLASS_BORDER,
    boxShadow: CARD_SHADOW,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4,
    letterSpacing: '-0.3px',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#555',
    margin: 0,
    lineHeight: 1.5,
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 16,
    gap: 10,
  },
  toolbarRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  filterTabs: {
    display: 'flex',
    gap: 2,
    background: 'rgba(20,20,20,0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 10,
    padding: 3,
    border: GLASS_BORDER,
  },
  filterTab: {
    padding: '7px 14px',
    border: 'none',
    background: 'transparent',
    color: '#666',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  sortTabs: {
    display: 'flex',
    gap: 2,
    background: 'rgba(20,20,20,0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 10,
    padding: 3,
    border: GLASS_BORDER,
  },
  sortTab: {
    padding: '7px 12px',
    border: 'none',
    background: 'transparent',
    color: '#666',
    fontSize: 11,
    fontWeight: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  sortTabActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  searchInput: {
    padding: '8px 14px',
    background: 'rgba(17,17,17,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    outline: 'none',
    width: 220,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  searchInputFocused: {
    borderColor: 'rgba(34,197,94,0.4)',
    boxShadow: '0 0 0 3px rgba(34,197,94,0.1)',
  },
  list: {
    maxHeight: 500,
    overflowY: 'auto',
    paddingRight: 4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    gap: 16,
    borderRadius: 8,
    transition: 'background 0.15s ease',
  },
  nameCol: {
    flex: 1.5,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  typeIcon: {
    fontSize: 14,
    flexShrink: 0,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  nameInfo: {
    minWidth: 0,
  },
  displayName: {
    fontSize: 13,
    color: '#eee',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bundleId: {
    fontSize: 10,
    color: '#444',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 1,
  },
  statsCol: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  statTime: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: 500,
    minWidth: 50,
    fontVariantNumeric: 'tabular-nums',
  },
  statMeta: {
    fontSize: 11,
    color: '#444',
  },
  categoryCol: {
    flex: 0.8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  categorySelect: {
    padding: '6px 28px 6px 10px',
    background: 'rgba(17,17,17,0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    WebkitAppearance: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' fill='none' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  },
  customBadge: {
    fontSize: 9,
    color: '#22c55e',
    background: 'rgba(34,197,94,0.1)',
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 600,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  emptyState: {
    color: '#444',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
    lineHeight: 1.6,
  },
};

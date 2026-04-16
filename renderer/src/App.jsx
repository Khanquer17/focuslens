import React, { useState, useEffect } from 'react';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import TrendsPage from './pages/TrendsPage';
import SettingsPage from './pages/SettingsPage';
import ClaudePage from './pages/ClaudePage';
import { FONT_STACK } from './lib/theme.jsx';

const TABS = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'tasks', label: 'Tasks', icon: '☰' },
  { id: 'trends', label: 'Trends', icon: '◈' },
  { id: 'claude', label: 'Claude', icon: '⬡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [hoveredTab, setHoveredTab] = useState(null);

  // Inject keyframe animations once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      /* Scrollbar styling */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◎</span>
          <span style={styles.logoText}>FocusLens</span>
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              ...styles.navButton,
              ...(activeTab === tab.id ? styles.navButtonActive : {}),
              ...(hoveredTab === tab.id && activeTab !== tab.id ? styles.navButtonHover : {}),
            }}
          >
            <span style={{
              ...styles.navIcon,
              ...(activeTab === tab.id ? { color: '#22c55e' } : {}),
            }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}

        <div style={styles.sidebarSpacer} />
        <div style={styles.sidebarFooter}>
          <span style={styles.versionText}>v1.0.0</span>
        </div>
      </nav>
      <main key={activeTab} style={styles.main}>
        {activeTab === 'today' && <TodayPage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'trends' && <TrendsPage />}
        {activeTab === 'claude' && <ClaudePage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0a0a0a',
    fontFamily: FONT_STACK,
    color: '#fff',
  },
  sidebar: {
    width: 200,
    background: 'rgba(18,18,18,0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    padding: '50px 12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    marginBottom: 20,
    animation: 'fadeIn 0.5s ease',
  },
  logoIcon: {
    fontSize: 22,
    color: '#22c55e',
    textShadow: '0 0 16px rgba(34,197,94,0.4)',
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    color: '#777',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: FONT_STACK,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
  },
  navButtonHover: {
    background: 'rgba(255,255,255,0.04)',
    color: '#bbb',
  },
  navIcon: {
    fontSize: 15,
    transition: 'color 0.2s ease',
  },
  sidebarSpacer: {
    flex: 1,
  },
  sidebarFooter: {
    padding: '8px 12px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  versionText: {
    fontSize: 11,
    color: '#444',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '50px 32px 32px',
    animation: 'fadeIn 0.3s ease',
  },
};

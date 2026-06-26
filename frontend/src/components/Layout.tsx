/**
 * Layout
 * ------
 * Shared shell (sidebar + header) used by all dashboard pages.
 * Pass `activePage` to highlight the correct nav item.
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Heart, Clock, ShieldCheck,
  Cpu, AlertTriangle, Bell,
} from 'lucide-react';
import { useFirebaseLive } from '../hooks/useFirebaseLive';

type Page = 'overview' | 'vitals' | 'alerts' | 'analytics';

interface LayoutProps {
  activePage: Page;
  title:      string;
  children:   React.ReactNode;
}

const NAV: { page: Page; label: string; icon: React.ReactNode; path: string }[] = [
  { page: 'overview',  label: 'Overview',  icon: <Activity size={20} />, path: '/dashboard' },
  { page: 'vitals',    label: 'Vitals',    icon: <Heart size={20} />,    path: '/vitals' },
  { page: 'alerts',    label: 'Alerts',    icon: <Clock size={20} />,    path: '/alerts' },
  { page: 'analytics', label: 'Analytics', icon: <Cpu size={20} />,      path: '/analytics' },
];

export const Layout = ({ activePage, title, children }: LayoutProps) => {
  const { data, loading, error } = useFirebaseLive();
  const sosActive = data?.sosActive ?? false;
  const navigate  = useNavigate();

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <Link to="/" className="brand-logo" style={{ marginBottom: '16px', fontSize: '1.4rem' }}>
          <ShieldCheck size={24} color="#6c8cff" />
          <span>EdgeGuard</span>
        </Link>

        <nav className="sidebar-nav">
          {NAV.map(({ page, label, icon, path }) => (
            <Link
              key={page}
              to={path}
              className={`nav-item${activePage === page ? ' active' : ''}`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* System status */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '16px',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            System Status
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Connecting…</div>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e53e3e' }} />
              <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#c1121f' }}>Offline</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: 'var(--accent-color)',
                  boxShadow: '0 0 0 3px rgba(202,255,191,0.5)',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span style={{ fontWeight: 500 }}>Live • ESP32</span>
            </div>
          )}

          {sosActive && (
            <div
              style={{
                marginTop: '12px', padding: '8px 12px',
                background: 'rgba(255,200,200,0.6)', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: '#c1121f', fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              <AlertTriangle size={16} />
              SOS ACTIVE
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">{title}</h1>
          <button
            className="glass-panel"
            onClick={() => navigate('/alerts')}
            style={{
              width: '40px', height: '40px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', border: '1px solid var(--glass-border)',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <Bell size={18} color="var(--text-secondary)" />
          </button>
        </header>

        {error && (
          <div
            style={{
              padding: '12px 20px', background: 'rgba(255,200,200,0.4)',
              borderRadius: '12px', color: '#c1121f',
              fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <AlertTriangle size={18} />
            Firebase error: {error}
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

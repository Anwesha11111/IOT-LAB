import { Link, useLocation } from 'react-router-dom';
import {
  Activity, Heart, Clock, ShieldCheck, Cpu, AlertTriangle,
} from 'lucide-react';
import { useFirebaseLive } from '../hooks/useFirebaseLive';

const NAV = [
  { to: '/dashboard',  label: 'Overview',   icon: <Activity size={20} /> },
  { to: '/vitals',     label: 'Vitals',     icon: <Heart size={20} /> },
  { to: '/alerts',     label: 'Alerts',     icon: <Clock size={20} /> },
  { to: '/analytics',  label: 'Analytics',  icon: <Cpu size={20} /> },
];

export const Sidebar = () => {
  const { pathname } = useLocation();
  const { data, loading, error } = useFirebaseLive();
  const sosActive = data?.sosActive ?? false;

  return (
    <aside className="sidebar">
      <Link to="/" className="brand-logo" style={{ marginBottom: '16px', fontSize: '1.4rem' }}>
        <ShieldCheck size={24} color="#6c8cff" />
        <span>EdgeGuard</span>
      </Link>

      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={`nav-item${pathname === to ? ' active' : ''}`}
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
                width: '8px',
                height: '8px',
                borderRadius: '50%',
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
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(255,200,200,0.6)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#c1121f',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <AlertTriangle size={16} />
            SOS ACTIVE
          </div>
        )}
      </div>
    </aside>
  );
};

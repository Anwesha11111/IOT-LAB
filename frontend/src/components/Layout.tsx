import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Heart, Clock, ShieldCheck,
  Cpu, AlertTriangle, Bell, PhoneCall, X, CheckCircle,
} from 'lucide-react';
import { useFirebaseLive } from '../hooks/useFirebaseLive';
import { useSosTrigger } from '../hooks/useSosTrigger';

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

// ─── SOS Confirmation Modal ──────────────────────────────────────────────────
function SosModal({
  onConfirm, onCancel, sending, sent,
}: {
  onConfirm: () => void;
  onCancel:  () => void;
  sending:   boolean;
  sent:      boolean;
}) {
  return (
    // Backdrop
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '24px',
          padding: '36px 40px', maxWidth: '400px', width: '90%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        }}
      >
        {sent ? (
          // Success state
          <>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(202,255,191,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={36} color="#2d6a4f" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2d3748', marginBottom: '6px' }}>
                SOS Sent
              </div>
              <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                Emergency signal transmitted to the device. Caregiver alert dispatched.
              </div>
            </div>
            <button
              onClick={onCancel}
              style={{
                padding: '12px 32px', borderRadius: '50px', border: 'none',
                background: 'rgba(202,255,191,0.6)', color: '#2d6a4f',
                fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
              }}
            >
              Close
            </button>
          </>
        ) : (
          // Confirm state
          <>
            {/* Icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(255,200,200,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-red 1.4s infinite',
            }}>
              <PhoneCall size={36} color="#c1121f" />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#c1121f', marginBottom: '8px' }}>
                Send Emergency SOS?
              </div>
              <div style={{ fontSize: '0.9rem', color: '#718096', lineHeight: 1.5 }}>
                This will immediately activate the SOS alarm on the wearable device
                and send a WhatsApp emergency alert to the registered caregiver.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={onCancel}
                disabled={sending}
                style={{
                  flex: 1, padding: '13px', borderRadius: '50px',
                  border: '1px solid rgba(0,0,0,0.1)', background: 'transparent',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                  color: '#718096',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={sending}
                style={{
                  flex: 1, padding: '13px', borderRadius: '50px',
                  border: 'none',
                  background: sending ? 'rgba(255,200,200,0.5)' : '#c1121f',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  boxShadow: sending ? 'none' : '0 4px 16px rgba(193,18,31,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {sending ? 'Sending…' : '🚨 Confirm SOS'}
              </button>
            </div>

            {/* Dismiss */}
            <button
              onClick={onCancel}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(0,0,0,0.06)', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} color="#718096" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────
export const Layout = ({ activePage, title, children }: LayoutProps) => {
  const { data, loading, error } = useFirebaseLive();
  const { trigger, sending }     = useSosTrigger();
  const navigate = useNavigate();

  const sosActive = data?.sosActive ?? false;

  // Modal state: 'closed' | 'confirm' | 'sent'
  const [modal, setModal] = useState<'closed' | 'confirm' | 'sent'>('closed');

  const handleSosClick = () => setModal('confirm');

  const handleConfirm = async () => {
    await trigger();
    setModal('sent');
  };

  const handleClose = () => setModal('closed');

  return (
    <div className="dashboard-layout">

      {/* ── SOS Modal (renders above everything) ── */}
      {modal !== 'closed' && (
        <SosModal
          onConfirm={handleConfirm}
          onCancel={handleClose}
          sending={sending}
          sent={modal === 'sent'}
        />
      )}

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

        {/* ── SOS Button ── */}
        <button
          onClick={handleSosClick}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            padding: '14px', borderRadius: '14px', border: 'none',
            background: sosActive
              ? 'rgba(193,18,31,0.9)'
              : 'rgba(255,200,200,0.6)',
            color: sosActive ? '#fff' : '#c1121f',
            fontWeight: 700, fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: sosActive
              ? '0 0 0 4px rgba(193,18,31,0.25), 0 4px 16px rgba(193,18,31,0.4)'
              : '0 2px 8px rgba(193,18,31,0.15)',
            animation: sosActive ? 'pulse-red 1.2s infinite' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <PhoneCall size={20} />
          {sosActive ? 'SOS ACTIVE' : 'Send SOS'}
        </button>

        {/* System status */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '16px',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
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
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--accent-color)',
                boxShadow: '0 0 0 3px rgba(202,255,191,0.5)',
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontWeight: 500 }}>Live • ESP32</span>
            </div>
          )}

          {sosActive && (
            <div style={{
              marginTop: '10px', padding: '8px 12px',
              background: 'rgba(255,200,200,0.6)', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#c1121f', fontWeight: 600, fontSize: '0.85rem',
            }}>
              <AlertTriangle size={15} />
              SOS ACTIVE
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">{title}</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Inline SOS button in header (secondary, smaller) */}
            <button
              onClick={handleSosClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '50px', border: 'none',
                background: sosActive ? '#c1121f' : 'rgba(255,200,200,0.5)',
                color: sosActive ? '#fff' : '#c1121f',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                boxShadow: sosActive ? '0 2px 10px rgba(193,18,31,0.4)' : 'none',
                animation: sosActive ? 'pulse-red 1.2s infinite' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <PhoneCall size={15} />
              {sosActive ? 'SOS ACTIVE' : 'SOS'}
            </button>

            {/* Alerts bell */}
            <button
              className="glass-panel"
              onClick={() => navigate('/alerts')}
              style={{
                width: '40px', height: '40px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', border: '1px solid var(--glass-border)',
                cursor: 'pointer',
              }}
            >
              <Bell size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </header>

        {error && (
          <div style={{
            padding: '12px 20px', background: 'rgba(255,200,200,0.4)',
            borderRadius: '12px', color: '#c1121f',
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertTriangle size={18} />
            Firebase error: {error}
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

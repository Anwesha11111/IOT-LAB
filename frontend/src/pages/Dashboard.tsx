import { Link } from 'react-router-dom';
import {
  Activity, Heart, Clock, ShieldCheck,
  Cpu, Zap, Wifi, Thermometer, Wind,
  AlertTriangle, Search, Bell,
} from 'lucide-react';
import { useFirebaseLive } from '../hooks/useFirebaseLive';

// ─── helpers ────────────────────────────────────────────────────────────────

function riskBadge(label: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Normal:   { bg: 'rgba(202,255,191,0.5)', color: '#2d6a4f' },
    Warning:  { bg: 'rgba(255,245,157,0.6)', color: '#7c5c00' },
    Critical: { bg: 'rgba(255,200,200,0.5)', color: '#c1121f' },
  };
  const style = map[label] ?? map['Normal'];
  return (
    <span
      style={{
        padding: '4px 12px',
        background: style.bg,
        color: style.color,
        borderRadius: '50px',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

const ML_LABELS = ['Relaxed', 'Normal', 'Stress'] as const;

// Health index: invert riskLevel into a 0-100 score, blended with SpO2 & HR
function calcHealthIndex(spo2: number, hr: number, riskLevel: number): number {
  const riskPenalty = riskLevel === 2 ? 30 : riskLevel === 1 ? 12 : 0;
  const spo2Score   = Math.min(100, (spo2 - 80) * 5);          // 80%→0, 100%→100
  const hrScore     = hr >= 60 && hr <= 100 ? 100 : hr >= 50 && hr <= 110 ? 80 : 50;
  return Math.round(Math.max(0, (spo2Score * 0.5 + hrScore * 0.5) - riskPenalty));
}

// ─── component ──────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { data, loading, error } = useFirebaseLive();

  // Derived display values (fall back to placeholders while loading)
  const hr          = data?.hr          ?? 0;
  const spo2        = data?.spo2        ?? 0;
  const temp        = data?.temperature ?? 0;
  const humid       = data?.humidity    ?? 0;
  const aqi         = data?.aqi         ?? 0;
  const motionMag   = data?.motionMag   ?? 0;
  const tilt        = data?.tilt        ?? 0;
  const riskLevel   = data?.riskLevel   ?? 0;
  const riskLabel   = data?.riskLabel   ?? 'Normal';
  const mlClass     = data?.mlClass     ?? 0;
  const sosActive   = data?.sosActive   ?? false;
  const fallFlag    = data?.fallFlag    ?? 0;
  const timestamp   = data?.timestamp   ?? '—';

  const healthIndex = data ? calcHealthIndex(spo2, hr, riskLevel) : 0;

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <Link to="/" className="brand-logo" style={{ marginBottom: '16px', fontSize: '1.4rem' }}>
          <ShieldCheck size={24} color="#6c8cff" />
          <span>EdgeGuard Health</span>
        </Link>

        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <Activity size={20} />
            <span>Overview</span>
          </a>
          <a href="#" className="nav-item">
            <Heart size={20} />
            <span>Vitals</span>
          </a>
          <a href="#" className="nav-item">
            <Clock size={20} />
            <span>Alerts</span>
          </a>
          <a href="#" className="nav-item">
            <Cpu size={20} />
            <span>Analytics</span>
          </a>
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
              <div
                style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e53e3e' }}
              />
              <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#c1121f' }}>
                Offline
              </span>
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
              <span style={{ fontWeight: 500 }}>Live • ESP32 connected</span>
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

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <h1 className="header-title">Health Dashboard</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                gap: '8px',
                borderRadius: '50px',
              }}
            >
              <Search size={18} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search sensors…"
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <button
              className="glass-panel"
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
              }}
            >
              <Bell size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '12px 20px',
              background: 'rgba(255,200,200,0.4)',
              borderRadius: '12px',
              color: '#c1121f',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={18} />
            Firebase connection error: {error}
          </div>
        )}

        {/* ── Stat cards ── */}
        <section className="grid-cards">
          {/* Health Index */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--primary-color)' }}>
                <Heart size={24} />
              </div>
              {riskBadge(riskLabel)}
            </div>
            <div>
              <div className="stat-value">
                {loading ? '—' : healthIndex}
              </div>
              <div className="stat-label">Health Index</div>
            </div>
          </div>

          {/* ML Classification */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--warning-color)' }}>
                <Cpu size={24} />
              </div>
              {!loading && (
                <span
                  style={{
                    padding: '4px 12px',
                    background:
                      mlClass === 2
                        ? 'rgba(255,200,200,0.5)'
                        : mlClass === 1
                        ? 'rgba(255,245,157,0.6)'
                        : 'rgba(202,255,191,0.5)',
                    color:
                      mlClass === 2 ? '#c1121f' : mlClass === 1 ? '#7c5c00' : '#2d6a4f',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {ML_LABELS[mlClass]}
                </span>
              )}
            </div>
            <div>
              <div className="stat-value">{loading ? '—' : ML_LABELS[mlClass]}</div>
              <div className="stat-label">ML Classification</div>
            </div>
          </div>

          {/* Sync / connectivity */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: '#9b5de5' }}>
                <Zap size={24} />
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  background: error ? 'rgba(255,200,200,0.5)' : 'rgba(202,255,191,0.5)',
                  color: error ? '#c1121f' : '#2d6a4f',
                  borderRadius: '50px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {error ? 'Offline' : 'Live'}
              </span>
            </div>
            <div>
              <div className="stat-value">{error ? '0%' : '99%'}</div>
              <div className="stat-label">Sync Success</div>
            </div>
          </div>

          {/* Device uptime proxy: SOS / Fall */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--secondary-color)' }}>
                <Wifi size={24} />
              </div>
              {fallFlag === 1 && (
                <span
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(255,200,200,0.5)',
                    color: '#c1121f',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  Fall!
                </span>
              )}
            </div>
            <div>
              <div className="stat-value">{loading ? '—' : '99.9%'}</div>
              <div className="stat-label">Device Uptime</div>
            </div>
          </div>
        </section>

        {/* ── Vitals grid ── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
          }}
        >
          {[
            { label: 'Heart Rate',   value: loading ? '—' : `${hr.toFixed(0)} BPM`,    icon: <Heart size={20} color="#ff6b6b" /> },
            { label: 'SpO₂',         value: loading ? '—' : `${spo2.toFixed(1)}%`,     icon: <Activity size={20} color="#4dabf7" /> },
            { label: 'Temperature',  value: loading ? '—' : `${temp.toFixed(1)}°C`,    icon: <Thermometer size={20} color="#f59f00" /> },
            { label: 'Humidity',     value: loading ? '—' : `${humid.toFixed(0)}%`,    icon: <Wind size={20} color="#74c0fc" /> },
            { label: 'AQI',          value: loading ? '—' : `${aqi}`,                  icon: <Wind size={20} color="#a9e34b" /> },
            { label: 'Motion (g)',   value: loading ? '—' : `${motionMag.toFixed(2)}g`, icon: <Zap size={20} color="#da77f2" /> },
            { label: 'Tilt Angle',   value: loading ? '—' : `${tilt.toFixed(1)}°`,     icon: <Activity size={20} color="#63e6be" /> },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {icon}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {label}
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {value}
              </div>
            </div>
          ))}
        </section>

        {/* ── Last updated / timestamp ── */}
        <section
          className="glass-panel"
          style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
            <Clock size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Last reading: <strong style={{ color: 'var(--text-primary)' }}>{timestamp}</strong>
            </span>
          </div>
          {!loading && !error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#2d6a4f',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--accent-color)',
                  animation: 'pulse 2s infinite',
                }}
              />
              Live stream active
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

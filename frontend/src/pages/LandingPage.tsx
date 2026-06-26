import { Link } from 'react-router-dom';
import { Activity, ShieldCheck, HeartPulse, Clock } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="landing-bg">
      {/* Navigation */}
      <nav style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div className="brand-logo">
          <ShieldCheck size={28} color="#6c8cff" />
          <span>EdgeGuard Health</span>
        </div>
        <div>
          <Link to="/dashboard" className="btn-secondary" style={{ marginRight: '16px' }}>Log In</Link>
          <Link to="/dashboard" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', maxWidth: '1200px', width: '100%', gap: '64px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.6)',
                padding: '8px 16px',
                borderRadius: '50px',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '24px',
                border: '1px solid var(--glass-border)'
              }}
            >
              📡 Real‑time Sensor Fusion Health Monitoring
            </div>
            <h1 style={{ fontSize: '4.5rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
              Predict<br />
              <span className="text-gradient">Health Conditions</span>
            </h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '40px', maxWidth: '500px' }}>
              EdgeGuard Health fuses data from multiple on‑board sensors, runs a lightweight sensor‑fusion model on the ESP‑32, and streams predictions to the cloud. Get instant alerts when vitals cross dangerous thresholds.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Link to="/dashboard" className="btn-primary" style={{ padding: '16px 36px' }}>
                Open Dashboard <Activity size={20} />
              </Link>
              <Link to="/demo" className="btn-secondary" style={{ padding: '16px 36px' }}>
                Live Demo
              </Link>
            </div>
          </div>
          {/* Feature Cards */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <HeartPulse size={24} color="var(--primary-color)" />
                <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Live Vital Stats</span>
              </div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Heart‑rate, SpO₂, temperature, and motion are fused into a single health index updated every second.</p>
            </div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={24} color="var(--warning-color)" />
                <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Predictive Alerts</span>
              </div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>AI model predicts potential health events up to 30 seconds before they happen.</p>
            </div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={24} color="var(--accent-color)" />
                <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Offline‑First</span>
              </div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>All inference runs on‑device; data is stored locally and synced when connectivity resumes.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;

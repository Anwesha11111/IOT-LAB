import { Link } from 'react-router-dom';
import { ShieldCheck, Activity, Users, Shield } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="landing-bg">
      <div className="content-wrapper">
        {/* Navigation */}
        <nav style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="brand-logo">
            <ShieldCheck size={28} color="#6c8cff" />
            <span>EdgeGuard IoT</span>
          </div>
          <div>
            <Link to="/dashboard" className="btn-secondary" style={{ marginRight: '16px' }}>Log In</Link>
            <Link to="/dashboard" className="btn-primary">Get Started</Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ display: 'flex', maxWidth: '1200px', width: '100%', gap: '64px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '24px', border: '1px solid var(--glass-border)' }}>
                ✨ Built for Modern IoT Security
              </div>
              <h1 style={{ fontSize: '4.5rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                Secure your network.<br />
                <span className="text-gradient">Without limits.</span>
              </h1>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '40px', maxWidth: '500px' }}>
                EdgeGuard is the first offline-first, aesthetically beautiful IoT management platform. Monitor your devices, analyze traffic, and detect anomalies in real-time.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <Link to="/dashboard" className="btn-primary" style={{ padding: '16px 36px' }}>
                  Open Dashboard <Activity size={20} />
                </Link>
                <Link to="/demo" className="btn-secondary" style={{ padding: '16px 36px' }}>
                  Try Demo
                </Link>
              </div>
              
              <div style={{ display: 'flex', gap: '32px', marginTop: '64px' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>24/7</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>Active Monitoring</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>100%</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>Offline Capable</div>
                </div>
              </div>
            </div>

            {/* Feature Cards Showcase */}
            <div style={{ flex: 1, position: 'relative' }}>
              <div className="glass-panel" style={{ padding: '32px', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <Shield color="var(--primary-color)" size={24} />
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Live Threat Feed</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.6)', borderRadius: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning-color)', marginTop: '6px' }}></div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>DDoS Attempt Blocked</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Detected 5,000 req/s from Node 42. Auto-mitigated successfully.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.6)', borderRadius: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)', marginTop: '6px' }}></div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Firmware Updated</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ESP32 Cluster A successfully patched to v2.1.0.</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="glass-panel" style={{ position: 'absolute', top: '-20px', right: '-20px', padding: '24px', zIndex: 1, width: '200px', opacity: 0.8 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Users color="var(--secondary-color)" size={20} />
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>Active Nodes</span>
                 </div>
                 <div style={{ fontSize: '2rem', fontWeight: 700 }}>1,204</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LandingPage;

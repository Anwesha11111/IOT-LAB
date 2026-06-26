import { Link } from 'react-router-dom';
import { Activity, Heart, Clock, ShieldCheck, Cpu, Zap, Wifi } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
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
            <span>Sensors</span>
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
        <div style={{ marginTop: 'auto', padding: '16px', background: 'rgba(255,255,255,0.5)', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>System Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)' }}></div>
            <span style={{ fontWeight: 500 }}>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">Health Dashboard</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '8px', borderRadius: '50px' }}>
              <Search size={18} color="var(--text-secondary)" />
              <input type="text" placeholder="Search sensors..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem', color: 'var(--text-primary)' }} />
            </div>
            <button className="glass-panel" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
              <Bell size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </header>

        {/* Health Stat Cards */}
        <section className="grid-cards">
          {/* Card: Current Health Index */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--primary-color)' }}>
                <Heart size={24} />
              </div>
              <span style={{ padding: '4px 12px', background: 'rgba(255,200,200,0.5)', color: '#c1121f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Critical</span>
            </div>
            <div>
              <div className="stat-value">78</div>
              <div className="stat-label">Health Index</div>
            </div>
          </div>

          {/* Card: Predictive Alerts */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--warning-color)' }}>
                <Clock size={24} />
              </div>
              <span style={{ padding: '4px 12px', background: 'rgba(255,173,173,0.3)', color: '#c1121f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Alert</span>
            </div>
            <div>
              <div className="stat-value">2</div>
              <div className="stat-label">Upcoming Alerts</div>
            </div>
          </div>

          {/* Card: Sensor Sync Rate */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: '#9b5de5' }}>
                <Zap size={24} />
              </div>
              <span style={{ padding: '4px 12px', background: 'rgba(202,255,191,0.5)', color: '#2d6a4f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Stable</span>
            </div>
            <div>
              <div className="stat-value">98%</div>
              <div className="stat-label">Sync Success</div>
            </div>
          </div>

          {/* Card: Device Uptime */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-icon" style={{ color: 'var(--secondary-color)' }}>
                <Wifi size={24} />
              </div>
            </div>
            <div>
              <div className="stat-value">99.9%</div>
              <div className="stat-label">Device Uptime</div>
            </div>
          </div>
        </section>

        {/* Recent Sensor Data */}
        <section className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Live Sensor Feed</h2>
          <div style={{ flex: 1, border: '1px dashed var(--glass-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Sensor chart goes here
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

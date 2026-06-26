import { Link } from 'react-router-dom';
import { LayoutDashboard, Server, ShieldAlert, Settings, Bell, Search, Zap, Cpu, Wifi } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <Link to="/" className="brand-logo" style={{ marginBottom: '16px', fontSize: '1.4rem' }}>
          <ShieldAlert size={24} color="#6c8cff" />
          <span>EdgeGuard</span>
        </Link>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </a>
          <a href="#" className="nav-item">
            <Server size={20} />
            <span>Nodes</span>
          </a>
          <a href="#" className="nav-item">
            <ShieldAlert size={20} />
            <span>Threat Logs</span>
          </a>
          <a href="#" className="nav-item">
            <Settings size={20} />
            <span>Settings</span>
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
          <h1 className="header-title">Dashboard Overview</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '8px', borderRadius: '50px' }}>
               <Search size={18} color="var(--text-secondary)" />
               <input type="text" placeholder="Search nodes..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem', color: 'var(--text-primary)' }} />
            </div>
            <button className="glass-panel" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
              <Bell size={18} color="var(--text-secondary)" />
            </button>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              A
            </div>
          </div>
        </header>

        <section className="grid-cards">
          {/* Card 1 */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div className="stat-icon" style={{ color: 'var(--primary-color)' }}>
                 <Cpu size={24} />
               </div>
               <span style={{ padding: '4px 12px', background: 'rgba(202, 255, 191, 0.5)', color: '#2d6a4f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>+12%</span>
            </div>
            <div>
              <div className="stat-value">1,204</div>
              <div className="stat-label">Total Active Nodes</div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div className="stat-icon" style={{ color: 'var(--warning-color)' }}>
                 <ShieldAlert size={24} />
               </div>
               <span style={{ padding: '4px 12px', background: 'rgba(255, 173, 173, 0.3)', color: '#c1121f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Action Needed</span>
            </div>
            <div>
              <div className="stat-value">3</div>
              <div className="stat-label">Threats Detected</div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div className="stat-icon" style={{ color: '#9b5de5' }}>
                 <Zap size={24} />
               </div>
               <span style={{ padding: '4px 12px', background: 'rgba(202, 255, 191, 0.5)', color: '#2d6a4f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Stable</span>
            </div>
            <div>
              <div className="stat-value">42 ms</div>
              <div className="stat-label">Average Latency</div>
            </div>
          </div>
          
          {/* Card 4 */}
          <div className="glass-panel stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div className="stat-icon" style={{ color: 'var(--secondary-color)' }}>
                 <Wifi size={24} />
               </div>
            </div>
            <div>
              <div className="stat-value">99.9%</div>
              <div className="stat-label">Network Uptime</div>
            </div>
          </div>
        </section>
        
        {/* Recent Activity Table placeholder */}
        <section className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Recent Activity</h2>
           <div style={{ flex: 1, border: '1px dashed var(--glass-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Activity chart/list goes here
           </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

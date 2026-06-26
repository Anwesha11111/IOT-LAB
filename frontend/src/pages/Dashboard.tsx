import {
  Heart, Clock, Cpu, Zap, Wifi,
  Thermometer, Wind, Activity, AlertTriangle,
  Battery, Droplets,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useFirebaseLive } from '../hooks/useFirebaseLive';
import { getCondition, scoreBand, CONDITIONS } from '../lib/conditions';

const ML_LABELS = ['Relaxed', 'Normal', 'Stress'] as const;

// ─── Health score arc gauge ──────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const band   = scoreBand(score);
  const radius = 52;
  const circ   = 2 * Math.PI * radius;
  const dash   = (score / 100) * circ * 0.75; // 270° arc
  const offset = circ * 0.125;                // start at -135°

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width="130" height="100" viewBox="0 0 130 110">
        {/* Background arc */}
        <circle cx="65" cy="75" r={radius}
          fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10"
          strokeDasharray={`${circ * 0.75} ${circ}`}
          strokeDashoffset={-offset}
          strokeLinecap="round"
          transform="rotate(-135 65 75)" />
        {/* Value arc */}
        <circle cx="65" cy="75" r={radius}
          fill="none" stroke={band.color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={-offset}
          strokeLinecap="round"
          transform="rotate(-135 65 75)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        {/* Score text */}
        <text x="65" y="72" textAnchor="middle"
          style={{ fontSize: '22px', fontWeight: 700, fill: band.color, fontFamily: 'Outfit, sans-serif' }}>
          {score}
        </text>
        <text x="65" y="88" textAnchor="middle"
          style={{ fontSize: '10px', fill: '#718096', fontFamily: 'Outfit, sans-serif' }}>
          /100
        </text>
      </svg>
      <span style={{ padding: '3px 12px', background: band.bg, color: band.color, borderRadius: '50px', fontSize: '0.82rem', fontWeight: 700 }}>
        {band.label}
      </span>
    </div>
  );
}

// ─── Condition banner ────────────────────────────────────────────────────────
function ConditionBanner({ code, loading }: { code: number; loading: boolean }) {
  if (loading) return null;
  const meta = getCondition(code);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '16px 24px', borderRadius: '16px',
      background: meta.bg, border: `1px solid ${meta.color}30`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: '2rem' }}>{meta.emoji}</span>
      <div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: meta.color }}>
          {meta.label.toUpperCase()}
        </div>
        <div style={{ fontSize: '0.9rem', color: meta.color, opacity: 0.8 }}>
          {meta.message}
        </div>
      </div>
    </div>
  );
}

// ─── Small flag chip ─────────────────────────────────────────────────────────
function Flag({ active, label, color }: { active: boolean; label: string; color: string }) {
  if (!active) return null;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 600,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

// ─── Detection matrix row ────────────────────────────────────────────────────
function DetectionRow({ emoji, label, active, message }: {
  emoji: string; label: string; active: boolean; message: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
      borderRadius: '10px', background: active ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.02)',
      border: active ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
      opacity: active ? 1 : 0.45, transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: '1.1rem', minWidth: '24px' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{message}</div>
      </div>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: active ? '#22c55e' : '#cbd5e0',
        boxShadow: active ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
      }} />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { data, loading, error } = useFirebaseLive();

  const hr             = data?.hr             ?? 0;
  const spo2           = data?.spo2           ?? 0;
  const temp           = data?.temperature    ?? 0;
  const humid          = data?.humidity       ?? 0;
  const aqi            = data?.aqi            ?? 0;
  const motionMag      = data?.motionMag      ?? 0;
  const tilt           = data?.tilt           ?? 0;
  const riskLabel      = data?.riskLabel      ?? 'Normal';
  const mlClass        = data?.mlClass        ?? 0;
  const condCode       = data?.conditionCode  ?? 0;
  const healthScore    = data?.healthScore    ?? 0;
  const fallFlag       = data?.fallFlag       ?? 0;
  const inactivity     = data?.inactivity     ?? 0;
  const tachycardia    = data?.tachycardia    ?? 0;
  const bradycardia    = data?.bradycardia    ?? 0;
  const lowSpo2        = data?.lowSpo2        ?? 0;
  const criticalSpo2   = data?.criticalSpo2   ?? 0;
  const fever          = data?.fever          ?? 0;
  const hypothermia    = data?.hypothermia    ?? 0;
  const heatStress     = data?.heatStress     ?? 0;
  const excessMotion   = data?.excessMotion   ?? 0;
  const sensorError    = data?.sensorError    ?? 0;
  const batteryLow     = data?.batteryLow     ?? 0;
  const batteryPct     = data?.batteryPct     ?? 100;
  const sosActive      = data?.sosActive      ?? false;
  const timestamp      = data?.timestamp      ?? '—';

  const riskBadgeStyle = (label: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      Normal:   { bg: 'rgba(202,255,191,0.5)', color: '#2d6a4f' },
      Warning:  { bg: 'rgba(255,245,157,0.6)', color: '#7c5c00' },
      Critical: { bg: 'rgba(255,200,200,0.5)', color: '#c1121f' },
    };
    return map[label] ?? map['Normal'];
  };
  const rb = riskBadgeStyle(riskLabel);

  return (
    <Layout activePage="overview" title="Health Dashboard">

      {/* ── Primary condition banner ── */}
      <ConditionBanner code={condCode} loading={loading} />

      {/* ── Top row: score + stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '20px', alignItems: 'stretch' }}>

        {/* Health Risk Score gauge */}
        <div className="glass-panel" style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px' }}>AI Risk Score</div>
          {loading ? <div style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>—</div> : <ScoreGauge score={healthScore} />}
        </div>

        {/* ML State */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-icon" style={{ color: 'var(--warning-color)' }}><Cpu size={24} /></div>
            {!loading && (
              <span style={{
                padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600,
                background: mlClass === 2 ? 'rgba(255,200,200,0.5)' : mlClass === 1 ? 'rgba(255,245,157,0.6)' : 'rgba(202,255,191,0.5)',
                color: mlClass === 2 ? '#c1121f' : mlClass === 1 ? '#7c5c00' : '#2d6a4f',
              }}>
                {ML_LABELS[mlClass]}
              </span>
            )}
          </div>
          <div>
            <div className="stat-value">{loading ? '—' : ML_LABELS[mlClass]}</div>
            <div className="stat-label">ML State</div>
          </div>
        </div>

        {/* Risk level */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-icon" style={{ color: 'var(--primary-color)' }}><Heart size={24} /></div>
            <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600, background: rb.bg, color: rb.color }}>
              {riskLabel}
            </span>
          </div>
          <div>
            <div className="stat-value">{loading ? '—' : riskLabel}</div>
            <div className="stat-label">Risk Level</div>
          </div>
        </div>

        {/* Battery */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-icon" style={{ color: batteryLow ? '#c1121f' : '#2d6a4f' }}><Battery size={24} /></div>
            {batteryLow === 1 && (
              <span style={{ padding: '4px 12px', background: 'rgba(255,200,200,0.5)', color: '#c1121f', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>
                Low
              </span>
            )}
          </div>
          <div>
            <div className="stat-value">{loading ? '—' : `${batteryPct}%`}</div>
            <div className="stat-label">Battery</div>
          </div>
        </div>
      </div>

      {/* ── Active flags strip ── */}
      {!loading && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Flag active={sosActive}      label="🚨 SOS"          color="#9b0000" />
          <Flag active={!!fallFlag}     label="⚠️ Fall"          color="#9b0000" />
          <Flag active={!!tachycardia}  label="💓 Tachycardia"  color="#c1121f" />
          <Flag active={!!bradycardia}  label="🫀 Bradycardia"  color="#923d00" />
          <Flag active={!!criticalSpo2} label="🆘 Critical SpO₂" color="#9b0000" />
          <Flag active={!!lowSpo2}      label="💧 Low SpO₂"     color="#c1121f" />
          <Flag active={!!fever}        label="🌡️ Fever"         color="#923d00" />
          <Flag active={!!hypothermia}  label="🥶 Hypothermia"  color="#00509d" />
          <Flag active={!!heatStress}   label="🥵 Heat Stress"  color="#c1121f" />
          <Flag active={!!excessMotion} label="🏃 Excess Motion" color="#7c5c00" />
          <Flag active={!!inactivity}   label="😴 Inactivity"   color="#4a5568" />
          <Flag active={!!sensorError}  label="⚡ Sensor Error"  color="#3c3c8c" />
          <Flag active={!!batteryLow}   label="🔋 Battery Low"  color="#923d00" />
        </div>
      )}

      {/* ── Vitals mini grid ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '14px' }}>
        {[
          { label: 'Heart Rate',  value: loading ? '—' : `${hr.toFixed(0)} BPM`,      icon: <Heart size={18} color="#ff6b6b" /> },
          { label: 'SpO₂',        value: loading ? '—' : `${spo2.toFixed(1)}%`,       icon: <Activity size={18} color="#4dabf7" /> },
          { label: 'Temperature', value: loading ? '—' : `${temp.toFixed(1)}°C`,      icon: <Thermometer size={18} color="#f59f00" /> },
          { label: 'Humidity',    value: loading ? '—' : `${humid.toFixed(0)}%`,      icon: <Droplets size={18} color="#74c0fc" /> },
          { label: 'AQI',         value: loading ? '—' : `${aqi}`,                    icon: <Wind size={18} color="#a9e34b" /> },
          { label: 'Motion (g)',  value: loading ? '—' : `${motionMag.toFixed(2)}g`,  icon: <Zap size={18} color="#da77f2" /> },
          { label: 'Tilt',        value: loading ? '—' : `${tilt.toFixed(1)}°`,       icon: <Activity size={18} color="#63e6be" /> },
          { label: 'Sync',        value: error ? 'Offline' : 'Live',                  icon: <Wifi size={18} color={error ? '#c1121f' : '#2d6a4f'} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {icon}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </section>

      {/* ── Detection matrix ── */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '14px', color: 'var(--text-primary)' }}>
          Detection Matrix
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
          {CONDITIONS.map((c) => {
            let active = condCode === c.code;
            // Also light up flag-based conditions regardless of primary
            if (c.code === 3  && !!tachycardia)  active = true;
            if (c.code === 4  && !!bradycardia)   active = true;
            if (c.code === 5  && !!lowSpo2)       active = true;
            if (c.code === 6  && !!criticalSpo2)  active = true;
            if (c.code === 7  && !!fever)         active = true;
            if (c.code === 8  && !!hypothermia)   active = true;
            if (c.code === 9  && !!fallFlag)      active = true;
            if (c.code === 10 && !!inactivity)    active = true;
            if (c.code === 11 && !!excessMotion)  active = true;
            if (c.code === 13 && !!heatStress)    active = true;
            if (c.code === 14 && !!sensorError)   active = true;
            if (c.code === 15 && !!batteryLow)    active = true;
            if (c.code === 16 && sosActive)       active = true;
            return (
              <DetectionRow
                key={c.code}
                emoji={c.emoji}
                label={c.label}
                active={!loading && active}
                message={c.message}
              />
            );
          })}
        </div>
      </div>

      {/* ── Timestamp ── */}
      <section className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
          <Clock size={16} />
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            Last reading: <strong style={{ color: 'var(--text-primary)' }}>{timestamp}</strong>
          </span>
        </div>
        {!loading && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#2d6a4f' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-color)', animation: 'pulse 2s infinite' }} />
            Live stream active
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#c1121f' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Dashboard;

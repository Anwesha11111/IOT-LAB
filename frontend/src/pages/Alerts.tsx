import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAlerts } from '../hooks/useAlerts';
import { getCondition, scoreBand } from '../lib/conditions';

const ML_LABELS = ['Relaxed', 'Normal', 'Stress'] as const;

function RiskChip({ label }: { label: string }) {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    Critical: { bg: 'rgba(255,200,200,0.5)', color: '#c1121f', icon: <AlertTriangle size={12} /> },
    Warning:  { bg: 'rgba(255,245,157,0.6)', color: '#7c5c00', icon: <Info size={12} /> },
    Normal:   { bg: 'rgba(202,255,191,0.5)', color: '#2d6a4f', icon: <ShieldCheck size={12} /> },
  };
  const s = map[label] ?? map['Normal'];
  return (
    <span style={{ padding: '3px 9px', background: s.bg, color: s.color, borderRadius: '50px', fontSize: '0.76rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {s.icon}{label}
    </span>
  );
}

function ScoreChip({ score }: { score: number }) {
  const b = scoreBand(score ?? 0);
  return (
    <span style={{ padding: '3px 9px', background: b.bg, color: b.color, borderRadius: '50px', fontSize: '0.76rem', fontWeight: 600 }}>
      {score ?? '—'}
    </span>
  );
}

function formatTs(ts: string): string {
  try { const d = new Date(ts); if (!isNaN(d.getTime())) return d.toLocaleString(); } catch { /* */ }
  return ts ?? '—';
}

const Alerts = () => {
  const { alerts, loading } = useAlerts();

  const totalAlerts = alerts.length;
  const critCnt     = alerts.filter((a) => a.riskLevel === 2).length;
  const sosCnt      = alerts.filter((a) => a.sosActive).length;
  const fallCnt     = alerts.filter((a) => a.fallFlag === 1).length;

  return (
    <Layout activePage="alerts" title="Alert Log">

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total',    value: totalAlerts, bg: 'rgba(160,196,255,0.25)', color: '#2b6cb0' },
          { label: 'Critical', value: critCnt,     bg: 'rgba(255,200,200,0.35)', color: '#c1121f' },
          { label: 'SOS',      value: sosCnt,      bg: 'rgba(200,0,0,0.1)',      color: '#9b0000' },
          { label: 'Falls',    value: fallCnt,     bg: 'rgba(255,220,180,0.4)',  color: '#923d00' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className="glass-panel"
            style={{ padding: '14px 22px', minWidth: '120px', background: bg, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 90px 110px 75px 75px 65px 70px 65px',
          padding: '12px 18px',
          borderBottom: '1px solid var(--glass-border)',
          fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          background: 'rgba(255,255,255,0.4)',
        }}>
          <span>Timestamp</span>
          <span>Risk</span>
          <span>Condition</span>
          <span>Score</span>
          <span>HR</span>
          <span>SpO₂</span>
          <span>ML</span>
          <span>SOS</span>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading…
            </div>
          )}
          {!loading && alerts.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No alerts recorded yet.
            </div>
          )}

          {alerts.map((alert, i) => {
            const cond = getCondition(alert.conditionCode ?? 0);
            return (
              <div key={alert.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 90px 110px 75px 75px 65px 70px 65px',
                  padding: '11px 18px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  alignItems: 'center', fontSize: '0.86rem',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'transparent',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(160,196,255,0.1)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'transparent')}
              >
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.79rem' }}>
                  {formatTs(alert.timestamp)}
                </span>
                <span><RiskChip label={alert.riskLabel} /></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
                  <span>{cond.emoji}</span>
                  <span style={{ color: cond.color, fontWeight: 500 }}>{cond.label}</span>
                </span>
                <span><ScoreChip score={alert.healthScore} /></span>
                <span style={{ fontWeight: 600 }}>{alert.hr?.toFixed(0) ?? '—'}</span>
                <span style={{ fontWeight: 600 }}>{alert.spo2?.toFixed(1) ?? '—'}%</span>
                <span style={{ fontSize: '0.8rem' }}>{ML_LABELS[alert.mlClass] ?? '—'}</span>
                <span>
                  {alert.sosActive
                    ? <span style={{ padding: '2px 7px', background: 'rgba(255,200,200,0.6)', color: '#c1121f', borderRadius: '50px', fontSize: '0.73rem', fontWeight: 700 }}>YES</span>
                    : <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>—</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Alerts;

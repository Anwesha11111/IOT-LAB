import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Layout } from '../components/Layout';
import { useAlerts } from '../hooks/useAlerts';
import { CONDITIONS, scoreBand } from '../lib/conditions';

const ML_LABELS  = ['Relaxed', 'Normal', 'Stress'] as const;
const ML_COLORS  = ['#a9e34b', '#4dabf7', '#ff6b6b'];
const RISK_COLORS= ['#caffd3', '#ffd97d', '#ff6b6b'];

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function groupByDay(alerts: { timestamp: any }[]) {
  const map: Record<string, number> = {};
  for (const a of alerts) {
    try {
      let d: Date;
      if (a.timestamp && typeof a.timestamp === 'object' && 'seconds' in a.timestamp) {
        d = new Date((a.timestamp.seconds as number) * 1000);
      } else {
        d = new Date(a.timestamp as string);
      }
      if (isNaN(d.getTime())) continue;
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      map[key] = (map[key] ?? 0) + 1;
    } catch { /* */ }
  }
  return Object.entries(map).map(([day, count]) => ({ day, count })).slice(-14);
}

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem' }}>
      <div style={{ color: '#718096' }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#2d3748' }}>{payload[0].value}</div>
    </div>
  );
}

function NoData() {
  return (
    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', border: '1px dashed var(--glass-border)', borderRadius: '10px' }}>
      No data yet
    </div>
  );
}

const Analytics = () => {
  const { alerts, loading } = useAlerts();

  const total     = alerts.length;
  const critCnt   = alerts.filter((a) => a.riskLevel === 2).length;
  const warnCnt   = alerts.filter((a) => a.riskLevel === 1).length;
  const normCnt   = alerts.filter((a) => a.riskLevel === 0).length;
  const sosCnt    = alerts.filter((a) => a.sosActive).length;
  const fallCnt   = alerts.filter((a) => a.fallFlag === 1).length;
  const avgHR     = avg(alerts.map((a) => a.hr).filter(Boolean));
  const avgSpO2   = avg(alerts.map((a) => a.spo2).filter(Boolean));
  const avgScore  = avg(alerts.map((a) => a.healthScore).filter((v) => v !== undefined));
  const critRate  = total > 0 ? ((critCnt / total) * 100).toFixed(1) : '0.0';

  const riskDist = [
    { name: 'Normal',   value: normCnt },
    { name: 'Warning',  value: warnCnt },
    { name: 'Critical', value: critCnt },
  ];

  const mlDist = [0, 1, 2].map((c) => ({
    name: ML_LABELS[c],
    value: alerts.filter((a) => a.mlClass === c).length,
  }));

  // Condition distribution — top 8 by count
  const condMap: Record<number, number> = {};
  for (const a of alerts) condMap[a.conditionCode ?? 0] = (condMap[a.conditionCode ?? 0] ?? 0) + 1;
  const condDist = Object.entries(condMap)
    .map(([code, count]) => {
      const meta = CONDITIONS.find((c) => c.code === Number(code));
      return { name: `${meta?.emoji ?? ''} ${meta?.label ?? code}`, value: count, color: meta?.color ?? '#718096' };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Score histogram buckets: Safe / Monitor / Warning / Critical
  const scoreBuckets = [
    { name: 'Safe (0–30)',      value: alerts.filter((a) => (a.healthScore ?? 0) <= 30).length,                                     fill: '#a9e34b' },
    { name: 'Monitor (31–60)',  value: alerts.filter((a) => (a.healthScore ?? 0) > 30 && (a.healthScore ?? 0) <= 60).length,        fill: '#ffd97d' },
    { name: 'Warning (61–80)', value: alerts.filter((a) => (a.healthScore ?? 0) > 60 && (a.healthScore ?? 0) <= 80).length,        fill: '#ffadad' },
    { name: 'Critical (81+)',  value: alerts.filter((a) => (a.healthScore ?? 0) > 80).length,                                      fill: '#ff6b6b' },
  ];

  const dayDist = groupByDay(alerts);

  const avgBand = scoreBand(Math.round(avgScore));

  return (
    <Layout activePage="analytics" title="Analytics">
      {loading && (
        <div style={{ padding: '16px 20px', background: 'rgba(255,245,157,0.3)', borderRadius: '12px', color: '#7c5c00', fontWeight: 500 }}>
          Loading analytics…
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
        <StatTile label="Total Alerts"     value={total} />
        <StatTile label="Critical Events"  value={critCnt}   color="#c1121f" />
        <StatTile label="SOS Events"       value={sosCnt}    color="#9b0000" />
        <StatTile label="Fall Events"      value={fallCnt}   color="#923d00" />
        <StatTile label="Critical Rate"    value={`${critRate}%`} color={Number(critRate) > 20 ? '#c1121f' : '#2d6a4f'} />
        <StatTile label="Avg HR (alerts)"  value={avgHR  ? `${avgHR.toFixed(0)} BPM` : '—'} color="#ff6b6b" />
        <StatTile label="Avg SpO₂"         value={avgSpO2 ? `${avgSpO2.toFixed(1)}%`  : '—'} color="#4dabf7" />
        <StatTile label="Avg Risk Score"   value={avgScore ? Math.round(avgScore) : '—'} color={avgBand.color}
          sub={avgScore ? avgBand.label : undefined} />
      </div>

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>

        {/* Risk distribution */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>Risk Level Distribution</div>
          {total === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {riskDist.map((_, i) => <Cell key={i} fill={RISK_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ML classification */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>ML State at Alert Time</div>
          {total === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={mlDist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#718096' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718096' }} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {mlDist.map((_, i) => <Cell key={i} fill={ML_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Health Score distribution */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>AI Health Score Bands</div>
          {total === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={scoreBuckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#718096' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718096' }} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {scoreBuckets.map((b, i) => <Cell key={i} fill={b.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Condition distribution */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>Top Conditions Detected</div>
          {condDist.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={condDist} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#718096' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#718096' }} width={120} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {condDist.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alert frequency over time */}
        <div className="glass-panel" style={{ padding: '18px 22px', gridColumn: '1 / -1' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>Alert Frequency — Last 14 Days</div>
          {dayDist.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={dayDist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#718096' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718096' }} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="count" fill="#a0c4ff" radius={[6, 6, 0, 0]}>
                  {dayDist.map((_, i) => <Cell key={i} fill={['#a0c4ff','#ffc6ff','#ffadad','#caffbf','#fdffb6'][i % 5]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;

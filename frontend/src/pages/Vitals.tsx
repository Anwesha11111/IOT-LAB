/**
 * Vitals page
 * -----------
 * Live time-series charts for every measured value coming from the ESP32.
 * Uses Recharts ResponsiveContainer + LineChart.
 * Data is accumulated in memory by useVitalsHistory (last 60 readings).
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Layout } from '../components/Layout';
import { useVitalsHistory } from '../hooks/useVitalsHistory';

// ─── chart config ────────────────────────────────────────────────────────────

interface ChartDef {
  key:    string;
  label:  string;
  unit:   string;
  color:  string;
  domain: [number | 'auto', number | 'auto'];
  refLines?: { value: number; label: string; color: string }[];
}

const CHARTS: ChartDef[] = [
  {
    key: 'hr', label: 'Heart Rate', unit: 'BPM', color: '#ff6b6b',
    domain: [40, 150],
    refLines: [
      { value: 60,  label: 'Low',  color: '#f59f00' },
      { value: 100, label: 'High', color: '#f59f00' },
    ],
  },
  {
    key: 'spo2', label: 'SpO₂', unit: '%', color: '#4dabf7',
    domain: [80, 100],
    refLines: [
      { value: 95, label: 'Threshold', color: '#f59f00' },
      { value: 90, label: 'Critical',  color: '#e03131' },
    ],
  },
  {
    key: 'temperature', label: 'Temperature', unit: '°C', color: '#f59f00',
    domain: [35, 40],
    refLines: [
      { value: 37.5, label: 'Fever', color: '#e03131' },
    ],
  },
  {
    key: 'humidity', label: 'Humidity', unit: '%', color: '#74c0fc',
    domain: [0, 100],
  },
  {
    key: 'aqi', label: 'Air Quality Index', unit: '', color: '#a9e34b',
    domain: [0, 'auto'],
    refLines: [
      { value: 50,  label: 'Warning',  color: '#f59f00' },
      { value: 150, label: 'Critical', color: '#e03131' },
    ],
  },
  {
    key: 'motionMag', label: 'Motion Magnitude', unit: 'g', color: '#da77f2',
    domain: [0, 'auto'],
    refLines: [
      { value: 3.0, label: 'Fall risk', color: '#e03131' },
    ],
  },
  {
    key: 'tilt', label: 'Tilt Angle', unit: '°', color: '#63e6be',
    domain: [0, 90],
    refLines: [
      { value: 60, label: 'Fall risk', color: '#e03131' },
    ],
  },
];

// ─── custom tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.85rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: '#718096', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2d3748' }}>
        {Number(payload[0].value).toFixed(2)} {unit}
      </div>
    </div>
  );
}

// ─── single chart card ───────────────────────────────────────────────────────

function VitalChart({ chart, data }: { chart: ChartDef; data: any[] }) {
  const latest = data.length > 0 ? (data[data.length - 1] as any)[chart.key] : null;

  return (
    <div
      className="glass-panel"
      style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {chart.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Last {data.length} readings
          </div>
        </div>
        {latest !== null && (
          <div
            style={{
              fontSize: '1.6rem', fontWeight: 700,
              color: chart.color,
            }}
          >
            {Number(latest).toFixed(1)}{chart.unit}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: '180px' }}>
        {data.length === 0 ? (
          <div
            style={{
              height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-secondary)',
              fontSize: '0.9rem', border: '1px dashed var(--glass-border)',
              borderRadius: '10px',
            }}
          >
            Waiting for data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 10, fill: '#a0aec0' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={chart.domain}
                tick={{ fontSize: 10, fill: '#a0aec0' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip unit={chart.unit} />} />
              {chart.refLines?.map((r) => (
                <ReferenceLine
                  key={r.value}
                  y={r.value}
                  stroke={r.color}
                  strokeDasharray="4 4"
                  label={{ value: r.label, position: 'insideTopRight', fontSize: 9, fill: r.color }}
                />
              ))}
              <Line
                type="monotone"
                dataKey={chart.key}
                stroke={chart.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

const Vitals = () => {
  const { history, loading } = useVitalsHistory();

  return (
    <Layout activePage="vitals" title="Vitals Monitor">
      {loading && history.length === 0 && (
        <div
          style={{
            padding: '20px', background: 'rgba(255,245,157,0.3)',
            borderRadius: '12px', color: '#7c5c00', fontWeight: 500,
          }}
        >
          Connecting to live stream — graphs will populate automatically.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
        }}
      >
        {CHARTS.map((chart) => (
          <VitalChart key={chart.key} chart={chart} data={history} />
        ))}
      </div>
    </Layout>
  );
};

export default Vitals;

/**
 * Condition metadata — maps conditionCode to display info.
 * Mirrors the COND_* constants in the ESP32 firmware.
 */

export interface ConditionMeta {
  code:    number;
  label:   string;
  emoji:   string;
  message: string;          // secondary display text
  bg:      string;          // background color (rgba)
  color:   string;          // text/icon color
  level:   0 | 1 | 2;      // 0=safe 1=warning 2=critical
}

export const CONDITIONS: ConditionMeta[] = [
  { code:  0, label: 'Normal',          emoji: '🟢', message: 'All vitals normal',           bg: 'rgba(202,255,191,0.4)', color: '#2d6a4f', level: 0 },
  { code:  1, label: 'Relaxed',         emoji: '🟢', message: 'Resting state detected',       bg: 'rgba(202,255,191,0.4)', color: '#2d6a4f', level: 0 },
  { code:  2, label: 'Stress',          emoji: '🟡', message: 'Take a break',                 bg: 'rgba(255,245,157,0.5)', color: '#7c5c00', level: 1 },
  { code:  3, label: 'Tachycardia',     emoji: '🔴', message: 'High heart rate — HR > 120',   bg: 'rgba(255,200,200,0.5)', color: '#c1121f', level: 1 },
  { code:  4, label: 'Bradycardia',     emoji: '🟠', message: 'Low heart rate — HR < 50',     bg: 'rgba(255,220,180,0.5)', color: '#923d00', level: 1 },
  { code:  5, label: 'Low SpO₂',        emoji: '🔴', message: 'Oxygen below 95%',             bg: 'rgba(255,200,200,0.5)', color: '#c1121f', level: 1 },
  { code:  6, label: 'Critical SpO₂',   emoji: '🆘', message: 'Oxygen critically low < 90%',  bg: 'rgba(200,0,0,0.15)',    color: '#9b0000', level: 2 },
  { code:  7, label: 'Fever',           emoji: '🌡️', message: 'Temperature > 38°C',           bg: 'rgba(255,220,180,0.5)', color: '#923d00', level: 1 },
  { code:  8, label: 'Hypothermia',     emoji: '🥶', message: 'Temperature < 35°C',           bg: 'rgba(180,220,255,0.5)', color: '#00509d', level: 1 },
  { code:  9, label: 'Fall Detected',   emoji: '⚠️', message: 'Fall impact detected!',        bg: 'rgba(200,0,0,0.15)',    color: '#9b0000', level: 2 },
  { code: 10, label: 'Inactivity',      emoji: '😴', message: 'No movement for 30+ seconds',  bg: 'rgba(220,220,220,0.5)', color: '#4a5568', level: 0 },
  { code: 11, label: 'Excess Motion',   emoji: '🏃', message: 'High continuous motion',       bg: 'rgba(255,245,157,0.5)', color: '#7c5c00', level: 1 },
  { code: 12, label: 'Tilt Detected',   emoji: '📐', message: 'Tilt angle > 60°',             bg: 'rgba(255,245,157,0.5)', color: '#7c5c00', level: 1 },
  { code: 13, label: 'Heat Stress',     emoji: '🥵', message: 'High temp + humidity + HR',    bg: 'rgba(255,200,200,0.5)', color: '#c1121f', level: 1 },
  { code: 14, label: 'Sensor Error',    emoji: '⚡', message: 'One or more sensors failed',   bg: 'rgba(200,200,255,0.5)', color: '#3c3c8c', level: 2 },
  { code: 15, label: 'Battery Low',     emoji: '🔋', message: 'Battery below 20%',            bg: 'rgba(255,220,180,0.5)', color: '#923d00', level: 1 },
  { code: 16, label: 'Emergency',       emoji: '🚨', message: 'SOS / Fall / Critical SpO₂',   bg: 'rgba(200,0,0,0.15)',    color: '#9b0000', level: 2 },
  { code: 17, label: 'AQI Warning',     emoji: '💨', message: 'Air quality poor (AQI > 50)',   bg: 'rgba(255,245,157,0.5)', color: '#7c5c00', level: 1 },
  { code: 18, label: 'AQI Critical',    emoji: '☠️', message: 'Air quality critical (>150)',   bg: 'rgba(255,200,200,0.5)', color: '#c1121f', level: 2 },
];

export function getCondition(code: number): ConditionMeta {
  return CONDITIONS.find((c) => c.code === code) ?? CONDITIONS[0];
}

/** Score band for Health Risk Score */
export function scoreBand(score: number): { label: string; color: string; bg: string } {
  if (score <= 30) return { label: 'Safe',     color: '#2d6a4f', bg: 'rgba(202,255,191,0.5)' };
  if (score <= 60) return { label: 'Monitor',  color: '#7c5c00', bg: 'rgba(255,245,157,0.6)' };
  if (score <= 80) return { label: 'Warning',  color: '#923d00', bg: 'rgba(255,220,180,0.5)' };
  return                   { label: 'Critical', color: '#9b0000', bg: 'rgba(255,200,200,0.6)' };
}

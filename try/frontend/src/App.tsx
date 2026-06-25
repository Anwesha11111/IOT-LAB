import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, ShieldAlert, Zap, RefreshCw, Layers, BrainCircuit, Waves, HeartPulse } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TelemetryData {
  temperature: number;
  humidity: number;
  motion_magnitude: number;
  motion_variance: number;
  tilt_angle: number;
  heart_rate: number;
  spo2: number;
  condition: string;
  alert_level: string;
  time?: string;
}

export default function EdgeGuardDashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    temperature: 36.6, humidity: 55.0, motion_magnitude: 1.0,
    motion_variance: 0.01, tilt_angle: 5.0, heart_rate: 72.0,
    spo2: 98.2, condition: "Normal", alert_level: "NORMAL"
  });

  const [history, setHistory] = useState<TelemetryData[]>([]);

  const [manualForm, setManualForm] = useState({
    temperature: 36.5, humidity: 50.0, motion_magnitude: 1.0, tilt_angle: 0.0, heart_rate: 75.0, raw_red: 52000, raw_ir: 55000
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://localhost:8080/api/v1/telemetry')
        .then(res => res.json())
        .then(data => {
          setTelemetry(data);
          const now = new Date();
          const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          setHistory(prev => {
            const newHist = [...prev, { ...data, time: timeString }];
            return newHist.length > 30 ? newHist.slice(newHist.length - 30) : newHist;
          });
        })
        .catch(() => console.log("Backend offline"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = (conditionName: string) => {
    setIsSimulating(true);
    fetch('http://localhost:8080/api/v1/simulation/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condition_name: conditionName })
    })
    .then(res => res.json())
    .then(data => {
      setTelemetry(data.data);
      // Update manual form fields to match the simulated values
      setManualForm({
        temperature: data.data.temperature,
        humidity: data.data.humidity,
        motion_magnitude: data.data.motion_magnitude,
        tilt_angle: data.data.tilt_angle,
        heart_rate: data.data.heart_rate,
        raw_red: 52000,
        raw_ir: 55000
      });
      // Graph will naturally pick this up via the useEffect polling loop now.
    });
  };

  const resetPipeline = () => {
    setIsSimulating(false);
    fetch('http://localhost:8080/api/v1/simulation/reset', { method: 'POST' })
      .then(() => alert("Pipeline linked to physical sensors."));
  };

  const submitManualInput = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('http://localhost:8080/api/v1/telemetry/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manualForm)
    })
    .then(res => res.json())
    .then(data => {
      if(data.status === "ignored") {
        alert("Cannot apply inputs: A preset simulation button is currently active. Click 'Reset Pipeline' first.");
      } else {
        setTelemetry(data.data);
      }
    });
  };

  const getAlertStyles = (level: string) => {
    if (level === "CRITICAL") return "glass-red text-red-200 animate-pulse-soft";
    if (level === "WARNING") return "glass-amber text-amber-200";
    return "glass-dark border-emerald-500/30 text-emerald-300";
  };

  const getClinicalAdvice = (condition: string) => {
    switch (condition) {
      case "Pre-Syncope":
        return "Sit or lie down flat immediately. Elevate legs 30 degrees to restore cerebral blood flow. Perform counterpressure maneuvers (clench fists, cross legs) and drink 300-500ml of water.";
      case "Syncope":
        return "CRITICAL PROTOCOL: Posture failure detected. Keep patient completely flat, ensure clear airway pathways, check peripheral pulses, and immediately contact emergency medical response teams.";
      case "Hypoxia":
        return "CRITICAL OXYGEN LOSS: Sit patient completely upright to improve diaphragmatic excursion. Minimize physical exertion and prepare high-flow oxygen supply systems.";
      case "Tachycardia Detection":
      case "Pathological Tachycardia":
        return "CARDIAC ANOMALY: Instruct patient to cease physical activity immediately. Sit comfortably and perform controlled vagal maneuvers (deep breath holding or coughing). Monitor heart rhythm.";
      default:
        return "Patient vitals within baseline tolerances. Maintain continuous monitoring routine.";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none"></div>
      
      {telemetry.alert_level === "CRITICAL" && (
        <div className="absolute inset-0 bg-red-900/10 pointer-events-none animate-pulse-soft z-0"></div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Upper Status Banner Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-float">
              <Layers className="text-blue-400" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                EDGEGUARD <span className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded text-xs font-bold shadow-lg">V2.0 PRO</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">AI-Driven Biometric Threat Diagnostics Platform</p>
            </div>
          </div>
          <div className={`mt-4 md:mt-0 px-6 py-3 rounded-2xl border-2 font-bold tracking-widest text-sm transition-all duration-500 shadow-xl ${getAlertStyles(telemetry.alert_level)}`}>
            SYSTEM STATUS: {telemetry.alert_level} ({telemetry.condition.toUpperCase()})
          </div>
        </div>

        {/* Dynamic Remedy Banner (Drops down automatically on Warning/Critical) */}
        {telemetry.alert_level !== "NORMAL" && (
          <div className="animate-slide-down mb-8 p-1 rounded-2xl bg-gradient-to-r from-red-500 via-amber-500 to-orange-500 p-[2px]">
            <div className="bg-slate-950 rounded-xl p-6 flex items-start gap-4 shadow-inner">
              <div className="p-4 bg-red-500/20 text-red-400 rounded-full shrink-0">
                <HeartPulse size={32} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white tracking-wider mb-2 flex items-center gap-2">
                  <ShieldAlert size={20} className="text-amber-500"/> CLINICAL INTERVENTION PROTOCOL REQUIRED
                </h4>
                <p className="text-md text-slate-300 font-light leading-relaxed">{getClinicalAdvice(telemetry.condition)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Real-time Metric Cards & Live Chart */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Live Telemetry Chart */}
            <div className="glass-dark rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
              <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2">
                <Waves size={18} className="text-indigo-400"/> Live Sensor Telemetry Stream
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                    <YAxis yAxisId="left" stroke="#f87171" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#60a5fa" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                    <Line yAxisId="left" type="monotone" dataKey="heart_rate" name="Heart Rate (BPM)" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} animationDuration={300} />
                    <Line yAxisId="right" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={300} />
                    <Line yAxisId="left" type="monotone" dataKey="motion_magnitude" name="Motion (g)" stroke="#a855f7" strokeWidth={2} dot={false} animationDuration={300} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-dark hover:bg-slate-800/80 transition-colors duration-300 rounded-3xl p-6 flex items-center gap-5 border-l-4 border-l-red-500">
                <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl"><Activity size={32} /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-1">HEART RATE</p>
                  <h3 className="text-4xl font-black text-white">{telemetry.heart_rate} <span className="text-sm font-normal text-slate-500">BPM</span></h3>
                </div>
              </div>
              <div className="glass-dark hover:bg-slate-800/80 transition-colors duration-300 rounded-3xl p-6 flex items-center gap-5 border-l-4 border-l-blue-500">
                <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl"><Zap size={32} /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-1">OXYGEN SATURATION</p>
                  <h3 className="text-4xl font-black text-white">{telemetry.spo2.toFixed(1)} <span className="text-sm font-normal text-slate-500">% SpO2</span></h3>
                </div>
              </div>
              <div className="glass-dark hover:bg-slate-800/80 transition-colors duration-300 rounded-3xl p-6 flex items-center gap-5 border-l-4 border-l-amber-500">
                <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl"><Thermometer size={32} /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-1">TEMP & MOTION</p>
                  <h3 className="text-2xl font-black text-white">{telemetry.temperature}°C <span className="text-lg text-slate-300 font-medium">| {telemetry.motion_magnitude.toFixed(2)}g</span></h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Spatial Tilt: {telemetry.tilt_angle.toFixed(1)}°</p>
                </div>
              </div>
              <div className="glass-dark hover:bg-slate-800/80 transition-colors duration-300 rounded-3xl p-6 flex items-center gap-5 border-l-4 border-l-purple-500">
                <div className="p-4 bg-purple-500/10 text-purple-400 rounded-2xl"><BrainCircuit size={32} /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-1">ML SPATIAL METRICS</p>
                  <h3 className="text-2xl font-black font-mono text-white">Var: {telemetry.motion_variance.toFixed(4)}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium bg-slate-900/50 inline-block px-2 py-1 rounded-md border border-slate-700/50">
                    Mode: <span className="text-white">{telemetry.motion_variance > 0.5 ? "Active Exertion" : "Sedentary"}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* How It Works Section */}
            <div className="glass-dark rounded-3xl overflow-hidden mt-2">
              <button 
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="w-full p-6 text-left flex justify-between items-center hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-sm font-bold tracking-wider text-slate-200 flex items-center gap-2">
                  <BrainCircuit size={18} className="text-indigo-400"/> HOW THE EDGEGUARD INTELLIGENCE PIPELINE WORKS
                </span>
                <span className="text-slate-400 text-2xl font-light">{showHowItWorks ? '−' : '+'}</span>
              </button>
              
              {showHowItWorks && (
                <div className="p-6 pt-0 border-t border-slate-800/50 bg-slate-900/30">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 relative">
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-black shadow-lg">1</div>
                      <h4 className="text-xs font-bold text-blue-400 mb-2">Hardware Sensors</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">ESP32 micro-controller rapidly polls DHT11, MPU6050, and MAX30105. It calculates physical tilt vectors and raw PPG light absorption values locally.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 relative">
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-black shadow-lg">2</div>
                      <h4 className="text-xs font-bold text-indigo-400 mb-2">Raw CSV Stream</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">A minimal, high-speed comma-separated packet is transmitted over Serial lines to the connected workstation, avoiding JSON overhead.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 relative">
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-xs font-black shadow-lg">3</div>
                      <h4 className="text-xs font-bold text-purple-400 mb-2">FastAPI & Random Forest</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">The python backend processes moving-window standard deviations and runs a synthesized Scikit-Learn Random Forest model to predict medical states.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 relative">
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-black shadow-lg">4</div>
                      <h4 className="text-xs font-bold text-emerald-400 mb-2">React Dashboard</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">This responsive UI receives the final processed payload. If a risk is detected, it renders dynamic remedy workflows and visual alerts.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>

          {/* Right Column: Dynamic Simulation Matrix Panel */}
          <div className="glass-dark rounded-3xl p-6 lg:sticky lg:top-8 h-fit">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold tracking-widest text-white flex items-center gap-2">
                SIMULATION OVERRIDE
              </h3>
              {isSimulating && (
                <button onClick={resetPipeline} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/50 active:scale-95">
                  <RefreshCw size={14} className="animate-spin-slow" /> RESET SENSORS
                </button>
              )}
            </div>

            {/* Preset Buttons */}
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-3">Pathology Presets (Overrides hardware)</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {["Normal", "Pre-Syncope", "Tachycardia Detection", "Syncope", "Hypoxia", "Pathological Tachycardia"].map(cond => (
                <button 
                  key={cond} 
                  onClick={() => triggerSimulation(cond)} 
                  className={`py-3 px-3 rounded-xl text-left text-xs font-bold border transition-all duration-300 hover:shadow-lg active:scale-95 ${
                    isSimulating && telemetry.condition === cond 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-900/50' 
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>

            {/* Manual Telemetry Form */}
            <div className="pt-6 border-t border-slate-800/50">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-4">Manual Signal Telemetry Form</p>
              <form onSubmit={submitManualInput} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">HR (BPM)</label>
                    <input type="number" value={manualForm.heart_rate} onChange={e => setManualForm({...manualForm, heart_rate: parseFloat(e.target.value)})} className="w-full bg-transparent outline-none text-sm text-white font-mono" />
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Tilt Angle (°)</label>
                    <input type="number" value={manualForm.tilt_angle} onChange={e => setManualForm({...manualForm, tilt_angle: parseFloat(e.target.value)})} className="w-full bg-transparent outline-none text-sm text-white font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Motion (g)</label>
                    <input type="number" step="0.1" value={manualForm.motion_magnitude} onChange={e => setManualForm({...manualForm, motion_magnitude: parseFloat(e.target.value)})} className="w-full bg-transparent outline-none text-sm text-white font-mono" />
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Temp (°C)</label>
                    <input type="number" step="0.1" value={manualForm.temperature} onChange={e => setManualForm({...manualForm, temperature: parseFloat(e.target.value)})} className="w-full bg-transparent outline-none text-sm text-white font-mono" />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 mt-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700 rounded-xl font-black text-[11px] tracking-[0.2em] transition-all text-white shadow-lg active:scale-95 group">
                  <span className="group-hover:text-indigo-400 transition-colors">EVALUATE MANUAL VECTORS</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Activity, Thermometer, ShieldAlert, RefreshCw, Layers, Waves, Shield, Compass, Wind } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

// --- Production Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY",
  authDomain: "iot-lab-e8ac7.firebaseapp.com",
  databaseURL: "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-lab-e8ac7",
  storageBucket: "iot-lab-e8ac7.firebasestorage.app",
  messagingSenderId: "539837012582",
  appId: "1:539837012582:web:ecbe24030f8c11646faba7",
  measurementId: "G-WXYW808704"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);
const firestore = getFirestore(app);

interface LiveTelemetry {
  hr: number;
  spo2: number;
  temperature: number;
  humidity: number;
  aqi: number;
  motionMag: number;
  tilt: number;
  fallFlag: number;
  riskLevel: number; // 0=Normal, 1=Warning, 2=Critical
  riskLabel: string;
  sosActive: boolean;
  timestamp: string;
  time?: string;
}

interface AlertDocument {
  id: string;
  riskLevel: number;
  riskLabel: string;
  hr: number;
  spo2: number;
  aqi: number;
  sosActive: boolean;
  timestamp: string;
}

export default function EdgeGuardDashboard() {
  const [liveData, setLiveData] = useState<LiveTelemetry>({
    hr: 72.0,
    spo2: 98.0,
    temperature: 26.5,
    humidity: 50.0,
    aqi: 45,
    motionMag: 1.0,
    tilt: 5.0,
    fallFlag: 0,
    riskLevel: 0,
    riskLabel: "Normal",
    sosActive: false,
    timestamp: new Date().toISOString()
  });

  const [history, setHistory] = useState<LiveTelemetry[]>([]);
  const [alerts, setAlerts] = useState<AlertDocument[]>([]);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'caregiver'>('dashboard');

  // Real-time Database listener under /live
  useEffect(() => {
    try {
      if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.log("Firebase not configured. Running offline dashboard simulator.");
        setIsFirebaseConnected(false);
        return;
      }

      const liveRef = ref(db, '/live');
      const unsubscribe = onValue(liveRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setIsFirebaseConnected(true);
          const now = new Date();
          const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          
          const mapped: LiveTelemetry = {
            hr: data.hr ?? 72,
            spo2: data.spo2 ?? 98,
            temperature: data.temperature ?? 26,
            humidity: data.humidity ?? 50,
            aqi: data.aqi ?? 45,
            motionMag: data.motionMag ?? 1.0,
            tilt: data.tilt ?? 0,
            fallFlag: data.fallFlag ?? 0,
            riskLevel: data.riskLevel ?? 0,
            riskLabel: data.riskLabel ?? "Normal",
            sosActive: data.sosActive ?? false,
            timestamp: data.timestamp ?? new Date().toISOString()
          };

          setLiveData(mapped);
          setHistory(prev => {
            const newHist = [...prev, { ...mapped, time: timeString }];
            return newHist.length > 30 ? newHist.slice(newHist.length - 30) : newHist;
          });
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn("RTDB Connection failed:", err);
      setIsFirebaseConnected(false);
    }
  }, []);

  // Firestore Alerts listener
  useEffect(() => {
    if (!isFirebaseConnected) return;

    try {
      const q = query(
        collection(firestore, 'alerts'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedAlerts: AlertDocument[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedAlerts.push({
            id: doc.id,
            riskLevel: data.riskLevel ?? 0,
            riskLabel: data.riskLabel ?? "Unknown",
            hr: data.hr ?? 0,
            spo2: data.spo2 ?? 0,
            aqi: data.aqi ?? 0,
            sosActive: data.sosActive ?? false,
            timestamp: data.timestamp || new Date().toISOString()
          });
        });
        setAlerts(loadedAlerts);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn("Firestore collection listener failed:", err);
    }
  }, [isFirebaseConnected]);

  // Offline random-walk simulator
  useEffect(() => {
    if (isFirebaseConnected) return;

    const timer = setInterval(() => {
      const now = new Date();
      const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setLiveData(prev => {
        // Only run random walk if we aren't simulating a preset anomaly
        if (isSimulating) return prev;

        const nextHr = Math.min(140, Math.max(45, prev.hr + (Math.random() * 4 - 2)));
        const nextSpo2 = Math.min(100, Math.max(80, prev.spo2 + (Math.random() * 0.4 - 0.2)));
        const nextTemp = prev.temperature + (Math.random() * 0.2 - 0.1);
        const nextHum = Math.min(100, Math.max(10, prev.humidity + (Math.random() * 2 - 1)));
        const nextAqi = Math.max(10, prev.aqi + Math.round(Math.random() * 6 - 3));
        const nextTilt = Math.max(0, prev.tilt + (Math.random() * 2 - 1));
        const nextMot = Math.max(0, prev.motionMag + (Math.random() * 0.1 - 0.05));

        // Evaluate risk levels
        let level = 0;
        let label = "Normal";
        if (nextSpo2 < 90 || nextHr > 130 || nextAqi > 150) {
          level = 2;
          label = "Critical";
        } else if (nextSpo2 < 95 || nextHr > 100 || nextAqi > 50) {
          level = 1;
          label = "Warning";
        }

        const updated: LiveTelemetry = {
          hr: parseFloat(nextHr.toFixed(1)),
          spo2: parseFloat(nextSpo2.toFixed(1)),
          temperature: parseFloat(nextTemp.toFixed(1)),
          humidity: parseFloat(nextHum.toFixed(1)),
          aqi: nextAqi,
          motionMag: parseFloat(nextMot.toFixed(2)),
          tilt: parseFloat(nextTilt.toFixed(1)),
          fallFlag: 0,
          riskLevel: level,
          riskLabel: label,
          sosActive: false,
          timestamp: new Date().toISOString()
        };

        setHistory(prevHist => {
          const newHist = [...prevHist, { ...updated, time: timeString }];
          return newHist.length > 30 ? newHist.slice(newHist.length - 30) : newHist;
        });

        return updated;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [isFirebaseConnected, isSimulating]);

  // Trigger simulated alerts locally or in Firebase
  const simulateAlert = async (type: string) => {
    setIsSimulating(true);
    let mock: Partial<LiveTelemetry> = {};

    if (type === "Hypoxia") {
      mock = { hr: 88, spo2: 89, aqi: 42, fallFlag: 0, riskLevel: 2, riskLabel: "Critical", sosActive: false };
    } else if (type === "Tachycardia") {
      mock = { hr: 134, spo2: 97, aqi: 35, fallFlag: 0, riskLevel: 2, riskLabel: "Critical", sosActive: false };
    } else if (type === "Fall") {
      mock = { hr: 98, spo2: 95, aqi: 40, motionMag: 3.4, tilt: 75.0, fallFlag: 1, riskLevel: 2, riskLabel: "Critical", sosActive: false };
    } else if (type === "SOS") {
      mock = { hr: 82, spo2: 98, aqi: 30, fallFlag: 0, riskLevel: 2, riskLabel: "Critical", sosActive: true };
    } else if (type === "Gas") {
      mock = { hr: 90, spo2: 96, aqi: 185, fallFlag: 0, riskLevel: 2, riskLabel: "Critical", sosActive: false };
    }

    const completeMock: LiveTelemetry = {
      ...liveData,
      ...mock,
      timestamp: new Date().toISOString()
    };

    setLiveData(completeMock);

    // Save history data point
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setHistory(prev => [...prev, { ...completeMock, time: timeString }].slice(-30));

    if (isFirebaseConnected) {
      try {
        await set(ref(db, '/live'), completeMock);
        await addDoc(collection(firestore, 'alerts'), {
          riskLevel: completeMock.riskLevel,
          riskLabel: completeMock.riskLabel,
          hr: completeMock.hr,
          spo2: completeMock.spo2,
          aqi: completeMock.aqi,
          sosActive: completeMock.sosActive,
          timestamp: completeMock.timestamp
        });
      } catch (err) {
        console.error("Firebase write error:", err);
      }
    } else {
      // Mock local alert feed
      setAlerts(prev => [
        {
          id: `local-alert-${Date.now()}`,
          riskLevel: completeMock.riskLevel,
          riskLabel: completeMock.riskLabel,
          hr: completeMock.hr,
          spo2: completeMock.spo2,
          aqi: completeMock.aqi,
          sosActive: completeMock.sosActive,
          timestamp: completeMock.timestamp
        },
        ...prev.slice(0, 9)
      ]);
    }
  };

  const resetSensors = async () => {
    setIsSimulating(false);
    const stableMock: LiveTelemetry = {
      hr: 74,
      spo2: 98.5,
      temperature: 26.8,
      humidity: 48.0,
      aqi: 32,
      motionMag: 1.0,
      tilt: 4.5,
      fallFlag: 0,
      riskLevel: 0,
      riskLabel: "Normal",
      sosActive: false,
      timestamp: new Date().toISOString()
    };

    setLiveData(stableMock);

    if (isFirebaseConnected) {
      try {
        await set(ref(db, '/live'), stableMock);
      } catch (err) {
        console.error("Firebase reset error:", err);
      }
    }
  };

  const getBadgeColors = (level: number) => {
    if (level === 2) return "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse";
    if (level === 1) return "bg-amber-500/20 text-amber-400 border-amber-500/50";
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative overflow-hidden">
      {/* Visual background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-900/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none"></div>
      
      {liveData.riskLevel === 2 && (
        <div className="absolute inset-0 bg-red-950/10 pointer-events-none animate-pulse z-0"></div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-500/15 rounded-2xl border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.35)] animate-float">
              <Layers className="text-indigo-400 animate-spin-slow" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-wider text-white">
                EDGEGUARD <span className="px-2 py-0.5 bg-gradient-to-r from-red-600 to-indigo-600 rounded text-[10px] font-bold tracking-widest shadow-md">LEVEL 3 IoT</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide mt-1 uppercase">Adaptive Rule Engine & Biometric Threat Monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex">
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Analytics Panel
              </button>
              <button 
                onClick={() => setActiveTab('caregiver')} 
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'caregiver' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Caregiver View
              </button>
            </div>

            <div className={`px-5 py-2.5 rounded-xl border font-black text-xs uppercase tracking-widest ${getBadgeColors(liveData.riskLevel)}`}>
              {liveData.riskLabel} Risk Profile
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          /* Main Dashboard layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left and Middle Columns */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Connection Status & Warning Protocol Banner */}
              {liveData.riskLevel === 2 && (
                <div className="animate-slide-down bg-red-950/40 border border-red-500/50 rounded-3xl p-6 flex gap-4 shadow-xl">
                  <div className="p-3.5 bg-red-500/20 text-red-400 rounded-2xl h-fit">
                    <ShieldAlert size={28} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-white uppercase tracking-wider mb-1">Emergency Protocols Engaged</h3>
                    <p className="text-xs text-red-200 font-light leading-relaxed">
                      {liveData.sosActive 
                        ? "SOS Push Button Triggered. Continuous vibration motor active. Dispatched WhatsApp caregiver alert." 
                        : `Critical Physiological Threat: ${liveData.riskLabel} / ${liveData.hr} BPM / ${liveData.spo2}% SpO2. LED Matrix displays SOS.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Vitals Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Heart Rate & SpO2 Card */}
                <div className="glass-dark rounded-3xl p-6 border-l-4 border-l-red-500 flex items-center justify-between group hover:bg-slate-900/80 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl group-hover:scale-110 transition-transform"><Activity size={28} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Vitals Monitor</p>
                      <h4 className="text-3xl font-black text-white mt-1">{liveData.hr} <span className="text-xs font-normal text-slate-500">BPM</span></h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Pulse SpO₂</p>
                    <h4 className="text-2xl font-bold text-blue-400 mt-1">{liveData.spo2}%</h4>
                  </div>
                </div>

                {/* Ambient DHT22 Card */}
                <div className="glass-dark rounded-3xl p-6 border-l-4 border-l-amber-500 flex items-center justify-between group hover:bg-slate-900/80 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl group-hover:scale-110 transition-transform"><Thermometer size={28} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Temperature</p>
                      <h4 className="text-3xl font-black text-white mt-1">{liveData.temperature}°C</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Humidity</p>
                    <h4 className="text-2xl font-bold text-amber-300 mt-1">{liveData.humidity}% RH</h4>
                  </div>
                </div>

                {/* AQI Panel */}
                <div className="glass-dark rounded-3xl p-6 border-l-4 border-l-wind-400 border-l-sky-500 flex items-center justify-between group hover:bg-slate-900/80 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl group-hover:scale-110 transition-transform"><Wind size={28} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Air Quality Index</p>
                      <h4 className="text-3xl font-black text-white mt-1">{liveData.aqi} <span className="text-xs font-normal text-slate-500">AQI</span></h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      liveData.aqi > 150 ? "bg-red-500/25 text-red-300" : liveData.aqi > 50 ? "bg-amber-500/25 text-amber-300" : "bg-emerald-500/25 text-emerald-300"
                    }`}>
                      {liveData.aqi > 150 ? "Hazardous" : liveData.aqi > 50 ? "Moderate" : "Good"}
                    </span>
                  </div>
                </div>

                {/* Fall Status & MPU6050 Metrics */}
                <div className="glass-dark rounded-3xl p-6 border-l-4 border-l-purple-500 flex items-center justify-between group hover:bg-slate-900/80 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl group-hover:scale-110 transition-transform"><Compass size={28} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Posture & Motion</p>
                      <h4 className="text-xl font-bold text-white mt-1">{liveData.motionMag.toFixed(2)}g | {liveData.tilt}° Tilt</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Fall Flag</p>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${liveData.fallFlag === 1 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                      {liveData.fallFlag === 1 ? "COLLAPSE" : "STABLE"}
                    </span>
                  </div>
                </div>

              </div>

              {/* Trend Chart (HR & SpO2 history) */}
              <div className="glass-dark rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <Waves size={16} className="text-indigo-400"/> Micro-Telemetry Trend Stream
                </h3>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={9} />
                      <YAxis yAxisId="left" stroke="#ef4444" fontSize={9} />
                      <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="hr" name="Heart Rate (BPM)" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="spo2" name="Oxygen (%)" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Right Column: Alerts log & Simulation Trigger Dashboard */}
            <div className="flex flex-col gap-6">

              {/* SOS Simulation Panel */}
              <div className="glass-dark rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                  <h3 className="text-xs font-black tracking-widest text-slate-300">DEMO PANEL</h3>
                  {isSimulating && (
                    <button onClick={resetSensors} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all">
                      <RefreshCw size={10} /> Reset
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Physiological Presets (Fires Caregiver Alert)</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button onClick={() => simulateAlert("Hypoxia")} className="py-2.5 px-3 bg-slate-900 border border-slate-850 hover:border-slate-600 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                    Hypoxia Case
                  </button>
                  <button onClick={() => simulateAlert("Tachycardia")} className="py-2.5 px-3 bg-slate-900 border border-slate-850 hover:border-slate-600 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                    Tachycardia
                  </button>
                  <button onClick={() => simulateAlert("Fall")} className="py-2.5 px-3 bg-slate-900 border border-slate-850 hover:border-slate-600 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                    G-Force Fall
                  </button>
                  <button onClick={() => simulateAlert("Gas")} className="py-2.5 px-3 bg-slate-900 border border-slate-850 hover:border-slate-600 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                    Toxic Gas Out
                  </button>
                </div>

                <button onClick={() => simulateAlert("SOS")} className="w-full mt-3 py-3 bg-red-900/40 border border-red-500/50 hover:bg-red-800/40 text-red-200 text-xs font-black tracking-widest rounded-xl transition-all active:scale-95">
                  🚨 SIMULATE PHYSICAL SOS BUTTON
                </button>
              </div>

              {/* Alert Log (Firestore log) */}
              <div className="glass-dark rounded-3xl p-6">
                <h3 className="text-xs font-black tracking-widest text-slate-300 mb-4 pb-2 border-b border-slate-800 uppercase">Emergency Dispatch Log</h3>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No critical anomalies recorded.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {alerts.map((al) => (
                      <div key={al.id} className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex justify-between items-start">
                        <div>
                          <span className="text-[9px] px-1.5 py-0.5 bg-red-900/50 border border-red-700/50 text-red-300 rounded font-black tracking-widest">
                            {al.sosActive ? "SOS KEY" : al.riskLabel.toUpperCase()}
                          </span>
                          <p className="text-xs font-bold text-white mt-1">{al.sosActive ? "Caregiver Alert Requested" : "Vitals Anomaly"}</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">{new Date(al.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-mono">
                          <p>HR: {al.hr} BPM</p>
                          <p>SpO₂: {al.spo2}%</p>
                          <p>AQI: {al.aqi}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          /* Simplified Caregiver View */
          <div className="glass-dark rounded-3xl p-8 max-w-2xl mx-auto shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <Shield className="text-indigo-400" /> Active Safety Caregiver Feed
            </h2>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-sm font-semibold text-slate-300">Vitals Monitor Summary</span>
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${
                  liveData.riskLevel === 2 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {liveData.riskLabel} Status
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Heart Rate</p>
                  <p className="text-3xl font-black text-white">{liveData.hr} <span className="text-sm font-normal text-slate-500">BPM</span></p>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Oxygen Level</p>
                  <p className="text-3xl font-black text-blue-400">{liveData.spo2}%</p>
                </div>
              </div>

              <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Motion Activity</p>
                  <p className="text-sm font-bold text-white">{liveData.fallFlag === 1 ? "Potential Fall Incident!" : "Normal Active Orientation"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Air Quality</p>
                  <p className="text-sm font-bold text-amber-300">{liveData.aqi} AQI</p>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-center mt-4">
                Last stream synchronization: {new Date(liveData.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

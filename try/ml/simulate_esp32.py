"""
EdgeGuard ESP32 Simulator
=========================
Pushes realistic fake sensor data to Firebase RTDB /live every 1.5 s,
exactly mimicking what the real ESP32 firmware sends.

Cycles through all 19 detection conditions automatically so you can
watch the dashboard respond in real time without the hardware.

Requirements:
    pip install requests

Usage:
    python simulate_esp32.py
    python simulate_esp32.py --scenario stress    # force a scenario
    python simulate_esp32.py --scenario fall
    python simulate_esp32.py --scenario sos

Scenarios: normal | relaxed | stress | tachycardia | bradycardia |
           low_spo2 | fever | fall | heat_stress | inactivity
"""

import requests
import json
import time
import math
import random
import argparse
from datetime import datetime, timezone

# ── Firebase config (matches frontend/src/lib/firebase.ts) ──────────────────
RTDB_URL    = "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app"
FIREBASE_API_KEY = "AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/iot-lab-e8ac7/databases/(default)/documents/alerts"

# ── Auth (anonymous sign-in to get a token for authenticated writes) ─────────
# If your RTDB rules are open (.read/.write = true) this is not needed.
# We use the REST API with ?auth= param using the legacy database secret,
# OR simply use open rules during development.
# For now we POST without auth — works if rules are open.

INTERVAL    = 1.5   # seconds between updates
RTDB_LIVE   = f"{RTDB_URL}/live.json"
RTDB_CMD    = f"{RTDB_URL}/command/sosTrigger.json"

# ── Condition codes (mirrors firmware) ──────────────────────────────────────
COND = {
    "normal":        (0,  "Normal",         0),
    "relaxed":       (1,  "Relaxed",        0),
    "stress":        (2,  "Stress",         1),
    "tachycardia":   (3,  "Tachycardia",    1),
    "bradycardia":   (4,  "Bradycardia",    1),
    "low_spo2":      (5,  "Low SpO2",       1),
    "crit_spo2":     (6,  "Critical SpO2",  2),
    "fever":         (7,  "Fever",          1),
    "hypothermia":   (8,  "Hypothermia",    1),
    "fall":          (9,  "Fall Detected",  2),
    "inactivity":    (10, "Inactivity",     0),
    "excess_motion": (11, "Excess Motion",  1),
    "tilt":          (12, "Tilt Detected",  1),
    "heat_stress":   (13, "Heat Stress",    1),
    "emergency":     (16, "Emergency",      2),
    "aqi_warn":      (17, "AQI Warning",    1),
    "aqi_crit":      (18, "AQI Critical",   2),
}

RISK_LABELS = {0: "Normal", 1: "Warning", 2: "Critical"}
ML_LABELS   = {0: "Relaxed", 1: "Normal", 2: "Stress"}

# ── Demo cycle: rotates through scenarios automatically ──────────────────────
DEMO_CYCLE = [
    ("normal",        20),   # 20 readings (~30 s)
    ("stress",        10),
    ("tachycardia",   8),
    ("normal",        10),
    ("low_spo2",      8),
    ("fever",         8),
    ("normal",        10),
    ("fall",          5),
    ("emergency",     5),
    ("normal",        10),
    ("heat_stress",   8),
    ("inactivity",    8),
    ("normal",        10),
    ("bradycardia",   8),
    ("aqi_warn",      8),
    ("relaxed",       15),
]

# ── Sensor state (random-walk) ───────────────────────────────────────────────
state = {
    "hr":        72.0,
    "spo2":      98.0,
    "temp":      36.5,
    "humid":     52.0,
    "aqi":       30,
    "motionMag": 1.0,
    "tilt":      5.0,
    "batt":      85,
}

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def walk(val, delta_range, lo, hi):
    return clamp(val + random.uniform(-delta_range, delta_range), lo, hi)

def scenario_targets(name):
    """Return (hr, spo2, temp, humid, aqi, motion, tilt) target ranges per scenario."""
    s = {
        "normal":        dict(hr=(65,90),  spo2=(96,99), temp=(36.2,37.0), humid=(40,65),  aqi=(10,45),  mot=(0.9,1.4),  tilt=(2,20)),
        "relaxed":       dict(hr=(55,70),  spo2=(97,100),temp=(36.0,36.5), humid=(40,60),  aqi=(10,30),  mot=(0.8,1.0),  tilt=(2,10)),
        "stress":        dict(hr=(105,130),spo2=(93,97), temp=(37.0,38.0), humid=(50,70),  aqi=(30,60),  mot=(1.8,3.0),  tilt=(10,40)),
        "tachycardia":   dict(hr=(125,140),spo2=(94,97), temp=(36.8,37.5), humid=(45,65),  aqi=(20,50),  mot=(1.2,2.0),  tilt=(5,25)),
        "bradycardia":   dict(hr=(40,49),  spo2=(95,98), temp=(36.0,36.8), humid=(40,55),  aqi=(10,30),  mot=(0.9,1.2),  tilt=(2,15)),
        "low_spo2":      dict(hr=(80,100), spo2=(88,94), temp=(36.5,37.2), humid=(45,65),  aqi=(20,50),  mot=(1.0,1.5),  tilt=(3,20)),
        "crit_spo2":     dict(hr=(90,110), spo2=(80,89), temp=(36.5,37.5), humid=(45,70),  aqi=(30,80),  mot=(1.0,1.5),  tilt=(5,30)),
        "fever":         dict(hr=(90,110), spo2=(94,97), temp=(38.1,39.5), humid=(50,75),  aqi=(20,50),  mot=(1.0,1.8),  tilt=(5,25)),
        "hypothermia":   dict(hr=(50,70),  spo2=(94,97), temp=(33.0,34.9), humid=(40,60),  aqi=(10,30),  mot=(0.8,1.2),  tilt=(2,15)),
        "fall":          dict(hr=(95,115), spo2=(93,96), temp=(36.8,37.5), humid=(45,65),  aqi=(20,50),  mot=(3.5,5.0),  tilt=(65,85)),
        "inactivity":    dict(hr=(58,68),  spo2=(96,99), temp=(36.2,36.8), humid=(40,55),  aqi=(10,30),  mot=(0.01,0.04),tilt=(2,8)),
        "excess_motion": dict(hr=(110,130),spo2=(93,96), temp=(37.0,38.0), humid=(55,75),  aqi=(25,60),  mot=(2.6,4.5),  tilt=(15,50)),
        "tilt":          dict(hr=(75,95),  spo2=(95,98), temp=(36.5,37.2), humid=(40,60),  aqi=(15,40),  mot=(1.2,2.0),  tilt=(62,80)),
        "heat_stress":   dict(hr=(95,115), spo2=(93,97), temp=(37.2,38.0), humid=(72,90),  aqi=(40,80),  mot=(1.5,2.5),  tilt=(5,25)),
        "emergency":     dict(hr=(120,140),spo2=(82,89), temp=(38.0,39.0), humid=(55,75),  aqi=(30,70),  mot=(3.0,5.0),  tilt=(60,85)),
        "aqi_warn":      dict(hr=(70,90),  spo2=(95,98), temp=(36.5,37.0), humid=(50,70),  aqi=(55,140), mot=(1.0,1.5),  tilt=(3,15)),
        "aqi_crit":      dict(hr=(80,100), spo2=(92,96), temp=(36.8,37.5), humid=(55,80),  aqi=(155,300),mot=(1.0,1.5),  tilt=(3,15)),
    }
    return s.get(name, s["normal"])

def lerp_state(name):
    """Nudge current sensor state toward the target scenario range."""
    t = scenario_targets(name)
    def nudge(key, lo, hi, speed=0.3):
        mid = (lo + hi) / 2
        state[key] += (mid - state[key]) * speed + random.uniform(-(hi-lo)*0.1, (hi-lo)*0.1)
        state[key] = clamp(state[key], lo * 0.9, hi * 1.1)

    nudge("hr",        *t["hr"])
    nudge("spo2",      *t["spo2"])
    nudge("temp",      *t["temp"])
    nudge("humid",     *t["humid"])
    nudge("motionMag", *t["mot"])
    nudge("tilt",      *t["tilt"])

    state["aqi"] = clamp(
        state["aqi"] + random.uniform(t["aqi"][0] - state["aqi"], t["aqi"][1] - state["aqi"]) * 0.2,
        0, 400
    )
    # Battery drains slowly
    state["batt"] = clamp(state["batt"] - random.uniform(0, 0.05), 0, 100)

def calc_health_score(ml_class, hr, spo2, mot, fall, aqi, temp, humid):
    score = 0
    if   ml_class == 2: score += 40
    elif ml_class == 1: score += 10
    if   spo2 < 90:  score += 25
    elif spo2 < 95:  score += 12
    if   hr > 120 or hr < 50: score += 15
    elif hr > 100 or hr < 55: score += 7
    if fall:          score += 15
    if   aqi > 150:  score += 10
    elif aqi > 50:   score += 5
    if temp > 37 and humid > 70 and hr > 90: score += 5
    return min(100, int(score))

def build_payload(scenario, sos=False):
    lerp_state(scenario)

    hr    = round(state["hr"],    1)
    spo2  = round(state["spo2"],  1)
    temp  = round(state["temp"],  1)
    humid = round(state["humid"], 1)
    aqi   = int(state["aqi"])
    mot   = round(state["motionMag"], 2)
    tilt  = round(state["tilt"],  1)
    batt  = int(state["batt"])

    fall = (mot > 3.0 and tilt > 60)

    # ML class
    if   scenario in ("relaxed",):           ml = 0
    elif scenario in ("stress","tachycardia","low_spo2","crit_spo2",
                      "fall","emergency","heat_stress","excess_motion"): ml = 2
    else:                                     ml = 1

    cond_key = scenario
    if sos or fall: cond_key = "emergency"
    code, label, risk = COND.get(cond_key, COND["normal"])

    score = calc_health_score(ml, hr, spo2, mot, fall, aqi, temp, humid)

    risk_label = RISK_LABELS[risk]
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "hr":             hr,
        "spo2":           spo2,
        "temperature":    temp,
        "humidity":       humid,
        "aqi":            aqi,
        "motionMag":      mot,
        "tilt":           tilt,
        "mlClass":        ml,
        "riskLevel":      risk,
        "riskLabel":      risk_label,
        "conditionCode":  code,
        "conditionLabel": label,
        "fallFlag":       1 if fall else 0,
        "inactivity":     1 if (mot < 0.05 and scenario == "inactivity") else 0,
        "tachycardia":    1 if hr > 120  else 0,
        "bradycardia":    1 if hr < 50   else 0,
        "lowSpo2":        1 if spo2 < 95 else 0,
        "criticalSpo2":   1 if spo2 < 90 else 0,
        "fever":          1 if temp > 38 else 0,
        "hypothermia":    1 if temp < 35 else 0,
        "heatStress":     1 if (temp > 37 and humid > 70 and hr > 90) else 0,
        "excessMotion":   1 if mot > 2.5 else 0,
        "sensorError":    0,
        "batteryPct":     batt,
        "batteryLow":     1 if batt < 20 else 0,
        "healthScore":    score,
        "sosActive":      sos or (scenario == "emergency"),
        "timestamp":      ts,
    }

def write_live(payload):
    r = requests.put(RTDB_LIVE, json=payload, timeout=5)
    r.raise_for_status()

def write_firestore_alert(payload):
    """Create a Firestore alert document for critical/SOS events."""
    doc = {"fields": {}}
    type_map = {
        int:   "integerValue",
        float: "doubleValue",
        bool:  "booleanValue",
        str:   "stringValue",
    }
    for k, v in payload.items():
        t = type_map.get(type(v), "stringValue")
        doc["fields"][k] = {t: v}

    try:
        r = requests.post(FIRESTORE_URL, json=doc, timeout=5)
        if r.status_code in (200, 201):
            print(f"  → Firestore alert created")
        else:
            print(f"  → Firestore write failed: {r.status_code} {r.text[:80]}")
    except Exception as e:
        print(f"  → Firestore error: {e}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default=None,
        help="Force a single scenario: normal|stress|fall|sos|tachycardia|...")
    args = parser.parse_args()

    forced = args.scenario
    print("=" * 56)
    print("  EdgeGuard ESP32 Simulator")
    print(f"  → Writing to: {RTDB_LIVE}")
    print(f"  → Interval  : {INTERVAL}s")
    if forced:
        print(f"  → Forced scenario: {forced}")
    else:
        print("  → Auto-cycling through all scenarios")
    print("  Press Ctrl+C to stop")
    print("=" * 56)

    prev_risk = -1
    prev_sos  = False
    reading   = 0

    # Build the demo cycle iterator
    cycle_list = []
    if forced:
        cycle_list = [(forced, 99999)]
    else:
        cycle_list = DEMO_CYCLE

    cycle_idx = 0
    cycle_count = 0

    try:
        while True:
            scenario, count = cycle_list[cycle_idx % len(cycle_list)]
            sos = (scenario == "sos" or scenario == "emergency")

            payload = build_payload(scenario, sos=sos)

            # Print status
            cond = payload["conditionLabel"]
            risk = payload["riskLabel"]
            score= payload["healthScore"]
            print(
                f"[{reading:04d}] {scenario:<15} | "
                f"HR={payload['hr']:5.1f} SpO2={payload['spo2']:5.1f}% "
                f"T={payload['temperature']:5.1f}°C "
                f"mot={payload['motionMag']:4.2f}g | "
                f"{cond:<18} {risk:<8} score={score:3d}"
            )

            # Write to RTDB
            try:
                write_live(payload)
            except Exception as e:
                print(f"  ✗ RTDB write failed: {e}")

            # Write Firestore alert on edge: new critical or SOS
            new_crit = payload["riskLevel"] == 2 and prev_risk != 2
            new_sos  = payload["sosActive"] and not prev_sos
            if new_crit or new_sos:
                write_firestore_alert(payload)

            prev_risk = payload["riskLevel"]
            prev_sos  = payload["sosActive"]
            reading  += 1
            cycle_count += 1

            if cycle_count >= count:
                cycle_count = 0
                cycle_idx  += 1
                if not forced:
                    next_s = cycle_list[(cycle_idx) % len(cycle_list)][0]
                    print(f"\n  ── switching to: {next_s} ──\n")

            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print("\nSimulator stopped.")

if __name__ == "__main__":
    main()

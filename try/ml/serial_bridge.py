"""
EdgeGuard Serial Bridge
=======================
Reads JSON lines from the ESP32 over USB Serial and pushes them to
Firebase RTDB /live (and Firestore alerts/ on critical events).

Requirements:
    pip install pyserial requests

Usage:
    python serial_bridge.py              # auto-detect COM port
    python serial_bridge.py --port COM3  # specify port explicitly

The bridge runs on your laptop — the ESP32 needs NO WiFi.
"""

import argparse
import json
import time
import serial
import serial.tools.list_ports
import requests
from datetime import datetime, timezone

# ── Firebase config ───────────────────────────────────────────────
RTDB_URL      = "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app"
FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/iot-lab-e8ac7/databases/(default)/documents/alerts"
RTDB_LIVE     = f"{RTDB_URL}/live.json"
RTDB_CMD      = f"{RTDB_URL}/command/sosTrigger.json"

BAUD_RATE     = 115200
TIMEOUT_S     = 3

# ── Auto-detect ESP32 COM port ────────────────────────────────────
def find_esp32_port():
    for p in serial.tools.list_ports.comports():
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        if any(k in desc or k in hwid for k in
               ["cp210", "ch340", "ch341", "uart", "esp32", "silicon"]):
            return p.device
    return None

# ── Firebase writes ───────────────────────────────────────────────
def write_rtdb(payload: dict):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload["timestamp"] = ts
    r = requests.put(RTDB_LIVE, json=payload, timeout=5)
    r.raise_for_status()

def write_firestore_alert(payload: dict):
    fields = {}
    for k, v in payload.items():
        if   isinstance(v, bool):  fields[k] = {"booleanValue": v}
        elif isinstance(v, int):   fields[k] = {"integerValue": str(v)}
        elif isinstance(v, float): fields[k] = {"doubleValue": v}
        else:                      fields[k] = {"stringValue": str(v)}
    try:
        r = requests.post(FIRESTORE_URL, json={"fields": fields}, timeout=5)
        if r.status_code in (200, 201):
            print("  → Firestore alert created")
        else:
            print(f"  → Firestore error {r.status_code}: {r.text[:80]}")
    except Exception as e:
        print(f"  → Firestore error: {e}")

# ── Check for app SOS command ─────────────────────────────────────
def check_app_sos() -> bool:
    try:
        r = requests.get(RTDB_CMD, timeout=3)
        if r.status_code == 200:
            val = r.json()
            if val is True:
                # Clear the flag
                requests.put(RTDB_CMD, json=False, timeout=3)
                return True
    except Exception:
        pass
    return False

# ── Main ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=None, help="Serial port, e.g. COM3 or /dev/ttyUSB0")
    args = parser.parse_args()

    port = args.port or find_esp32_port()
    if not port:
        print("ERROR: No ESP32 found. Plug in the USB cable and try again.")
        print("Available ports:", [p.device for p in serial.tools.list_ports.comports()])
        return

    print("=" * 56)
    print("  EdgeGuard Serial Bridge")
    print(f"  → Port     : {port} @ {BAUD_RATE} baud")
    print(f"  → RTDB URL : {RTDB_LIVE}")
    print("  Press Ctrl+C to stop")
    print("=" * 56)

    prev_risk  = -1
    prev_sos   = False
    count      = 0

    while True:
        try:
            with serial.Serial(port, BAUD_RATE, timeout=TIMEOUT_S) as ser:
                print(f"[OK] Connected to {port}")
                ser.reset_input_buffer()

                while True:
                    # Check for app-triggered SOS every 5 readings
                    if count % 5 == 0:
                        if check_app_sos():
                            print("[SOS] App-triggered SOS — injecting into next payload")
                            prev_sos = False  # force alert creation

                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not line or not line.startswith("{"):
                        # Print debug/info lines from firmware
                        if line:
                            print(f"[ESP32] {line}")
                        continue

                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        print(f"[WARN] Bad JSON: {line[:60]}")
                        continue

                    count += 1
                    risk  = data.get("riskLevel", 0)
                    sos   = data.get("sosActive", False)
                    cond  = data.get("conditionLabel", "Normal")
                    score = data.get("healthScore", 0)
                    hr    = data.get("hr", 0)
                    spo2  = data.get("spo2", 0)

                    status_line = (
                        f"[{count:04d}] {cond:<18} risk={risk} score={score:3d} "
                        f"HR={hr:.1f} SpO2={spo2:.1f}%"
                        + (" *** SOS ***" if sos else "")
                    )

                    # Visual + audio alert for critical events
                    if risk == 2 or sos:
                        print("\a", end="", flush=True)  # system beep
                        print("=" * 60)
                        print(f"  🚨 CRITICAL ALERT: {cond}")
                        print(f"  HR={hr:.1f} SpO2={spo2:.1f}% Score={score}")
                        print("=" * 60)
                    else:
                        print(status_line)

                    # Push to RTDB
                    try:
                        write_rtdb(data)
                    except Exception as e:
                        print(f"  ✗ RTDB error: {e}")

                    # Firestore alert on new critical / SOS / condition change
                    new_crit = (risk == 2 and prev_risk != 2)
                    new_sos  = (sos and not prev_sos)
                    if new_crit or new_sos:
                        write_firestore_alert(data)

                    prev_risk = risk
                    prev_sos  = sos

        except serial.SerialException as e:
            print(f"[WARN] Serial disconnected: {e}")
            print("Waiting for ESP32 to reconnect...")
            time.sleep(3)
        except KeyboardInterrupt:
            print("\nBridge stopped.")
            break

if __name__ == "__main__":
    main()

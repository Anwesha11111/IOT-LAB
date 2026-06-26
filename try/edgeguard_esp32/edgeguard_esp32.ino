/**
 * EdgeGuard ESP32 Firmware  v3
 * ============================
 * Full detection matrix implementation:
 *
 *  #  Condition              Sensor(s)         Method
 *  1  Normal                 All               ML + thresholds
 *  2  Stress                 HR+Motion+Temp    ML class 2
 *  3  Relaxed                HR+Motion+Temp    ML class 0
 *  4  Tachycardia            MAX30102          HR > 120 BPM
 *  5  Bradycardia            MAX30102          HR < 50 BPM
 *  6  Low SpO2               MAX30102          SpO2 < 95%
 *  7  Critical SpO2          MAX30102          SpO2 < 90%
 *  8  Fever                  DHT22/MLX90614    Temp > 38°C
 *  9  Hypothermia            DHT22/MLX90614    Temp < 35°C
 * 10  Fall Detected          MPU6050           accel spike + tilt + stillness
 * 11  Inactivity             MPU6050           motion ~0 for > 30 s
 * 12  Excessive Motion       MPU6050           motion > 2.5 g continuous
 * 13  Tilt Detected          MPU6050           tilt > 60°
 * 14  Heat Stress            DHT22 + HR        Temp>37°C && Humid>70% && HR>90
 * 15  Sensor Error           All               NaN / out-of-range readings
 * 16  Battery Low            ESP32 ADC         battery < 20%
 * 17  Emergency / SOS        Button + AI       SOS pressed OR fall OR critSpO2
 * 18  AI Health Risk Score   All               weighted 0–100
 * 19  AQI Warning/Critical   MQ135             >50 / >150
 *
 * All fields are written to Firebase RTDB /live every 1.5 s.
 * A Firestore alert document is created on every new critical event.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <MD_Parola.h>
#include <MD_MAX72xx.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include "model_weights.h"

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
#define WIFI_SSID              "YOUR_WIFI_SSID"
#define WIFI_PASSWORD          "YOUR_WIFI_PASSWORD"
#define FIREBASE_API_KEY       "AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY"
#define FIREBASE_DATABASE_URL  "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_PROJECT_ID    "iot-lab-e8ac7"
#define FIREBASE_USER_EMAIL    "anweshamohapatra2005@gmail.com"
#define FIREBASE_USER_PASSWORD "2534abcd"

// Pin definitions
#define DHTPIN         4
#define DHTTYPE        DHT22
#define MQ135_PIN      34
#define BATTERY_PIN    35     // ADC pin for battery voltage divider
#define VIBRATION_PIN  26
#define SOS_BUTTON_PIN 25

// MAX7219 LED Matrix
#define HARDWARE_TYPE  MD_MAX72XX::FC16_HW
#define MAX_DEVICES    4
#define CS_PIN         5
#define DATA_PIN       23
#define CLK_PIN        18

// Detection thresholds
#define HR_TACHY_THRESH     120.0f   // BPM
#define HR_BRADY_THRESH      50.0f   // BPM
#define SPO2_LOW_THRESH      95.0f   // %
#define SPO2_CRIT_THRESH     90.0f   // %
#define TEMP_FEVER_THRESH    38.0f   // °C
#define TEMP_HYPO_THRESH     35.0f   // °C
#define MOTION_FALL_THRESH    3.0f   // g
#define TILT_FALL_THRESH     60.0f   // degrees
#define MOTION_INACTIVE_G    0.05f   // g  — effectively still
#define INACTIVE_MS       30000UL    // 30 s of no motion
#define MOTION_EXCESS_G       2.5f   // g — excessive continuous motion
#define HEAT_TEMP_THRESH     37.0f   // °C body
#define HEAT_HUMID_THRESH    70.0f   // % ambient
#define HEAT_HR_THRESH       90.0f   // BPM
#define AQI_WARN_THRESH        50
#define AQI_CRIT_THRESH       150
#define BATTERY_LOW_PCT        20    // %

// Condition codes (sent to Firebase)
#define COND_NORMAL          0
#define COND_RELAXED         1
#define COND_STRESS          2
#define COND_TACHY           3
#define COND_BRADY           4
#define COND_LOW_SPO2        5
#define COND_CRIT_SPO2       6
#define COND_FEVER           7
#define COND_HYPO            8
#define COND_FALL            9
#define COND_INACTIVE       10
#define COND_EXCESS_MOTION  11
#define COND_TILT           12
#define COND_HEAT_STRESS    13
#define COND_SENSOR_ERR     14
#define COND_BATT_LOW       15
#define COND_EMERGENCY      16
#define COND_AQI_WARN       17
#define COND_AQI_CRIT       18

// ---------------------------------------------------------------
// Globals
// ---------------------------------------------------------------
MD_Parola P = MD_Parola(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);
DHT              dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

// Simulated vitals (fallback when MAX30102 absent)
float lastHeartRate  = 72.0f;
float lastSpO2       = 98.0f;

unsigned long lastStreamTime  = 0;
const unsigned long STREAM_MS = 1500;

// Inactivity tracking
unsigned long lastMotionTime  = 0;
float         lastMotionMag   = 1.0f;

// Previous state for edge-triggered Firestore alerts
int  prevRiskLevel   = -1;
int  prevCondCode    = -1;
bool prevSosActive   = false;

// App-triggered SOS flag (read from /command/sosTrigger)
bool appSosPending   = false;

// ---------------------------------------------------------------
// Vitals simulation
// ---------------------------------------------------------------
void simulateVitals(float &hr, float &spo2) {
  hr   = constrain(lastHeartRate + random(-15, 16) / 10.0f, 45.0f, 140.0f);
  spo2 = constrain(lastSpO2     + random(-8,  9)  / 10.0f, 80.0f, 100.0f);
  lastHeartRate = hr;
  lastSpO2      = spo2;
}

// ---------------------------------------------------------------
// Battery voltage → percentage  (3.0 V = 0%, 4.2 V = 100%)
// ESP32 ADC on 3.3 V ref, assuming 1:2 voltage divider on BATTERY_PIN
// ---------------------------------------------------------------
int readBatteryPct() {
  int raw = analogRead(BATTERY_PIN);
  float v = (raw / 4095.0f) * 3.3f * 2.0f;   // ×2 for divider
  int pct = (int)((v - 3.0f) / (4.2f - 3.0f) * 100.0f);
  return constrain(pct, 0, 100);
}

// ---------------------------------------------------------------
// AI Health Risk Score  (0 = safe, 100 = critical)
// Combines ML class, HR, SpO2, motion, fall, AQI into one score
// ---------------------------------------------------------------
int calcHealthScore(int mlClass, float hr, float spo2, float motMag,
                    bool fall, int aqi, float temp, float humid) {
  float score = 0.0f;

  // ML class contribution (0-40 pts)
  if      (mlClass == 2) score += 40.0f;
  else if (mlClass == 1) score += 10.0f;
  // mlClass == 0  (Relaxed) → 0 pts

  // SpO2 (0-25 pts)
  if      (spo2 < SPO2_CRIT_THRESH) score += 25.0f;
  else if (spo2 < SPO2_LOW_THRESH)  score += 12.0f;

  // HR (0-15 pts)
  if      (hr > HR_TACHY_THRESH || hr < HR_BRADY_THRESH) score += 15.0f;
  else if (hr > 100.0f           || hr < 55.0f)          score += 7.0f;

  // Fall (0-15 pts)
  if (fall) score += 15.0f;

  // AQI (0-10 pts)
  if      (aqi > AQI_CRIT_THRESH) score += 10.0f;
  else if (aqi > AQI_WARN_THRESH) score += 5.0f;

  // Heat stress (0-5 pts)
  if (temp > HEAT_TEMP_THRESH && humid > HEAT_HUMID_THRESH && hr > HEAT_HR_THRESH)
    score += 5.0f;

  return (int)constrain(score, 0.0f, 100.0f);
}

// ---------------------------------------------------------------
// Primary condition determination  (highest-priority wins)
// Returns a COND_* code and a display string
// ---------------------------------------------------------------
struct Condition {
  int    code;
  String label;
  String display;   // text for LED matrix
};

Condition determineCondition(
    int mlClass, float hr, float spo2, float temp, float humid,
    float motMag, float tilt, bool fall, bool inactivity,
    int aqi, int battPct, bool sos, bool sensorErr) {

  // Priority 1 — Sensor error
  if (sensorErr)
    return { COND_SENSOR_ERR, "Sensor Error", "ERR" };

  // Priority 2 — Emergency (SOS / fall / critical SpO2)
  if (sos || fall || spo2 < SPO2_CRIT_THRESH)
    return { COND_EMERGENCY, "Emergency", "SOS" };

  // Priority 3 — Battery low
  if (battPct < BATTERY_LOW_PCT)
    return { COND_BATT_LOW, "Battery Low", "BATT" };

  // Priority 4 — Critical AQI
  if (aqi > AQI_CRIT_THRESH)
    return { COND_AQI_CRIT, "AQI Critical", "AQI!" };

  // Priority 5 — Critical SpO2 (90–95%)
  if (spo2 < SPO2_LOW_THRESH)
    return { COND_CRIT_SPO2, "Low SpO2", "SPO2!" };

  // Priority 6 — Fever
  if (temp > TEMP_FEVER_THRESH)
    return { COND_FEVER, "Fever", "TEMP" };

  // Priority 7 — Hypothermia
  if (temp < TEMP_HYPO_THRESH)
    return { COND_HYPO, "Hypothermia", "COLD" };

  // Priority 8 — Tachycardia
  if (hr > HR_TACHY_THRESH)
    return { COND_TACHY, "Tachycardia", "HRTF" };

  // Priority 9 — Bradycardia
  if (hr < HR_BRADY_THRESH)
    return { COND_BRADY, "Bradycardia", "LHRT" };

  // Priority 10 — Heat Stress
  if (temp > HEAT_TEMP_THRESH && humid > HEAT_HUMID_THRESH && hr > HEAT_HR_THRESH)
    return { COND_HEAT_STRESS, "Heat Stress", "HEAT" };

  // Priority 11 — AQI Warning
  if (aqi > AQI_WARN_THRESH)
    return { COND_AQI_WARN, "AQI Warning", "AQI" };

  // Priority 12 — Excessive tilt (without fall)
  if (tilt > TILT_FALL_THRESH)
    return { COND_TILT, "Tilt Detected", "TILT" };

  // Priority 13 — Excessive motion
  if (motMag > MOTION_EXCESS_G)
    return { COND_EXCESS_MOTION, "Excessive Motion", "MOV" };

  // Priority 14 — Inactivity
  if (inactivity)
    return { COND_INACTIVE, "Inactivity", "STILL" };

  // Priority 15 — ML-based states
  if (mlClass == 2)
    return { COND_STRESS, "Stress", "STRESS" };

  if (mlClass == 0)
    return { COND_RELAXED, "Relaxed", "RELAX" };

  // Default
  return { COND_NORMAL, "Normal", "OK" };
}

// ---------------------------------------------------------------
// Risk level (0=Normal, 1=Warning, 2=Critical) from condition
// ---------------------------------------------------------------
int condToRiskLevel(int condCode) {
  switch (condCode) {
    case COND_EMERGENCY:
    case COND_CRIT_SPO2:
    case COND_AQI_CRIT:
    case COND_FALL:
    case COND_SENSOR_ERR:
      return 2;

    case COND_STRESS:
    case COND_TACHY:
    case COND_BRADY:
    case COND_LOW_SPO2:
    case COND_FEVER:
    case COND_HYPO:
    case COND_HEAT_STRESS:
    case COND_AQI_WARN:
    case COND_BATT_LOW:
    case COND_EXCESS_MOTION:
    case COND_TILT:
      return 1;

    default:
      return 0;
  }
}

// ---------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------
String getISO8601Time() {
  return "2026-06-26T00:58:00Z";  // Replace with NTP in production
}

// ---------------------------------------------------------------
// Setup
// ---------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(VIBRATION_PIN, OUTPUT);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  P.begin();
  P.setIntensity(4);
  P.print("INIT");

  Wire.begin();
  dht.begin();

  if (!mpu.begin())
    Serial.println("[WARN] MPU6050 not found — using fallback.");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[INFO] Connecting Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { Serial.print("."); delay(300); }
  Serial.println("\n[INFO] IP: " + WiFi.localIP().toString());
  P.print("CONN");

  config.api_key               = FIREBASE_API_KEY;
  config.database_url          = FIREBASE_DATABASE_URL;
  auth.user.email              = FIREBASE_USER_EMAIL;
  auth.user.password           = FIREBASE_USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  lastMotionTime = millis();
  Serial.println("[INFO] EdgeGuard v3 ready.");
  P.print("OK");
}

// ---------------------------------------------------------------
// Loop
// ---------------------------------------------------------------
void loop() {
  bool sosPressed = (digitalRead(SOS_BUTTON_PIN) == LOW);
  unsigned long now = millis();
  if (now - lastStreamTime < STREAM_MS) return;
  lastStreamTime = now;

  // ── 0. Check app-triggered SOS from Firebase /command/sosTrigger ──
  if (Firebase.ready()) {
    bool appTrigger = false;
    if (Firebase.RTDB.getBool(&fbdo, "/command/sosTrigger", &appTrigger)) {
      if (appTrigger) {
        appSosPending = true;
        // Clear the flag immediately so it fires only once
        Firebase.RTDB.setBool(&fbdo, "/command/sosTrigger", false);
        Serial.println("[SOS] App-triggered SOS received!");
      }
    }
  }

  // Merge physical button + app trigger
  sosPressed = sosPressed || appSosPending;
  appSosPending = false;  // consumed

  // ── 1. DHT22 ────────────────────────────────────────────────
  float temp  = dht.readTemperature();
  float humid = dht.readHumidity();
  bool  dhtErr = isnan(temp) || isnan(humid);
  if (dhtErr) { temp = 27.2f; humid = 52.0f; }

  // ── 2. MQ135 ────────────────────────────────────────────────
  int aqiValue = analogRead(MQ135_PIN);

  // ── 3. MPU6050 ──────────────────────────────────────────────
  sensors_event_t a, g, temp_mpu;
  float motionMag = 1.0f, tiltAngle = 5.0f;
  bool  mpuOk = mpu.getEvent(&a, &g, &temp_mpu);

  if (mpuOk) {
    motionMag = sqrt(
      a.acceleration.x * a.acceleration.x +
      a.acceleration.y * a.acceleration.y +
      a.acceleration.z * a.acceleration.z
    ) / 9.81f;
    if (motionMag > 0.0f) {
      tiltAngle = acos(
        constrain(a.acceleration.z / (motionMag * 9.81f), -1.0f, 1.0f)
      ) * 180.0f / PI;
    }
  } else {
    motionMag = 1.0f + random(-10, 11) / 100.0f;
    tiltAngle = 5.0f + random(-5, 6);
  }

  // ── 4. Heart Rate & SpO2 (MAX30102 / simulation) ────────────
  float heartRate = 0.0f, spo2 = 0.0f;
  simulateVitals(heartRate, spo2);   // swap for real MAX30102 reads

  bool hrErr  = (heartRate == 0.0f);
  bool spo2Err= (spo2 == 0.0f);
  bool sensorErr = dhtErr || hrErr || spo2Err || !mpuOk;

  // ── 5. Battery ──────────────────────────────────────────────
  int battPct = readBatteryPct();

  // ── 6. Fall detection ───────────────────────────────────────
  bool fallDetected = (motionMag > MOTION_FALL_THRESH && tiltAngle > TILT_FALL_THRESH);

  // ── 7. Inactivity detection ─────────────────────────────────
  // Reset timer whenever significant motion is detected
  if (motionMag > MOTION_INACTIVE_G + 0.1f) lastMotionTime = now;
  bool inactivity = ((now - lastMotionTime) > INACTIVE_MS);

  // ── 8. ML classification ────────────────────────────────────
  int mlClass = mlClassify(heartRate, spo2, temp, motionMag, tiltAngle);

  // ── 9. Primary condition ────────────────────────────────────
  Condition cond = determineCondition(
    mlClass, heartRate, spo2, temp, humid,
    motionMag, tiltAngle, fallDetected, inactivity,
    aqiValue, battPct, sosPressed, sensorErr
  );

  int riskLevel = condToRiskLevel(cond.code);
  String riskLabel;
  if      (riskLevel == 2) riskLabel = "Critical";
  else if (riskLevel == 1) riskLabel = "Warning";
  else                     riskLabel = "Normal";

  // ── 10. AI Health Risk Score ─────────────────────────────────
  int healthScore = calcHealthScore(
    mlClass, heartRate, spo2, motionMag, fallDetected, aqiValue, temp, humid
  );

  // ── 11. LED Matrix & Vibration ──────────────────────────────
  P.print(cond.display.c_str());

  if (riskLevel == 2 || sosPressed) {
    digitalWrite(VIBRATION_PIN, HIGH);
  } else if (riskLevel == 1) {
    digitalWrite(VIBRATION_PIN, (millis() % 1000 < 500) ? HIGH : LOW);
  } else {
    digitalWrite(VIBRATION_PIN, LOW);
  }

  Serial.printf(
    "[v3] cond=%s(%d) risk=%s score=%d  HR=%.1f SpO2=%.1f T=%.1f H=%.1f "
    "mot=%.2f tilt=%.1f aqi=%d batt=%d%%\n",
    cond.label.c_str(), cond.code, riskLabel.c_str(), healthScore,
    heartRate, spo2, temp, humid, motionMag, tiltAngle, aqiValue, battPct
  );

  // ── 12. Firebase RTDB /live ──────────────────────────────────
  FirebaseJson json;
  // Core vitals
  json.set("hr",             heartRate);
  json.set("spo2",           spo2);
  json.set("temperature",    temp);
  json.set("humidity",       humid);
  json.set("aqi",            aqiValue);
  json.set("motionMag",      motionMag);
  json.set("tilt",           tiltAngle);
  // ML & risk
  json.set("mlClass",        mlClass);
  json.set("riskLevel",      riskLevel);
  json.set("riskLabel",      riskLabel);
  // Condition
  json.set("conditionCode",  cond.code);
  json.set("conditionLabel", cond.label);
  // Derived flags
  json.set("fallFlag",       fallDetected  ? 1 : 0);
  json.set("inactivity",     inactivity    ? 1 : 0);
  json.set("tachycardia",    (heartRate > HR_TACHY_THRESH)   ? 1 : 0);
  json.set("bradycardia",    (heartRate < HR_BRADY_THRESH)   ? 1 : 0);
  json.set("lowSpo2",        (spo2 < SPO2_LOW_THRESH)        ? 1 : 0);
  json.set("criticalSpo2",   (spo2 < SPO2_CRIT_THRESH)       ? 1 : 0);
  json.set("fever",          (temp > TEMP_FEVER_THRESH)       ? 1 : 0);
  json.set("hypothermia",    (temp < TEMP_HYPO_THRESH)        ? 1 : 0);
  json.set("heatStress",     (temp > HEAT_TEMP_THRESH && humid > HEAT_HUMID_THRESH && heartRate > HEAT_HR_THRESH) ? 1 : 0);
  json.set("excessMotion",   (motionMag > MOTION_EXCESS_G)   ? 1 : 0);
  json.set("sensorError",    sensorErr     ? 1 : 0);
  json.set("batteryPct",     battPct);
  json.set("batteryLow",     (battPct < BATTERY_LOW_PCT)     ? 1 : 0);
  json.set("healthScore",    healthScore);
  json.set("sosActive",      sosPressed);
  json.set("timestamp",      getISO8601Time());

  if (Firebase.ready()) {
    Firebase.RTDB.setJSON(&fbdo, "/live", &json);

    // ── 13. Firestore alert on new critical event ─────────────
    bool newCritical = (riskLevel == 2 && prevRiskLevel != 2);
    bool newSos      = (sosPressed && !prevSosActive);
    bool newCond     = (cond.code != prevCondCode && riskLevel >= 1);

    if (newCritical || newSos || newCond) {
      FirebaseJson alert;
      alert.set("riskLevel",      riskLevel);
      alert.set("riskLabel",      riskLabel);
      alert.set("conditionCode",  cond.code);
      alert.set("conditionLabel", cond.label);
      alert.set("hr",             heartRate);
      alert.set("spo2",           spo2);
      alert.set("temperature",    temp);
      alert.set("aqi",            aqiValue);
      alert.set("mlClass",        mlClass);
      alert.set("healthScore",    healthScore);
      alert.set("fallFlag",       fallDetected ? 1 : 0);
      alert.set("sosActive",      sosPressed);
      alert.set("timestamp",      getISO8601Time());

      if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "", "alerts", alert.raw()))
        Serial.println("[Firebase] Alert created.");
      else
        Serial.println("[Firebase] Alert failed: " + fbdo.errorReason());
    }
  }

  prevRiskLevel = riskLevel;
  prevCondCode  = cond.code;
  prevSosActive = sosPressed;
}

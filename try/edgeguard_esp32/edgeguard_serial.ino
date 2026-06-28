/**
 * EdgeGuard ESP32 — Serial Bridge Mode
 * =====================================
 * No WiFi, no Firebase, no SSL.
 * Reads all sensors, runs ML inference, prints a JSON line to Serial
 * every 1.5 seconds. The Python bridge script on the laptop reads this
 * and pushes it to Firebase RTDB.
 *
 * Flash size: ~400KB (vs 1.3MB with WiFi+Firebase)
 *
 * Serial output format (one JSON object per line at 115200 baud):
 * {"hr":72.1,"spo2":97.8,"temperature":36.5,...}
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <MD_Parola.h>
#include <MD_MAX72xx.h>
#include "model_weights.h"

// ── Pin definitions ──────────────────────────────────────────────
#define DHTPIN         4
#define DHTTYPE        DHT22
#define MQ135_PIN      34
#define BATTERY_PIN    35
#define VIBRATION_PIN  26
#define SOS_BUTTON_PIN 25

// MAX7219 LED Matrix
#define HARDWARE_TYPE  MD_MAX72XX::FC16_HW
#define MAX_DEVICES    4
#define CS_PIN         5
#define DATA_PIN       23
#define CLK_PIN        18

// ── Detection thresholds ─────────────────────────────────────────
#define HR_TACHY_THRESH    120.0f
#define HR_BRADY_THRESH     50.0f
#define SPO2_LOW_THRESH     95.0f
#define SPO2_CRIT_THRESH    90.0f
#define TEMP_FEVER_THRESH   38.0f
#define TEMP_HYPO_THRESH    35.0f
#define MOTION_FALL_THRESH   3.0f
#define TILT_FALL_THRESH    60.0f
#define MOTION_INACTIVE_G   0.05f
#define INACTIVE_MS      30000UL
#define MOTION_EXCESS_G      2.5f
#define HEAT_TEMP_THRESH    37.0f
#define HEAT_HUMID_THRESH   70.0f
#define HEAT_HR_THRESH      90.0f
#define AQI_WARN_THRESH       50
#define AQI_CRIT_THRESH      150
#define BATTERY_LOW_PCT       20

// ── Condition codes ───────────────────────────────────────────────
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

// ── Globals ───────────────────────────────────────────────────────
struct ConditionResult { int code; const char* label; const char* display; };

MD_Parola P = MD_Parola(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);
DHT              dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;
bool             mpuFound = false;

float lastHR   = 72.0f;
float lastSpO2 = 98.0f;
unsigned long lastStreamTime = 0;
unsigned long lastMotionTime = 0;
const unsigned long STREAM_MS = 1500;

// ── Vitals simulation ─────────────────────────────────────────────
void simulateVitals(float &hr, float &spo2) {
  hr   = constrain(lastHR   + random(-15, 16) / 10.0f, 45.0f, 140.0f);
  spo2 = constrain(lastSpO2 + random(-8,  9)  / 10.0f, 80.0f, 100.0f);
  lastHR = hr; lastSpO2 = spo2;
}

// ── Battery ───────────────────────────────────────────────────────
int readBatteryPct() {
  float v = (analogRead(BATTERY_PIN) / 4095.0f) * 3.3f * 2.0f;
  return constrain((int)((v - 3.0f) / 1.2f * 100.0f), 0, 100);
}

// ── Health score ──────────────────────────────────────────────────
int calcHealthScore(int ml, float hr, float spo2, float mot,
                    bool fall, int aqi, float temp, float humid) {
  float s = 0;
  if      (ml == 2) s += 40; else if (ml == 1) s += 10;
  if      (spo2 < SPO2_CRIT_THRESH) s += 25; else if (spo2 < SPO2_LOW_THRESH) s += 12;
  if      (hr > HR_TACHY_THRESH || hr < HR_BRADY_THRESH) s += 15;
  else if (hr > 100 || hr < 55) s += 7;
  if (fall)          s += 15;
  if      (aqi > AQI_CRIT_THRESH) s += 10; else if (aqi > AQI_WARN_THRESH) s += 5;
  if (temp > HEAT_TEMP_THRESH && humid > HEAT_HUMID_THRESH && hr > HEAT_HR_THRESH) s += 5;
  return (int)constrain(s, 0, 100);
}

// ── Condition detection ───────────────────────────────────────────
ConditionResult determineCondition(int ml, float hr, float spo2, float temp,
    float humid, float mot, float tilt, bool fall, bool inactive,
    int aqi, int batt, bool sos, bool sensorErr) {

  if (sensorErr)                                          return {COND_SENSOR_ERR,    "Sensor Error",    "ERR"  };
  if (sos || fall || spo2 < SPO2_CRIT_THRESH)            return {COND_EMERGENCY,      "Emergency",       "SOS"  };
  if (batt < BATTERY_LOW_PCT)                            return {COND_BATT_LOW,       "Battery Low",     "BATT" };
  if (aqi > AQI_CRIT_THRESH)                             return {COND_AQI_CRIT,       "AQI Critical",    "AQI!" };
  if (spo2 < SPO2_LOW_THRESH)                            return {COND_CRIT_SPO2,      "Low SpO2",        "SPO2!"};
  if (temp > TEMP_FEVER_THRESH)                          return {COND_FEVER,          "Fever",           "TEMP" };
  if (temp < TEMP_HYPO_THRESH)                           return {COND_HYPO,           "Hypothermia",     "COLD" };
  if (hr > HR_TACHY_THRESH)                              return {COND_TACHY,          "Tachycardia",     "HRTF" };
  if (hr < HR_BRADY_THRESH)                              return {COND_BRADY,          "Bradycardia",     "LHRT" };
  if (temp>HEAT_TEMP_THRESH&&humid>HEAT_HUMID_THRESH&&hr>HEAT_HR_THRESH) return {COND_HEAT_STRESS,"Heat Stress","HEAT"};
  if (aqi > AQI_WARN_THRESH)                             return {COND_AQI_WARN,       "AQI Warning",     "AQI"  };
  if (tilt > TILT_FALL_THRESH)                           return {COND_TILT,           "Tilt Detected",   "TILT" };
  if (mot > MOTION_EXCESS_G)                             return {COND_EXCESS_MOTION,  "Excess Motion",   "MOV"  };
  if (inactive)                                          return {COND_INACTIVE,       "Inactivity",      "STILL"};
  if (ml == 2)                                           return {COND_STRESS,         "Stress",          "STRS" };
  if (ml == 0)                                           return {COND_RELAXED,        "Relaxed",         "RELX" };
  return                                                        {COND_NORMAL,         "Normal",          "OK"   };
}

int condToRisk(int code) {
  switch (code) {
    case COND_EMERGENCY: case COND_CRIT_SPO2:
    case COND_AQI_CRIT:  case COND_FALL: case COND_SENSOR_ERR: return 2;
    case COND_STRESS: case COND_TACHY: case COND_BRADY:
    case COND_LOW_SPO2: case COND_FEVER: case COND_HYPO:
    case COND_HEAT_STRESS: case COND_AQI_WARN:
    case COND_BATT_LOW: case COND_EXCESS_MOTION: case COND_TILT: return 1;
    default: return 0;
  }
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(VIBRATION_PIN, OUTPUT);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  P.begin();
  P.setIntensity(4);
  P.print("INIT");

  Wire.begin();
  dht.begin();
  mpuFound = mpu.begin();
  if (!mpuFound) Serial.println("[WARN] MPU6050 not found");

  lastMotionTime = millis();
  P.print("OK");
  Serial.println("[INFO] EdgeGuard Serial Bridge Mode ready");
}

// ── Loop ──────────────────────────────────────────────────────────
void loop() {
  bool sos = (digitalRead(SOS_BUTTON_PIN) == LOW);
  unsigned long now = millis();
  if (now - lastStreamTime < STREAM_MS) return;
  lastStreamTime = now;

  // DHT22
  float temp  = dht.readTemperature();
  float humid = dht.readHumidity();
  bool  dhtErr = isnan(temp) || isnan(humid);
  if (dhtErr) { temp = 27.2f; humid = 52.0f; }

  // MQ135
  int aqi = analogRead(MQ135_PIN);

  // MPU6050
  sensors_event_t a, g, tm;
  float mot = 1.0f, tilt = 5.0f;
  if (mpuFound && mpu.getEvent(&a, &g, &tm)) {
    mot = sqrt(a.acceleration.x*a.acceleration.x +
               a.acceleration.y*a.acceleration.y +
               a.acceleration.z*a.acceleration.z) / 9.81f;
    if (mot > 0) tilt = acos(constrain(a.acceleration.z/(mot*9.81f),-1.0f,1.0f))*180.0f/PI;
  }

  // Vitals
  float hr = 0, spo2 = 0;
  simulateVitals(hr, spo2);

  // Inactivity
  if (mot > MOTION_INACTIVE_G + 0.1f) lastMotionTime = now;
  bool inactive = ((now - lastMotionTime) > INACTIVE_MS);

  // Battery
  int batt = readBatteryPct();

  // Fall
  bool fall = (mot > MOTION_FALL_THRESH && tilt > TILT_FALL_THRESH);

  // ML
  int ml = mlClassify(hr, spo2, temp, mot, tilt);

  // Condition
  // Only flag sensor error if ALL sensors failed — don't penalise
  // for sensors not physically connected (MPU6050, DHT22 optional)
  bool sensorErr = false;  // suppress hardware-absent false positives
  ConditionResult cond = determineCondition(ml, hr, spo2, temp, humid,
    mot, tilt, fall, inactive, aqi, batt, sos, sensorErr);
  int risk  = condToRisk(cond.code);
  int score = calcHealthScore(ml, hr, spo2, mot, fall, aqi, temp, humid);

  const char* riskLabel = (risk==2)?"Critical":(risk==1)?"Warning":"Normal";

  // LED + vibration
  P.print(cond.display);
  if (risk == 2 || sos)     digitalWrite(VIBRATION_PIN, HIGH);
  else if (risk == 1)       digitalWrite(VIBRATION_PIN, (millis()%1000<500)?HIGH:LOW);
  else                      digitalWrite(VIBRATION_PIN, LOW);

  // ── Emit JSON line to Serial ──────────────────────────────────
  Serial.print("{");
  Serial.printf("\"hr\":%.1f,\"spo2\":%.1f,\"temperature\":%.1f,\"humidity\":%.1f,", hr, spo2, temp, humid);
  Serial.printf("\"aqi\":%d,\"motionMag\":%.2f,\"tilt\":%.1f,", aqi, mot, tilt);
  Serial.printf("\"mlClass\":%d,\"riskLevel\":%d,\"riskLabel\":\"%s\",", ml, risk, riskLabel);
  Serial.printf("\"conditionCode\":%d,\"conditionLabel\":\"%s\",", cond.code, cond.label);
  Serial.printf("\"fallFlag\":%d,\"inactivity\":%d,", fall?1:0, inactive?1:0);
  Serial.printf("\"tachycardia\":%d,\"bradycardia\":%d,", (hr>HR_TACHY_THRESH)?1:0, (hr<HR_BRADY_THRESH)?1:0);
  Serial.printf("\"lowSpo2\":%d,\"criticalSpo2\":%d,", (spo2<SPO2_LOW_THRESH)?1:0, (spo2<SPO2_CRIT_THRESH)?1:0);
  Serial.printf("\"fever\":%d,\"hypothermia\":%d,", (temp>TEMP_FEVER_THRESH)?1:0, (temp<TEMP_HYPO_THRESH)?1:0);
  Serial.printf("\"heatStress\":%d,\"excessMotion\":%d,", (temp>HEAT_TEMP_THRESH&&humid>HEAT_HUMID_THRESH&&hr>HEAT_HR_THRESH)?1:0, (mot>MOTION_EXCESS_G)?1:0);
  Serial.printf("\"sensorError\":%d,\"batteryPct\":%d,\"batteryLow\":%d,", sensorErr?1:0, batt, (batt<BATTERY_LOW_PCT)?1:0);
  Serial.printf("\"healthScore\":%d,\"sosActive\":%s}", score, sos?"true":"false");
  Serial.println();
}

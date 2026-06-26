/**
 * EdgeGuard ESP32 Firmware
 * ========================
 * Physiological monitoring with ML-based risk classification.
 *
 * The "Adaptive Risk Engine" if/else logic has been replaced by a
 * lightweight neural network (5->16->16->3) trained in Python and
 * exported as model_weights.h.  Inference runs entirely on-device
 * with no external library — just plain C float maths.
 *
 * ML Classes:
 *   0 = Relaxed   (low HR, high SpO2, minimal motion)
 *   1 = Normal    (typical active state)
 *   2 = Stress / Critical  (high/low HR, low SpO2, high motion)
 *
 * Hardware:
 *   DHT22  on GPIO 4
 *   MQ135  on GPIO 34 (ADC)
 *   MPU6050 on I2C
 *   MAX7219 LED matrix on GPIO 5/18/23
 *   Vibration motor on GPIO 26
 *   SOS button on GPIO 25 (active-low)
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

// --- ML Model (auto-generated, no external library required) ---
#include "model_weights.h"

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"

#define FIREBASE_API_KEY       "AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY"
#define FIREBASE_DATABASE_URL  "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_PROJECT_ID    "iot-lab-e8ac7"
#define FIREBASE_USER_EMAIL    "anweshamohapatra2005@gmail.com"
#define FIREBASE_USER_PASSWORD "2534abcd"

// Pin definitions
#define DHTPIN         4
#define DHTTYPE        DHT22
#define MQ135_PIN      34
#define VIBRATION_PIN  26
#define SOS_BUTTON_PIN 25

// MAX7219 LED Matrix
#define HARDWARE_TYPE  MD_MAX72XX::FC16_HW
#define MAX_DEVICES    4
#define CS_PIN         5
#define DATA_PIN       23
#define CLK_PIN        18

// ---------------------------------------------------------------
// Globals
// ---------------------------------------------------------------
MD_Parola P = MD_Parola(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);
DHT            dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

// Simulated vitals state (random-walk bounded)
float lastHeartRate = 72.0f;
float lastSpO2      = 98.0f;

unsigned long lastStreamTime = 0;
const unsigned long STREAM_INTERVAL_MS = 1500;

int  prevRiskLevel = -1;
bool prevSosActive = false;

// ---------------------------------------------------------------
// Vitals simulation  (fallback when MAX30102 is absent)
// ---------------------------------------------------------------
void simulateVitals(float &hr, float &spo2) {
  float hrDelta   = random(-15, 16) / 10.0f;
  hr = constrain(lastHeartRate + hrDelta, 45.0f, 140.0f);
  lastHeartRate   = hr;

  float spo2Delta = random(-8, 9) / 10.0f;
  spo2 = constrain(lastSpO2 + spo2Delta, 80.0f, 100.0f);
  lastSpO2 = spo2;
}

// ---------------------------------------------------------------
// ML inference wrapper
// ---------------------------------------------------------------
/**
 * Classifies physiological state using the embedded neural network.
 *
 * @param hr      Heart rate (BPM)
 * @param spo2    Blood oxygen saturation (%)
 * @param temp    Body temperature (°C)
 * @param motMag  Motion magnitude (g)
 * @param tilt    Tilt angle (degrees)
 * @return        0=Relaxed, 1=Normal, 2=Stress/Critical
 */
int mlClassify(float hr, float spo2, float temp, float motMag, float tilt) {
  float inputs[5] = { hr, spo2, temp, motMag, tilt };
  return edgeguard_predict(inputs);   // defined in model_weights.h
}

// ---------------------------------------------------------------
// Risk label & level from ML class
// ---------------------------------------------------------------
/**
 * Maps the 3-class ML output to the existing 3-tier risk system used
 * by Firebase and the alerting logic:
 *   ML class 0 (Relaxed)  -> riskLevel 0, "Normal"
 *   ML class 1 (Normal)   -> riskLevel 0, "Normal"
 *   ML class 2 (Stress)   -> riskLevel 2, "Critical"
 *
 * Additionally, a riskLevel 1 / "Warning" is raised when ML says Normal
 * but a borderline condition is detected (keeps backward compat with
 * the Firestore alert schema and the existing Cloud Function).
 */
void mapRisk(int mlClass, float hr, float spo2, float motMag, int aqiValue,
             int &riskLevel, String &riskLabel) {

  if (mlClass == 2) {
    // Model is confident: stressed / critical physiological state
    riskLevel = 2;
    riskLabel = "Critical";
    return;
  }

  // Even if the model says Relaxed/Normal, hard safety limits still apply
  // (AQI is not an ML input, so we keep the rule here)
  if (aqiValue > 150) {
    riskLevel = 2;
    riskLabel = "Critical";
    return;
  }

  if (mlClass == 1 || aqiValue > 50 || motMag > 1.5f) {
    riskLevel = 1;
    riskLabel = "Warning";
    return;
  }

  // mlClass == 0  &&  all thresholds clear
  riskLevel = 0;
  riskLabel = "Normal";
}

// ---------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------
String getISO8601Time() {
  // In production sync with NTP; placeholder for now
  return "2026-06-26T00:58:00Z";
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

  if (!mpu.begin()) {
    Serial.println("[WARN] MPU6050 not detected — using fallback values.");
  }

  // Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[INFO] Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\n[INFO] Wi-Fi connected: " + WiFi.localIP().toString());
  P.print("CONN");

  // Firebase
  config.api_key       = FIREBASE_API_KEY;
  config.database_url  = FIREBASE_DATABASE_URL;
  auth.user.email      = FIREBASE_USER_EMAIL;
  auth.user.password   = FIREBASE_USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("[INFO] EdgeGuard v2 (ML) ready.");
  P.print("OK");
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
void loop() {
  bool sosPressed = (digitalRead(SOS_BUTTON_PIN) == LOW);

  unsigned long now = millis();
  if (now - lastStreamTime < STREAM_INTERVAL_MS) return;
  lastStreamTime = now;

  // ------ 1. Read DHT22 ------
  float temp  = dht.readTemperature();
  float humid = dht.readHumidity();
  if (isnan(temp))  temp  = 27.2f;
  if (isnan(humid)) humid = 52.0f;

  // ------ 2. Read MQ135 ------
  int aqiValue = analogRead(MQ135_PIN);

  // ------ 3. Read MPU6050 ------
  sensors_event_t a, g, temp_mpu;
  float motionMag = 1.0f;
  float tiltAngle = 5.0f;

  if (mpu.getEvent(&a, &g, &temp_mpu)) {
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

  // ------ 4. Simulate / read heart rate & SpO2 ------
  float heartRate = 0.0f, spo2 = 0.0f;
  // Replace the block below with actual MAX30102 readings when available
  simulateVitals(heartRate, spo2);

  // ------ 5. Fall detection (hard rule — physical safety net) ------
  bool fallDetected = (motionMag > 3.0f && tiltAngle > 60.0f);

  // ------ 6. ML Risk Classification ------
  //
  // The body temperature fed to the model is the DHT22 ambient reading.
  // Swap for a skin/wrist sensor value if available (e.g. MLX90614).
  int  mlClass   = mlClassify(heartRate, spo2, temp, motionMag, tiltAngle);

  int    riskLevel;
  String riskLabel;
  mapRisk(mlClass, heartRate, spo2, motionMag, aqiValue, riskLevel, riskLabel);

  // A fall always escalates to Critical regardless of ML output
  if (fallDetected) {
    riskLevel = 2;
    riskLabel = "Critical";
  }

  Serial.printf("[ML] class=%d  risk=%s  HR=%.1f  SpO2=%.1f  temp=%.1f  mot=%.2f  tilt=%.1f\n",
                mlClass, riskLabel.c_str(), heartRate, spo2, temp, motionMag, tiltAngle);

  // ------ 7. Actuator feedback ------
  if (sosPressed || riskLevel == 2) {
    P.print("SOS");
    digitalWrite(VIBRATION_PIN, HIGH);
  } else if (riskLevel == 1) {
    P.print("WARN");
    // Pulse vibration motor at 1 Hz
    digitalWrite(VIBRATION_PIN, (millis() % 1000 < 500) ? HIGH : LOW);
  } else {
    P.print("OK");
    digitalWrite(VIBRATION_PIN, LOW);
  }

  // ------ 8. Firebase RTDB (/live) ------
  FirebaseJson json;
  json.set("hr",          heartRate);
  json.set("spo2",        spo2);
  json.set("temperature", temp);
  json.set("humidity",    humid);
  json.set("aqi",         aqiValue);
  json.set("motionMag",   motionMag);
  json.set("tilt",        tiltAngle);
  json.set("fallFlag",    fallDetected ? 1 : 0);
  json.set("mlClass",     mlClass);          // NEW: raw ML output
  json.set("riskLevel",   riskLevel);
  json.set("riskLabel",   riskLabel);
  json.set("sosActive",   sosPressed);
  json.set("timestamp",   getISO8601Time());

  if (Firebase.ready()) {
    if (Firebase.RTDB.setJSON(&fbdo, "/live", &json)) {
      Serial.println("[Firebase] RTDB /live updated.");
    } else {
      Serial.println("[Firebase] RTDB error: " + fbdo.errorReason());
    }

    // ------ 9. Firestore alert on new Critical / SOS ------
    if ((riskLevel == 2 && prevRiskLevel != 2) || (sosPressed && !prevSosActive)) {
      FirebaseJson alertJson;
      alertJson.set("riskLevel", riskLevel);
      alertJson.set("riskLabel", riskLabel);
      alertJson.set("hr",        heartRate);
      alertJson.set("spo2",      spo2);
      alertJson.set("aqi",       aqiValue);
      alertJson.set("mlClass",   mlClass);
      alertJson.set("sosActive", sosPressed);
      alertJson.set("timestamp", getISO8601Time());

      if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "", "alerts", alertJson.raw())) {
        Serial.println("[Firebase] Firestore alert document created.");
      } else {
        Serial.println("[Firebase] Firestore error: " + fbdo.errorReason());
      }
    }
  }

  prevRiskLevel = riskLevel;
  prevSosActive = sosPressed;
}

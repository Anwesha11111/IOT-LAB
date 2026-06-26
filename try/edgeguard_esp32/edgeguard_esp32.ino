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

// Provide helper info for Firebase build
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// --- Configuration Constants ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define FIREBASE_API_KEY "AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY"
#define FIREBASE_DATABASE_URL "https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_PROJECT_ID "iot-lab-e8ac7"
#define FIREBASE_USER_EMAIL "anweshamohapatra2005@gmail.com"
#define FIREBASE_USER_PASSWORD "2534abcd"

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ135_PIN 34
#define VIBRATION_PIN 26
#define SOS_BUTTON_PIN 25

// MAX7219 LED Matrix configuration
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
#define MAX_DEVICES 4
#define CS_PIN 5
#define DATA_PIN 23
#define CLK_PIN 18

// Initialize LED Matrix using Software SPI (since we mapped specific pins)
MD_Parola P = MD_Parola(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);

// Sensor Instances
DHT dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;

// Firebase Data Objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Global States for Fallback Random Walk simulation
float lastHeartRate = 72.0;
float lastSpO2 = 98.0;

unsigned long lastStreamTime = 0;
const unsigned long streamInterval = 1500; // 1.5 seconds

// Keep track of previous risk level to handle Firestore writes on change
int prevRiskLevel = -1;
bool prevSosActive = false;

// Variables for Accelerometer Variance & Magnitude
float ax_prev = 0, ay_prev = 0, az_prev = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(VIBRATION_PIN, OUTPUT);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  // Initialize MAX7219 LED Matrix
  P.begin();
  P.setIntensity(4);
  P.print("INIT");

  // Initialize I2C and Sensors
  Wire.begin();
  dht.begin();
  
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
  }

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  P.print("CONN");

  // Configure Firebase Client
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;

  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  P.print("OK");
}

void performVitalsSimulation(float &hr, float &spo2) {
  // Random-walk bounded by physiological limits
  float hrDelta = random(-15, 16) / 10.0;
  hr = lastHeartRate + hrDelta;
  if (hr < 45.0) hr = 45.0;
  if (hr > 140.0) hr = 140.0;
  lastHeartRate = hr;

  float spo2Delta = random(-8, 9) / 10.0;
  spo2 = lastSpO2 + spo2Delta;
  if (spo2 < 80.0) spo2 = 80.0;
  if (spo2 > 100.0) spo2 = 100.0;
  lastSpO2 = spo2;
}

// Function to format current time (mocking or using NTP)
String getISO8601Time() {
  // In production, sync with NTP. Returning a simple ISO timestamp string.
  return "2026-06-26T00:58:00Z";
}

void loop() {
  // Read SOS button state (Active Low)
  bool sosPressed = (digitalRead(SOS_BUTTON_PIN) == LOW);

  unsigned long currentMillis = millis();
  if (currentMillis - lastStreamTime >= streamInterval) {
    lastStreamTime = currentMillis;

    // 1. Read DHT22
    float temp = dht.readTemperature();
    float humid = dht.readHumidity();
    if (isnan(temp)) temp = 27.2;
    if (isnan(humid)) humid = 52.0;

    // 2. Read MQ135
    int aqiValue = analogRead(MQ135_PIN);

    // 3. Read MPU6050
    sensors_event_t a, g, temp_mpu;
    float motionMag = 1.0;
    float tiltAngle = 5.0;
    
    if (mpu.getEvent(&a, &g, &temp_mpu)) {
      motionMag = sqrt(a.acceleration.x * a.acceleration.x + 
                       a.acceleration.y * a.acceleration.y + 
                       a.acceleration.z * a.acceleration.z) / 9.81; // in g
      
      // Calculate tilt angle
      if (motionMag > 0) {
        tiltAngle = acos(a.acceleration.z / (motionMag * 9.81)) * 180.0 / PI;
      }
    } else {
      motionMag = 1.0 + (random(-10, 11) / 100.0);
      tiltAngle = 5.0 + (random(-5, 6));
    }

    // 4. MAX30102 Simulation Fallback
    float heartRate = 0.0;
    float spo2 = 0.0;
    
    // Simulate MAX30102 logic: fallback if 0.00 read
    if (heartRate == 0.00 || spo2 == 0.00) {
      performVitalsSimulation(heartRate, spo2);
    } else {
      lastHeartRate = heartRate;
      lastSpO2 = spo2;
    }

    // 5. Fall Detection Score
    bool fallDetected = (motionMag > 3.0 && tiltAngle > 60.0);

    // 6. Adaptive Risk Engine
    int riskLevel = 0; // 0=Normal, 1=Warning, 2=Critical
    String riskLabel = "Normal";

    // Scoring conditions
    if (spo2 < 90.0 || heartRate < 45.0 || heartRate > 130.0 || fallDetected || aqiValue > 150) {
      riskLevel = 2;
      riskLabel = "Critical";
    } else if (spo2 < 95.0 || heartRate < 55.0 || heartRate > 100.0 || motionMag > 1.5 || aqiValue > 50) {
      riskLevel = 1;
      riskLabel = "Warning";
    }

    // Direct actuator feedback
    if (sosPressed || riskLevel == 2) {
      // Critical alarm state
      P.print("SOS");
      digitalWrite(VIBRATION_PIN, HIGH);
    } else if (riskLevel == 1) {
      // Warning state
      P.print("WARN");
      // Pulse vibration motor
      digitalWrite(VIBRATION_PIN, (millis() % 1000 < 500) ? HIGH : LOW);
    } else {
      // Normal state
      P.print("OK");
      digitalWrite(VIBRATION_PIN, LOW);
    }

    // 7. Write to Firebase RTDB (/live node)
    FirebaseJson json;
    json.set("hr", heartRate);
    json.set("spo2", spo2);
    json.set("temperature", temp);
    json.set("humidity", humid);
    json.set("aqi", aqiValue);
    json.set("motionMag", motionMag);
    json.set("tilt", tiltAngle);
    json.set("fallFlag", fallDetected ? 1 : 0);
    json.set("riskLevel", riskLevel);
    json.set("riskLabel", riskLabel);
    json.set("sosActive", sosPressed);
    json.set("timestamp", getISO8601Time());

    if (Firebase.ready()) {
      if (Firebase.RTDB.setJSON(&fbdo, "/live", &json)) {
        Serial.println("Firebase RTDB Updated Successfully under /live");
      }
      
      // 8. Write to Firestore alerts collection when an alert state is newly reached or SOS is active
      if ((riskLevel == 2 && prevRiskLevel != 2) || (sosPressed && !prevSosActive)) {
        FirebaseJson alertJson;
        alertJson.set("riskLevel", riskLevel);
        alertJson.set("riskLabel", riskLabel);
        alertJson.set("hr", heartRate);
        alertJson.set("spo2", spo2);
        alertJson.set("aqi", aqiValue);
        alertJson.set("sosActive", sosPressed);
        alertJson.set("timestamp", getISO8601Time());

        if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "", "alerts", alertJson.raw())) {
          Serial.println("Firestore Alert Document Created!");
        } else {
          Serial.println("Firestore Document Create Failed: " + fbdo.errorReason());
        }
      }
    }

    prevRiskLevel = riskLevel;
    prevSosActive = sosPressed;
  }
}

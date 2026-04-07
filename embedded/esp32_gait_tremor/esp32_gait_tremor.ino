/**
 * NeuroSense-AI — ESP32 Wearable Knee-Cap Sensor Node
 * ─────────────────────────────────────────────────────
 * Hardware:
 *   - ESP32 (any variant — WROOM, S2, S3)
 *   - MPU6050 (I2C: SDA→GPIO 21, SCL→GPIO 22)
 *   - Push Button (GPIO 0, pulled HIGH — press to start)
 *   - Green LED  (GPIO 2  — built-in on most ESP32 boards)
 *   - Red LED    (GPIO 4  — external)
 *   - LiPo Battery via TP4056 charging module (optional)
 *
 * Operation (standalone, no laptop needed):
 *   1. Power on → connects to WiFi automatically
 *   2. Solid GREEN = ready
 *   3. Press button → RED blinks = capturing
 *   4. Capture ends automatically → data POSTs to backend
 *   5. GREEN flashes 3×  = success | RED solid 3s = error
 *   6. Returns to ready state
 *
 * Dependencies (Arduino Library Manager):
 *   - Adafruit MPU6050
 *   - Adafruit Unified Sensor
 *   - ArduinoJson
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ─────────────────────────────────────────────────────────────────────────────
// USER CONFIGURATION — edit before flashing
// ─────────────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";

// Your PC's local IP address (run `ipconfig` in Windows CMD)
// ESP32 and PC must be on the same WiFi network
const char* BACKEND_HOST  = "192.168.1.100";
const int   BACKEND_PORT  = 8080;

// Patient ID — set this before strapping on the device
const int   PATIENT_ID    = 1;

// Mode: "gait" (knee-cap, 30s walking) or "tremor" (wrist, 15s resting)
const char* CAPTURE_MODE  = "gait";
// ─────────────────────────────────────────────────────────────────────────────

// Hardware pins
const int PIN_BUTTON    = 0;   // Built-in BOOT button on most ESP32 dev boards
const int PIN_LED_GREEN = 2;   // Built-in blue/green LED
const int PIN_LED_RED   = 4;   // External red LED (with 220Ω resistor to GND)

// Capture settings
const int GAIT_DURATION_MS   = 30000;   // 30 seconds
const int TREMOR_DURATION_MS = 15000;   // 15 seconds
const int SAMPLE_INTERVAL_MS = 10;      // 100 Hz
const int MAX_SAMPLES        = 3000;

Adafruit_MPU6050 mpu;

long  ts_arr[MAX_SAMPLES];
float ax_arr[MAX_SAMPLES];
float ay_arr[MAX_SAMPLES];
float az_arr[MAX_SAMPLES];
int   sampleCount = 0;

// ── LED helpers ──
void ledReady()   { digitalWrite(PIN_LED_GREEN, HIGH); digitalWrite(PIN_LED_RED, LOW); }
void ledCapture() { digitalWrite(PIN_LED_GREEN, LOW);  digitalWrite(PIN_LED_RED, HIGH); }
void ledOff()     { digitalWrite(PIN_LED_GREEN, LOW);  digitalWrite(PIN_LED_RED, LOW); }

void flashGreen(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_LED_GREEN, HIGH); delay(200);
    digitalWrite(PIN_LED_GREEN, LOW);  delay(200);
  }
}

void flashRed(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_LED_RED, HIGH); delay(300);
    digitalWrite(PIN_LED_RED, LOW);  delay(300);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  ledOff();

  Serial.println("\n╔══════════════════════════════╗");
  Serial.println("║  NeuroSense Wearable Node    ║");
  Serial.println("╚══════════════════════════════╝");

  // Init MPU6050
  if (!mpu.begin()) {
    Serial.println("MPU6050 NOT found — check wiring!");
    while (1) { flashRed(1); delay(500); }
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 OK");

  // Connect to WiFi
  Serial.printf("WiFi: %s ...", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500); Serial.print(".");
    digitalWrite(PIN_LED_GREEN, !digitalRead(PIN_LED_GREEN)); // blink while connecting
    tries++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi FAILED!");
    while (1) { flashRed(3); delay(2000); }
  }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  ledReady();
  Serial.printf("Ready. Mode: %s | Press button to start capture.\n", CAPTURE_MODE);
}

void loop() {
  // Wait for button press (LOW when pressed, due to INPUT_PULLUP)
  if (digitalRead(PIN_BUTTON) == LOW) {
    delay(50); // debounce
    if (digitalRead(PIN_BUTTON) == LOW) {
      runCapture();
    }
  }
}

void runCapture() {
  int duration = strcmp(CAPTURE_MODE, "tremor") == 0 ? TREMOR_DURATION_MS : GAIT_DURATION_MS;
  sampleCount = 0;

  Serial.printf("Starting %s capture (%ds)...\n", CAPTURE_MODE, duration / 1000);
  ledCapture();

  long startMs = millis();
  long lastBlink = 0;
  bool redState = true;

  while ((int)(millis() - startMs) < duration && sampleCount < MAX_SAMPLES) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    ts_arr[sampleCount] = millis() - startMs;
    ax_arr[sampleCount] = a.acceleration.x;
    ay_arr[sampleCount] = a.acceleration.y;
    az_arr[sampleCount] = a.acceleration.z;
    sampleCount++;

    // Blink red LED during capture
    if (millis() - lastBlink > 500) {
      redState = !redState;
      digitalWrite(PIN_LED_RED, redState);
      lastBlink = millis();
    }

    delay(SAMPLE_INTERVAL_MS);
  }

  Serial.printf("Captured %d samples. Sending...\n", sampleCount);
  ledOff();

  bool success = sendData();

  if (success) {
    Serial.println("Sent successfully!");
    flashGreen(3);
  } else {
    Serial.println("Send failed.");
    flashRed(3);
  }

  ledReady();
  Serial.println("Ready. Press button for next capture.");
}

bool sendData() {
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/sensor/ingest";

  // Build JSON payload
  String json = "{\"mode\":\"";
  json += CAPTURE_MODE;
  json += "\",\"patientId\":";
  json += PATIENT_ID;
  json += ",\"timestamps\":[";
  for (int i = 0; i < sampleCount; i++) {
    json += ts_arr[i];
    if (i < sampleCount - 1) json += ",";
  }
  json += "],\"ax\":[";
  for (int i = 0; i < sampleCount; i++) {
    json += String(ax_arr[i], 3);
    if (i < sampleCount - 1) json += ",";
  }
  json += "],\"ay\":[";
  for (int i = 0; i < sampleCount; i++) {
    json += String(ay_arr[i], 3);
    if (i < sampleCount - 1) json += ",";
  }
  json += "],\"az\":[";
  for (int i = 0; i < sampleCount; i++) {
    json += String(az_arr[i], 3);
    if (i < sampleCount - 1) json += ",";
  }
  json += "]}";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(20000);
  int code = http.POST(json);
  String resp = http.getString();
  http.end();

  Serial.printf("HTTP %d: %s\n", code, resp.c_str());
  return (code == 200);
}

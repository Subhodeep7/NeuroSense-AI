/**
 * NeuroSense-AI — ESP32 Wearable Wrist Sensor Node (Rest Tremor)
 * ─────────────────────────────────────────────────────
 * Hardware:
 *   - ESP32 (any variant — WROOM, S2, S3)
 *   - MPU6050 (I2C: SDA→GPIO 21, SCL→GPIO 22)
 *   - Push Button (GPIO 0, pulled HIGH — press to start)
 *   - Green LED  (GPIO 2  — built-in on most ESP32 boards)
 *   - Red LED    (GPIO 4  — external)
 *   - LiPo Battery via TP4056 charging module (optional)
 *
 * This device handles REST TREMOR only.
 * Gait analysis is done via phone sensor or video upload — no wearable needed.
 *
 * Operation:
 *   1. Power on → connects to WiFi automatically
 *   2. Solid GREEN = ready
 *   3. Press button → RED blinks = capturing 15s
 *   4. Capture ends → data POSTs to backend
 *   5. GREEN flashes 3× = success | RED solid 3s = error
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
const char* WIFI_SSID     = "Neurosense";      // ← your hotspot name
const char* WIFI_PASSWORD = "wqyl2463";         // ← your password
const char* BACKEND_HOST  = "10.83.97.222";     // ← your PC's current IP


// Your PC's local IP address (run `ipconfig` in Windows CMD)
// ESP32 and PC must be on the same WiFi network

const int   BACKEND_PORT  = 8080;

// Patient ID — set this before strapping on the device
const int   PATIENT_ID    = 1;

// Mode: TREMOR ONLY — gait uses phone sensor/video, not this wearable
const char* CAPTURE_MODE  = "tremor";
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

  // Connect to WiFi — disconnect first to clear stale state (fixes hotspot failures)
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("WiFi: connecting to %s ...", WIFI_SSID);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 60) {  // 30s max
    delay(500); Serial.print(".");
    digitalWrite(PIN_LED_GREEN, !digitalRead(PIN_LED_GREEN));
    tries++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[ERROR] WiFi FAILED — check SSID, password, and 2.4GHz band!");
    while (1) { flashRed(3); delay(2000); }
  }
  Serial.printf("\n[OK] Connected. IP: %s\n", WiFi.localIP().toString().c_str());

  // Ping backend to verify connectivity before any capture
  HTTPClient ping;
  ping.begin(String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/sensor/ping");
  int pingCode = ping.GET();
  ping.end();
  if (pingCode == 200) {
    Serial.println("[OK] Backend reachable.");
  } else {
    Serial.printf("[WARN] Backend ping returned %d — check BACKEND_HOST IP!\n", pingCode);
  }

  ledReady();
  Serial.printf("Ready. Mode: %s | Press button to start capture.\n", CAPTURE_MODE);

  // Guard: warn if accidentally set to gait (not supported via wearable)
  if (strcmp(CAPTURE_MODE, "tremor") != 0) {
    Serial.println("[WARN] Only 'tremor' mode is supported. Gait uses phone/video.");
  }
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

  // ── Compute features on-device ────────────────────────────────────────────
  // Sending raw 3000-sample arrays (~85KB) crashes the ESP32 heap.
  // Instead we compute summary statistics (ML models use these, not raw arrays).

  float sum_ax=0, sum_ay=0, sum_az=0;
  float sq_ax=0,  sq_ay=0,  sq_az=0;
  float min_ax=ax_arr[0], max_ax=ax_arr[0];
  float min_ay=ay_arr[0], max_ay=ay_arr[0];
  float min_az=az_arr[0], max_az=az_arr[0];

  for (int i = 0; i < sampleCount; i++) {
    sum_ax += ax_arr[i];  sq_ax += ax_arr[i]*ax_arr[i];
    sum_ay += ay_arr[i];  sq_ay += ay_arr[i]*ay_arr[i];
    sum_az += az_arr[i];  sq_az += az_arr[i]*az_arr[i];
    if (ax_arr[i] < min_ax) min_ax = ax_arr[i]; if (ax_arr[i] > max_ax) max_ax = ax_arr[i];
    if (ay_arr[i] < min_ay) min_ay = ay_arr[i]; if (ay_arr[i] > max_ay) max_ay = ay_arr[i];
    if (az_arr[i] < min_az) min_az = az_arr[i]; if (az_arr[i] > max_az) max_az = az_arr[i];
  }
  float n = (float)sampleCount;
  float mean_ax = sum_ax/n, mean_ay = sum_ay/n, mean_az = sum_az/n;
  float std_ax  = sqrt(sq_ax/n - mean_ax*mean_ax);
  float std_ay  = sqrt(sq_ay/n - mean_ay*mean_ay);
  float std_az  = sqrt(sq_az/n - mean_az*mean_az);
  float rms_ax  = sqrt(sq_ax/n);
  float rms_ay  = sqrt(sq_ay/n);
  float rms_az  = sqrt(sq_az/n);

  float duration_s = (ts_arr[sampleCount-1] - ts_arr[0]) / 1000.0;

  // ── Tremor frequency: zero-crossing on the best axis ──────────────────────
  //
  // BUG (old): counted only POSITIVE crossings of ay.
  //   Problem 1: wrist tremor often oscillates on ax, not ay.
  //              If tremor is on ax but we count ay → step_count ≈ 0 → freq = 0.
  //   Problem 2: only counting positive crossings is correct per-oscillation
  //              (each cycle has 1 up-crossing) BUT only if the right axis is used.
  //
  // FIX: Use the axis with the highest STD (most dynamic range = most likely
  //      to carry the tremor signal). Count BOTH up and down crossings, then
  //      divide by 2 to get oscillation count.
  //
  //   f_tremor = (all_crossings / 2) / duration_s
  //   cadence  = f_tremor × 60   (keeps backend Zone logic unchanged)

  // Step 1: pick the axis most likely to carry tremor
  float*  best_arr  = ay_arr;
  float   best_mean = mean_ay;
  float   best_std  = std_ay;
  if (std_ax >= std_ay && std_ax >= std_az) { best_arr = ax_arr; best_mean = mean_ax; best_std = std_ax; }
  else if (std_az >  std_ay)                { best_arr = az_arr; best_mean = mean_az; best_std = std_az; }

  // Step 2: Hysteresis deadband crossing counter
  //
  // deadband = max(0.05 m/s², best_std × 0.30)   (0.30 tighter than previous 0.25)
  //
  //   Noise  (std=0.042): deadband=0.050 > std → armed state rarely reached → freq≈0 ✓
  //   Tremor (std=0.350): deadband=0.105 → peak ≈ ±0.50 clears band freely → 5 Hz  ✓

  float deadband = fmaxf(0.05f, best_std * 0.30f);

  bool  state_high = false;
  bool  armed      = false;
  int   crossings  = 0;

  for (int i = 0; i < sampleCount; i++) {
    float dev = best_arr[i] - best_mean;
    if (!armed) {
      if (dev >  deadband) { state_high = true;  armed = true; }
      if (dev < -deadband) { state_high = false; armed = true; }
      continue;
    }
    if (state_high  && dev < -deadband) { crossings++; state_high = false; }
    else if (!state_high && dev >  deadband) { crossings++; state_high = true;  }
  }

  // Each complete oscillation = 2 crossings
  int   steps   = crossings / 2;
  float cadence = (duration_s > 0) ? (steps / duration_s * 60.0f) : 0.0f;

  // Guard 1: minimum oscillation count.
  // < 8 steps over 15s → < 0.53 Hz → not a tremor; treat as rest.
  // Prevents single random excursion from being counted as low-frequency tremor.
  if (steps < 8) {
    Serial.printf("[FreqDebug] steps=%d < 8 minimum — zeroing cadence (insufficient oscillations)\n", steps);
    steps   = 0;
    cadence = 0.0f;
  }

  // Guard 2: 8 Hz sanity clamp.
  // PD resting tremor max = 6 Hz.  ET max = 8 Hz.
  // Anything above 480 spm (8 Hz) is external vibration / ADC jitter, not tremor.
  if (cadence > 480.0f) {
    Serial.printf("[FreqDebug] cadence=%.1f spm (>480 = >8Hz) — vibration artifact, zeroing\n", cadence);
    cadence = 0.0f;
    steps   = 0;
  }

  Serial.printf("[FreqDebug] std=%.4f  deadband=%.4f  crossings=%d  steps=%d  cadence=%.1f spm  freq=%.2f Hz\n",
                best_std, deadband, crossings, steps, cadence, cadence / 60.0f);


  // ── Build compact features JSON (~300 bytes, safe for ESP32 heap) ─────────
  char json[512];
  snprintf(json, sizeof(json),
    "{\"mode\":\"%s\",\"patientId\":%d,"
    "\"sample_count\":%d,\"duration_ms\":%ld,"
    "\"mean_ax\":%.3f,\"mean_ay\":%.3f,\"mean_az\":%.3f,"
    "\"std_ax\":%.3f,\"std_ay\":%.3f,\"std_az\":%.3f,"
    "\"rms_ax\":%.3f,\"rms_ay\":%.3f,\"rms_az\":%.3f,"
    "\"min_ax\":%.3f,\"max_ax\":%.3f,"
    "\"min_ay\":%.3f,\"max_ay\":%.3f,"
    "\"min_az\":%.3f,\"max_az\":%.3f,"
    "\"step_count\":%d,\"cadence_spm\":%.1f}",
    CAPTURE_MODE, PATIENT_ID,
    sampleCount, ts_arr[sampleCount-1] - ts_arr[0],
    mean_ax, mean_ay, mean_az,
    std_ax,  std_ay,  std_az,
    rms_ax,  rms_ay,  rms_az,
    min_ax, max_ax, min_ay, max_ay, min_az, max_az,
    steps, cadence
  );

  Serial.printf("[DEBUG] Payload (%d bytes): %s\n", strlen(json), json);

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(20000);
  int code = http.POST(json);
  String resp = http.getString();
  http.end();

  Serial.printf("[HTTP] %d: %s\n", code, resp.c_str());
  return (code == 200);
}

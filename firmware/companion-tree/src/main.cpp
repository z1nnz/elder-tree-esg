#include <Adafruit_SHT31.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <BH1750.h>
#include <FastLED.h>
#include <PubSubClient.h>
#include <RTClib.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiProv.h>
#include <Wire.h>

#include "config.h"
#include "device_state.h"
#include "offline_queue.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

namespace {

CRGB leds[config::kLedCount];
TFT_eSPI display;
BH1750 lightSensor;
Adafruit_SHT31 climateSensor;
RTC_DS3231 rtc;
WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);
OfflineEventQueue offlineQueue;
DesiredState desired;
ReportedState reported;

uint32_t lastSensorReadMs = 0;
uint32_t lastShadowReportMs = 0;
uint32_t lastReconnectAttemptMs = 0;
uint32_t eventSequence = 0;
bool showingMessage = false;

String shadowPrefix() {
  return String("$aws/things/") + config::kThingName + "/shadow/name/" +
         config::kShadowName;
}

String isoTimestamp() {
  DateTime now = rtc.now();
  char buffer[25];
  snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02dZ", now.year(),
           now.month(), now.day(), now.hour(), now.minute(), now.second());
  return String(buffer);
}

void drawWrappedText(const String& text, int16_t x, int16_t y, int16_t width,
                     uint8_t font, uint16_t color) {
  display.setTextFont(font);
  display.setTextColor(color, TFT_WHITE);
  display.setCursor(x, y);
  const int charsPerLine = max(8, width / (font == 4 ? 18 : 12));
  for (int index = 0; index < text.length(); index += charsPerLine) {
    display.println(text.substring(index, min(index + charsPerLine,
                                              static_cast<int>(text.length()))));
  }
}

void renderScreen() {
  display.fillScreen(TFT_WHITE);
  display.fillRect(0, 0, 320, 54, TFT_DARKGREEN);
  display.setTextColor(TFT_WHITE, TFT_DARKGREEN);
  display.setTextFont(4);
  display.drawString("GREEN COMPANION", 14, 15);

  display.setTextColor(TFT_DARKGREY, TFT_WHITE);
  display.setTextFont(2);
  display.drawString(reported.online ? "ONLINE" : "OFFLINE", 238, 20);

  if (showingMessage && !desired.messagePreview.isEmpty()) {
    display.setTextColor(TFT_DARKGREEN, TFT_WHITE);
    display.setTextFont(4);
    display.drawString("FAMILY MESSAGE", 16, 78);
    drawWrappedText(desired.messagePreview, 16, 124, 288, 4, TFT_BLACK);
  } else {
    display.setTextColor(TFT_DARKGREEN, TFT_WHITE);
    display.setTextFont(4);
    display.drawString(treeStageName(desired.treeStage), 16, 78);
    display.setTextColor(TFT_BLACK, TFT_WHITE);
    display.drawString(String(desired.growthPoints) + " growth", 16, 118);
    display.drawFastHLine(16, 157, 288, TFT_LIGHTGREY);
    display.setTextFont(2);
    display.setTextColor(TFT_DARKGREY, TFT_WHITE);
    display.drawString("TODAY", 16, 179);
    drawWrappedText(
        desired.activeTaskTitle.isEmpty() ? "No active task"
                                          : desired.activeTaskTitle,
        16, 207, 288, 4, TFT_BLACK);
  }

  display.fillRect(0, 420, 320, 60, TFT_LIGHTGREY);
  display.setTextColor(TFT_BLACK, TFT_LIGHTGREY);
  display.setTextFont(2);
  display.drawString("TASK", 20, 442);
  display.drawString("FAMILY", 127, 442);
  display.drawString("CONFIRM", 232, 442);
}

void applyLedScene() {
  FastLED.setBrightness(map(desired.brightness, 5, 100, 12, 200));
  CRGB color = CRGB(38, 105, 67);
  uint8_t litCount = 6;
  switch (desired.treeStage) {
    case TreeStage::kSeed:
      litCount = 4;
      color = CRGB(244, 201, 93);
      break;
    case TreeStage::kSprout:
      litCount = 10;
      color = CRGB(113, 178, 89);
      break;
    case TreeStage::kSeedling:
      litCount = 17;
      color = CRGB(63, 153, 96);
      break;
    case TreeStage::kYoungTree:
      litCount = 24;
      color = CRGB(32, 125, 78);
      break;
    case TreeStage::kMature:
      litCount = config::kLedCount;
      color = CRGB(185, 219, 104);
      break;
  }
  if (!reported.online) color = CRGB(80, 92, 86);
  if (desired.ledScene == LedScene::kMessage) color = CRGB(239, 117, 95);
  fill_solid(leds, config::kLedCount, CRGB::Black);
  for (uint8_t index = 0; index < litCount; ++index) leds[index] = color;
  FastLED.show();
}

void parseDesiredState(JsonVariantConst state, uint32_t version) {
  if (version > 0 && version <= desired.shadowVersion) return;
  desired.shadowVersion = version;
  desired.activeTaskId = String(state["activeTaskId"] | "");
  desired.activeTaskTitle = String(state["activeTaskTitle"] | "");
  desired.messagePreview = String(state["messagePreview"] | "");
  desired.treeStage = parseTreeStage(String(state["treeStage"] | "SEED"));
  desired.growthPoints = state["growthPoints"] | 0;
  desired.ledScene = parseLedScene(String(state["ledScene"] | "IDLE"));
  desired.brightness = constrain(state["brightness"] | 65, 5, 100);
  desired.commandId = String(state["commandId"] | "");
  reported.acknowledgedCommandId = desired.commandId;
  applyLedScene();
  renderScreen();
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;
  String topicValue(topic);
  if (topicValue.endsWith("/update/delta")) {
    parseDesiredState(doc["state"], doc["version"] | 0);
  } else if (topicValue.endsWith("/get/accepted")) {
    parseDesiredState(doc["state"]["desired"], doc["version"] | 0);
  }
}

bool publishEvent(const QueuedEvent& event) {
  if (!mqtt.connected()) return false;
  JsonDocument doc;
  doc["deviceId"] = config::kDeviceId;
  doc["eventKey"] = event.eventKey;
  doc["eventType"] = event.eventType;
  doc["occurredAt"] = event.occurredAt;
  JsonDocument payload;
  deserializeJson(payload, event.payloadJson);
  doc["payload"] = payload.as<JsonVariant>();
  String output;
  serializeJson(doc, output);
  String topic = String("tree/") + config::kDeviceId + "/events";
  return mqtt.publish(topic.c_str(), output.c_str(), false);
}

void queueOrPublish(const String& eventType) {
  reported.lastInteractionEpoch = rtc.now().unixtime();
  QueuedEvent event{
      String(config::kThingName) + ":" + String(++eventSequence),
      eventType,
      isoTimestamp(),
      String("{\"queueDepth\":") + String(offlineQueue.size()) + "}",
  };
  if (!publishEvent(event)) offlineQueue.enqueue(event);
  reported.queueDepth = offlineQueue.size();
}

void flushOfflineEvents() {
  QueuedEvent event;
  while (mqtt.connected() && offlineQueue.peek(&event)) {
    if (!publishEvent(event)) break;
    offlineQueue.pop();
  }
  reported.queueDepth = offlineQueue.size();
}

void publishReportedState() {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  JsonObject state = doc["state"].to<JsonObject>();
  JsonObject reportedJson = state["reported"].to<JsonObject>();
  reportedJson["online"] = true;
  reportedJson["firmwareVersion"] = config::kFirmwareVersion;
  if (!isnan(reported.ambientLux)) reportedJson["ambientLux"] = reported.ambientLux;
  if (!isnan(reported.temperatureC))
    reportedJson["temperatureC"] = reported.temperatureC;
  if (!isnan(reported.humidityPercent))
    reportedJson["humidityPercent"] = reported.humidityPercent;
  reportedJson["presence"] = reported.presence;
  reportedJson["lastInteractionAt"] = reported.lastInteractionEpoch;
  reportedJson["acknowledgedCommandId"] = reported.acknowledgedCommandId;
  reportedJson["queueDepth"] = offlineQueue.size();
  String output;
  serializeJson(doc, output);
  String topic = shadowPrefix() + "/update";
  mqtt.publish(topic.c_str(), output.c_str(), false);
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  if (millis() - lastReconnectAttemptMs < config::kReconnectIntervalMs) return;
  lastReconnectAttemptMs = millis();
  if (!mqtt.connect(config::kThingName)) {
    reported.online = false;
    applyLedScene();
    return;
  }
  reported.online = true;
  String prefix = shadowPrefix();
  mqtt.subscribe((prefix + "/update/delta").c_str(), 1);
  mqtt.subscribe((prefix + "/get/accepted").c_str(), 1);
  mqtt.publish((prefix + "/get").c_str(), "");
  flushOfflineEvents();
  publishReportedState();
  applyLedScene();
  renderScreen();
}

void readSensors() {
  reported.ambientLux = lightSensor.readLightLevel();
  reported.temperatureC = climateSensor.readTemperature();
  reported.humidityPercent = climateSensor.readHumidity();
  reported.presence = digitalRead(config::kPresencePin) == HIGH;
  const uint8_t autoBrightness =
      constrain(map(static_cast<int>(reported.ambientLux), 0, 600, 20, 100), 20,
                100);
  analogWrite(config::kTftBacklightPin,
              map(autoBrightness, 0, 100, 30, 255));
}

bool buttonPressed(uint8_t pin) {
  static uint32_t lastPress[3] = {0, 0, 0};
  uint8_t index = pin == config::kTaskButtonPin
                      ? 0
                      : pin == config::kFamilyButtonPin ? 1 : 2;
  if (digitalRead(pin) == LOW && millis() - lastPress[index] > 450) {
    lastPress[index] = millis();
    return true;
  }
  return false;
}

void handleButtons() {
  if (buttonPressed(config::kTaskButtonPin)) {
    showingMessage = false;
    queueOrPublish("BUTTON_TASK");
    renderScreen();
  }
  if (buttonPressed(config::kFamilyButtonPin)) {
    showingMessage = true;
    queueOrPublish("BUTTON_FAMILY");
    renderScreen();
  }
  if (buttonPressed(config::kConfirmButtonPin)) {
    queueOrPublish("BUTTON_CONFIRM");
    desired.ledScene = LedScene::kGrowth;
    applyLedScene();
  }
}

void provisioningEvent(arduino_event_t* event) {
  if (event->event_id == ARDUINO_EVENT_PROV_CRED_SUCCESS) {
    Serial.println("BLE provisioning succeeded");
  } else if (event->event_id == ARDUINO_EVENT_PROV_CRED_FAIL) {
    Serial.println("BLE provisioning failed");
  }
}

void startProvisioningIfNeeded() {
  WiFi.mode(WIFI_STA);
  WiFi.onEvent(provisioningEvent);
  if (WiFi.SSID().isEmpty()) {
    String serviceName = String("ElderTree-") + config::kThingName;
    WiFiProv.beginProvision(
        NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM,
        NETWORK_PROV_SECURITY_1, config::kProvisioningPop, serviceName.c_str());
  } else {
    WiFi.begin();
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(config::kTaskButtonPin, INPUT_PULLUP);
  pinMode(config::kFamilyButtonPin, INPUT_PULLUP);
  pinMode(config::kConfirmButtonPin, INPUT_PULLUP);
  pinMode(config::kPresencePin, INPUT);
  pinMode(config::kTftBacklightPin, OUTPUT);

  Wire.begin(config::kI2cSdaPin, config::kI2cSclPin);
  lightSensor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  climateSensor.begin(0x44);
  rtc.begin();
  if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  offlineQueue.begin();

  FastLED.addLeds<WS2812B, config::kLedPin, GRB>(leds, config::kLedCount);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 1400);
  display.init();
  display.setRotation(1);
  analogWrite(config::kTftBacklightPin, 180);
  renderScreen();
  applyLedScene();

  secureClient.setCACert(kRootCa);
  secureClient.setCertificate(kDeviceCertificate);
  secureClient.setPrivateKey(kDevicePrivateKey);
  mqtt.setServer(kAwsIotEndpoint, 8883);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(4096);
  startProvisioningIfNeeded();
}

void loop() {
  connectMqtt();
  mqtt.loop();
  handleButtons();

  if (millis() - lastSensorReadMs >= config::kSensorIntervalMs) {
    lastSensorReadMs = millis();
    readSensors();
  }
  if (millis() - lastShadowReportMs >= config::kShadowReportIntervalMs) {
    lastShadowReportMs = millis();
    publishReportedState();
  }
  delay(10);
}

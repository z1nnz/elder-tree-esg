#pragma once

#include <Arduino.h>

namespace config {

constexpr char kFirmwareVersion[] = "0.1.0";
constexpr char kDeviceId[] = "44444444-4444-4444-8444-444444444444";
constexpr char kThingName[] = "TREE-DEMO-001";
constexpr char kShadowName[] = "companion";
constexpr char kProvisioningPop[] = "246810";

constexpr uint8_t kLedPin = 4;
constexpr uint8_t kLedCount = 30;
constexpr uint8_t kTaskButtonPin = 5;
constexpr uint8_t kFamilyButtonPin = 6;
constexpr uint8_t kConfirmButtonPin = 7;
constexpr uint8_t kPresencePin = 15;
constexpr uint8_t kTftBacklightPin = 8;
constexpr uint8_t kI2cSdaPin = 1;
constexpr uint8_t kI2cSclPin = 2;

constexpr uint32_t kSensorIntervalMs = 30000;
constexpr uint32_t kShadowReportIntervalMs = 60000;
constexpr uint32_t kReconnectIntervalMs = 5000;
constexpr size_t kMaxOfflineEvents = 100;

}  // namespace config

#pragma once

#include <Arduino.h>

enum class TreeStage {
  kSeed,
  kSprout,
  kSeedling,
  kYoungTree,
  kMature,
};

enum class LedScene {
  kIdle,
  kTaskDue,
  kMessage,
  kGrowth,
  kMature,
  kOffline,
  kError,
};

struct DesiredState {
  String activeTaskId;
  String activeTaskTitle;
  String messagePreview;
  TreeStage treeStage = TreeStage::kSeed;
  LedScene ledScene = LedScene::kIdle;
  uint32_t growthPoints = 0;
  uint8_t brightness = 65;
  String commandId;
  uint32_t shadowVersion = 0;
};

struct ReportedState {
  bool online = false;
  float ambientLux = NAN;
  float temperatureC = NAN;
  float humidityPercent = NAN;
  bool presence = false;
  uint16_t queueDepth = 0;
  String acknowledgedCommandId;
  uint32_t lastInteractionEpoch = 0;
};

const char* treeStageName(TreeStage stage);
const char* ledSceneName(LedScene scene);
TreeStage parseTreeStage(const String& value);
LedScene parseLedScene(const String& value);

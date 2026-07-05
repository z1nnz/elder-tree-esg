#include "device_state.h"

const char* treeStageName(TreeStage stage) {
  switch (stage) {
    case TreeStage::kSeed:
      return "SEED";
    case TreeStage::kSprout:
      return "SPROUT";
    case TreeStage::kSeedling:
      return "SEEDLING";
    case TreeStage::kYoungTree:
      return "YOUNG_TREE";
    case TreeStage::kMature:
      return "MATURE";
  }
  return "SEED";
}

const char* ledSceneName(LedScene scene) {
  switch (scene) {
    case LedScene::kIdle:
      return "IDLE";
    case LedScene::kTaskDue:
      return "TASK_DUE";
    case LedScene::kMessage:
      return "MESSAGE";
    case LedScene::kGrowth:
      return "GROWTH";
    case LedScene::kMature:
      return "MATURE";
    case LedScene::kOffline:
      return "OFFLINE";
    case LedScene::kError:
      return "ERROR";
  }
  return "IDLE";
}

TreeStage parseTreeStage(const String& value) {
  if (value == "SPROUT") return TreeStage::kSprout;
  if (value == "SEEDLING") return TreeStage::kSeedling;
  if (value == "YOUNG_TREE") return TreeStage::kYoungTree;
  if (value == "MATURE") return TreeStage::kMature;
  return TreeStage::kSeed;
}

LedScene parseLedScene(const String& value) {
  if (value == "TASK_DUE") return LedScene::kTaskDue;
  if (value == "MESSAGE") return LedScene::kMessage;
  if (value == "GROWTH") return LedScene::kGrowth;
  if (value == "MATURE") return LedScene::kMature;
  if (value == "OFFLINE") return LedScene::kOffline;
  if (value == "ERROR") return LedScene::kError;
  return LedScene::kIdle;
}

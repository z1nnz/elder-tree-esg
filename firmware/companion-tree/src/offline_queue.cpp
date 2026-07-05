#include "offline_queue.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include "config.h"

namespace {
constexpr char kQueuePath[] = "/event-queue.jsonl";
}

bool OfflineEventQueue::begin() {
  if (!LittleFS.begin(true)) return false;
  return load();
}

bool OfflineEventQueue::enqueue(const QueuedEvent& event) {
  if (events_.size() >= config::kMaxOfflineEvents) {
    events_.pop_front();
  }
  events_.push_back(event);
  return persist();
}

bool OfflineEventQueue::peek(QueuedEvent* event) const {
  if (events_.empty() || event == nullptr) return false;
  *event = events_.front();
  return true;
}

bool OfflineEventQueue::pop() {
  if (events_.empty()) return false;
  events_.pop_front();
  return persist();
}

size_t OfflineEventQueue::size() const { return events_.size(); }

bool OfflineEventQueue::load() {
  events_.clear();
  if (!LittleFS.exists(kQueuePath)) return true;
  File file = LittleFS.open(kQueuePath, "r");
  if (!file) return false;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.isEmpty()) continue;
    JsonDocument doc;
    if (deserializeJson(doc, line)) continue;
    QueuedEvent event{
        String(doc["eventKey"] | ""),
        String(doc["eventType"] | ""),
        String(doc["occurredAt"] | ""),
        String(doc["payload"] | "{}"),
    };
    if (!event.eventKey.isEmpty()) events_.push_back(event);
  }
  file.close();
  while (events_.size() > config::kMaxOfflineEvents) events_.pop_front();
  return true;
}

bool OfflineEventQueue::persist() const {
  File file = LittleFS.open(kQueuePath, "w");
  if (!file) return false;
  for (const auto& event : events_) {
    JsonDocument doc;
    doc["eventKey"] = event.eventKey;
    doc["eventType"] = event.eventType;
    doc["occurredAt"] = event.occurredAt;
    doc["payload"] = event.payloadJson;
    serializeJson(doc, file);
    file.print('\n');
  }
  file.close();
  return true;
}

#pragma once

#include <Arduino.h>
#include <deque>

struct QueuedEvent {
  String eventKey;
  String eventType;
  String occurredAt;
  String payloadJson;
};

class OfflineEventQueue {
 public:
  bool begin();
  bool enqueue(const QueuedEvent& event);
  bool peek(QueuedEvent* event) const;
  bool pop();
  size_t size() const;

 private:
  bool load();
  bool persist() const;
  std::deque<QueuedEvent> events_;
};

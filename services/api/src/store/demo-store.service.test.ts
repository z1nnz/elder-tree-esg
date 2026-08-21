import { describe, expect, it } from "vitest";
import { DemoStoreService } from "./demo-store.service";

describe("DemoStoreService", () => {
  it("awards growth exactly once for an idempotent completion", () => {
    const store = new DemoStoreService();
    const before = store.getTree().growthPoints;
    const taskId = "22222222-2222-4222-8222-222222222222";

    store.completeTask(taskId, "completion-123");
    store.completeTask(taskId, "completion-123");

    expect(store.getTree().growthPoints).toBe(before + 30);
  });

  it("sends family messages into the desired device state", () => {
    const store = new DemoStoreService();
    const message = store.createMessage("晚上記得看看月亮。");
    const state = store.getDeviceState("44444444-4444-4444-8444-444444444444");

    expect(message.deliveredToDeviceAt).not.toBeNull();
    expect(state.desired.messagePreview).toBe(message.body);
    expect(state.desired.ledScene).toBe("MESSAGE");
  });

  it("deduplicates device events", () => {
    const store = new DemoStoreService();
    const deviceId = "44444444-4444-4444-8444-444444444444";
    const event = {
      eventKey: "TREE-DEMO-001:42",
      eventType: "BUTTON_CONFIRM",
      occurredAt: new Date().toISOString(),
      payload: {},
    };

    expect(store.ingestDeviceEvent(deviceId, event).duplicate).toBe(false);
    expect(store.ingestDeviceEvent(deviceId, event).duplicate).toBe(true);
  });

  it("never creates a real impact batch in demo mode", () => {
    const store = new DemoStoreService();
    expect(() => store.createBatch("Real batch", 1000, false as true)).toThrow();
  });

  it("completes the relay with a third member and awards growth once", () => {
    const store = new DemoStoreService();
    const before = store.getTree().growthPoints;
    const chapterId = "66666666-6666-4666-8666-000000000003";

    const completed = store.completeCooperativeActionChapter(
      chapterId,
      "demo-elder",
      "relay-completion-123",
    );
    store.completeCooperativeActionChapter(
      chapterId,
      "demo-elder",
      "relay-completion-123",
    );

    expect(completed.activeAction?.status).toBe("COMPLETED");
    expect(completed.activeAction?.contributorCount).toBe(3);
    expect(store.getTree().growthPoints).toBe(before + 120);
  });

  it("requires a different member for each relay chapter", () => {
    const store = new DemoStoreService();
    expect(() =>
      store.completeCooperativeActionChapter(
        "66666666-6666-4666-8666-000000000003",
        "demo-daughter",
        "relay-completion-456",
      ),
    ).toThrow("Each member can complete only one chapter");
  });
});

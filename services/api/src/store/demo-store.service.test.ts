import { describe, expect, it } from "vitest";
import type { ClockService } from "../time/clock.service";
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

    store.claimCooperativeActionChapter(
      "77777777-7777-4777-8777-777777777777",
      chapterId,
      "demo-elder",
      true,
    );

    const completed = store.completeCooperativeActionChapter(
      "77777777-7777-4777-8777-777777777777",
      chapterId,
      "demo-elder",
      "relay-completion-123",
    );
    store.completeCooperativeActionChapter(
      "77777777-7777-4777-8777-777777777777",
      chapterId,
      "demo-elder",
      "relay-completion-123",
    );

    expect(completed.activeAction?.status).toBe("COMPLETED");
    expect(completed.activeAction?.contributorCount).toBe(3);
    expect(completed.activeAction?.chapters[2]?.contributor).toMatchObject({
      actionTitle: "在室內找一片綠",
      usedAlternative: true,
    });
    expect(store.getTree().growthPoints).toBe(before + 120);
  });

  it("requires the current relay chapter to be claimed before completion", () => {
    const store = new DemoStoreService();

    expect(() =>
      store.completeCooperativeActionChapter(
        "77777777-7777-4777-8777-777777777777",
        "66666666-6666-4666-8666-000000000003",
        "demo-elder",
        "relay-unclaimed-completion",
      ),
    ).toThrow("Claim the relay chapter before completing it");
  });

  it("requires a different member for each relay chapter", () => {
    const store = new DemoStoreService();
    expect(() =>
      store.claimCooperativeActionChapter(
        "77777777-7777-4777-8777-777777777777",
        "66666666-6666-4666-8666-000000000003",
        "demo-daughter",
      ),
    ).toThrow("Each member can complete only one chapter");
  });

  it("lets the current claimant hand the relay chapter to an eligible member", () => {
    const store = new DemoStoreService();
    const runId = "77777777-7777-4777-8777-777777777777";
    const chapterId = "66666666-6666-4666-8666-000000000003";
    store.claimCooperativeActionChapter(runId, chapterId, "demo-elder");

    const handedOff = store.handoffCooperativeActionChapter(
      runId,
      chapterId,
      "demo-elder",
      "demo-friend",
    );

    expect(handedOff.activeAction?.chapters[2]?.claim?.memberId).toBe(
      "demo-friend",
    );
  });

  it("releases a relay claim only after its time limit has passed", () => {
    let now = new Date("2026-08-22T01:00:00.000Z");
    const store = new DemoStoreService({ now: () => now } as ClockService);
    const runId = "77777777-7777-4777-8777-777777777777";
    const chapterId = "66666666-6666-4666-8666-000000000003";
    store.claimCooperativeActionChapter(runId, chapterId, "demo-elder");

    expect(() =>
      store.releaseExpiredCooperativeActionClaim(
        runId,
        chapterId,
        "demo-elder",
      ),
    ).toThrow("Relay claim has not expired");

    now = new Date("2026-08-22T01:31:00.000Z");
    expect(() =>
      store.claimCooperativeActionChapter(runId, chapterId, "demo-friend"),
    ).toThrow("Expired relay claim must be released");
    expect(() =>
      store.releaseExpiredCooperativeActionClaim(
        runId,
        chapterId,
        "not-a-circle-member",
      ),
    ).toThrow("Circle member not found");
    const released = store.releaseExpiredCooperativeActionClaim(
      runId,
      chapterId,
      "demo-elder",
    );
    expect(released.activeAction?.chapters[2]?.claim).toBeNull();
  });
});

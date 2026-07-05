import { describe, expect, it } from "vitest";
import {
  deviceDesiredStateSchema,
  deviceReportedStateSchema,
  verificationResultSchema,
} from "./index";

describe("shared contracts", () => {
  it("accepts a valid desired state", () => {
    expect(
      deviceDesiredStateSchema.parse({
        activeTaskId: null,
        activeTaskTitle: null,
        messagePreview: "今天過得好嗎？",
        treeStage: "SPROUT",
        growthPoints: 120,
        ledScene: "MESSAGE",
        brightness: 65,
        firmwareTarget: null,
        commandId: null,
        updatedAt: new Date().toISOString(),
      }).treeStage,
    ).toBe("SPROUT");
  });

  it("rejects unsafe brightness values", () => {
    expect(() =>
      deviceDesiredStateSchema.parse({
        activeTaskId: null,
        activeTaskTitle: null,
        messagePreview: null,
        treeStage: "SEED",
        growthPoints: 0,
        ledScene: "IDLE",
        brightness: 101,
        firmwareTarget: null,
        commandId: null,
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("validates reported state and AI result", () => {
    expect(
      deviceReportedStateSchema.parse({
        online: true,
        firmwareVersion: "0.1.0",
        ambientLux: 120,
        temperatureC: 25.4,
        humidityPercent: 61,
        presence: true,
        lastInteractionAt: null,
        acknowledgedCommandId: null,
        queueDepth: 0,
        updatedAt: new Date().toISOString(),
      }).online,
    ).toBe(true);

    expect(
      verificationResultSchema.parse({
        decision: "REVIEW",
        confidence: 0.7,
        labels: ["plant"],
        reasonCodes: ["LOW_CONFIDENCE"],
        explanation: "畫面可能包含植物，需要人工確認。",
        model: "demo-rules",
        ruleVersion: "1.0.0",
      }).decision,
    ).toBe("REVIEW");
  });
});

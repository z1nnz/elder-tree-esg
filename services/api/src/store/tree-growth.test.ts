import { describe, expect, it } from "vitest";
import { nextStageAt, stageForPoints } from "./tree-growth";

describe("tree growth thresholds", () => {
  it.each([
    [0, "SEED", 100],
    [100, "SPROUT", 250],
    [250, "SEEDLING", 500],
    [500, "YOUNG_TREE", 1000],
    [1000, "MATURE", null],
  ] as const)(
    "maps %s points to %s with the next threshold at %s",
    (points, stage, nextThreshold) => {
      expect(stageForPoints(points)).toBe(stage);
      expect(nextStageAt(points)).toBe(nextThreshold);
    },
  );
});

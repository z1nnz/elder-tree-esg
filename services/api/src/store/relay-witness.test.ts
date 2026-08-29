import { describe, expect, it } from "vitest";
import { evaluateRelayTimerWitness } from "./relay-witness";

describe("relay timer witness", () => {
  it("rejects an early completion without rounding away the final second", () => {
    expect(() =>
      evaluateRelayTimerWitness({
        startedAt: new Date("2026-08-29T08:01:00.000Z"),
        completedAt: new Date("2026-08-29T08:03:59.999Z"),
        minimumSeconds: 180,
      }),
    ).toThrow("1 more seconds");
  });

  it("accepts the exact boundary and records whole elapsed seconds", () => {
    expect(
      evaluateRelayTimerWitness({
        startedAt: new Date("2026-08-29T08:01:00.000Z"),
        completedAt: new Date("2026-08-29T08:04:00.000Z"),
        minimumSeconds: 180,
      }),
    ).toEqual({ elapsedSeconds: 180 });
  });

  it.each([0, -1, 1.5])(
    "rejects an invalid duration of %s seconds",
    (minimumSeconds) => {
      expect(() =>
        evaluateRelayTimerWitness({
          startedAt: new Date("2026-08-29T08:01:00.000Z"),
          completedAt: new Date("2026-08-29T08:04:00.000Z"),
          minimumSeconds,
        }),
      ).toThrow("positive whole duration");
    },
  );
});

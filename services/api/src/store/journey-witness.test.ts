import { describe, expect, it } from "vitest";
import { advanceJourneyWitness } from "./journey-witness";

const requirements = {
  minimumDwellSeconds: 120,
  minimumStepCount: 150,
  minimumDistanceMeters: 200,
};

describe("journey witness", () => {
  it("counts only consecutive in-area samples and completes at all three boundaries", () => {
    const first = advanceJourneyWitness({
      current: { dwellSeconds: 0, stepCount: 0, distanceMeters: 0 },
      requirements,
      previousInside: false,
      currentInside: true,
      elapsedSeconds: 0,
      acceptedDistanceMeters: 0,
      previousStepTotal: null,
      currentStepTotal: 10,
    });
    expect(first).toEqual({
      progress: { dwellSeconds: 0, stepCount: 0, distanceMeters: 0 },
      completed: false,
    });

    const second = advanceJourneyWitness({
      current: first.progress,
      requirements,
      previousInside: true,
      currentInside: true,
      elapsedSeconds: 60,
      acceptedDistanceMeters: 100,
      previousStepTotal: 10,
      currentStepTotal: 85,
    });
    expect(second).toEqual({
      progress: { dwellSeconds: 60, stepCount: 75, distanceMeters: 100 },
      completed: false,
    });

    const completed = advanceJourneyWitness({
      current: second.progress,
      requirements,
      previousInside: true,
      currentInside: true,
      elapsedSeconds: 60,
      acceptedDistanceMeters: 100,
      previousStepTotal: 85,
      currentStepTotal: 160,
    });
    expect(completed).toEqual({
      progress: { dwellSeconds: 120, stepCount: 150, distanceMeters: 200 },
      completed: true,
    });
  });

  it("rejects a step total that moves backwards", () => {
    expect(() =>
      advanceJourneyWitness({
        current: { dwellSeconds: 60, stepCount: 70, distanceMeters: 100 },
        requirements,
        previousInside: true,
        currentInside: true,
        elapsedSeconds: 30,
        acceptedDistanceMeters: 30,
        previousStepTotal: 100,
        currentStepTotal: 90,
      }),
    ).toThrow("cannot move backwards");
  });

  it("rejects a step increase beyond a plausible walking cadence", () => {
    expect(() =>
      advanceJourneyWitness({
        current: { dwellSeconds: 0, stepCount: 0, distanceMeters: 0 },
        requirements,
        previousInside: true,
        currentInside: true,
        elapsedSeconds: 10,
        acceptedDistanceMeters: 20,
        previousStepTotal: 100,
        currentStepTotal: 200,
      }),
    ).toThrow("step increase is too fast");
  });

  it.each([
    { label: "current sample is outside", previousInside: true, currentInside: false, elapsedSeconds: 60 },
    { label: "previous sample was outside", previousInside: false, currentInside: true, elapsedSeconds: 60 },
    { label: "sample gap exceeds two minutes", previousInside: true, currentInside: true, elapsedSeconds: 121 },
  ])("does not count when $label", (sample) => {
    expect(
      advanceJourneyWitness({
        current: { dwellSeconds: 20, stepCount: 25, distanceMeters: 30 },
        requirements,
        previousInside: sample.previousInside,
        currentInside: sample.currentInside,
        elapsedSeconds: sample.elapsedSeconds,
        acceptedDistanceMeters: 100,
        previousStepTotal: 10,
        currentStepTotal: 80,
      }),
    ).toEqual({
      progress: { dwellSeconds: 20, stepCount: 25, distanceMeters: 30 },
      completed: false,
    });
  });
});

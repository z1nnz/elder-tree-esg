export interface JourneyWitnessProgress {
  dwellSeconds: number;
  stepCount: number;
  distanceMeters: number;
}

export interface JourneyWitnessRequirements {
  minimumDwellSeconds: number;
  minimumStepCount: number;
  minimumDistanceMeters: number;
}

export interface JourneyWitnessSample {
  current: JourneyWitnessProgress;
  requirements: JourneyWitnessRequirements;
  previousInside: boolean;
  currentInside: boolean;
  elapsedSeconds: number;
  acceptedDistanceMeters: number;
  previousStepTotal: number | null;
  currentStepTotal: number | null;
}

export interface JourneyWitnessAdvanceResult {
  progress: JourneyWitnessProgress;
  completed: boolean;
}

export function advanceJourneyWitness(
  sample: JourneyWitnessSample,
): JourneyWitnessAdvanceResult {
  if (
    sample.previousStepTotal !== null &&
    sample.currentStepTotal !== null &&
    sample.currentStepTotal < sample.previousStepTotal
  ) {
    throw new Error("Journey witness step total cannot move backwards");
  }
  if (
    sample.elapsedSeconds > 0 &&
    sample.previousStepTotal !== null &&
    sample.currentStepTotal !== null &&
    sample.currentStepTotal - sample.previousStepTotal >
      Math.floor(sample.elapsedSeconds * 5) + 10
  ) {
    throw new Error("Journey witness step increase is too fast");
  }
  const canCountInterval =
    sample.previousInside &&
    sample.currentInside &&
    sample.elapsedSeconds > 0 &&
    sample.elapsedSeconds <= 120;
  const stepDelta =
    canCountInterval &&
    sample.previousStepTotal !== null &&
    sample.currentStepTotal !== null
      ? Math.max(0, sample.currentStepTotal - sample.previousStepTotal)
      : 0;
  const progress = canCountInterval
    ? {
        dwellSeconds:
          sample.current.dwellSeconds + Math.floor(sample.elapsedSeconds),
        stepCount: sample.current.stepCount + stepDelta,
        distanceMeters:
          sample.current.distanceMeters + sample.acceptedDistanceMeters,
      }
    : { ...sample.current };
  return {
    progress,
    completed:
      progress.dwellSeconds >= sample.requirements.minimumDwellSeconds &&
      progress.stepCount >= sample.requirements.minimumStepCount &&
      progress.distanceMeters >= sample.requirements.minimumDistanceMeters,
  };
}

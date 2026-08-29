export interface RelayTimerWitnessInput {
  startedAt: Date;
  completedAt: Date;
  minimumSeconds: number;
}

export interface RelayTimerWitnessResult {
  elapsedSeconds: number;
}

export function evaluateRelayTimerWitness(
  input: RelayTimerWitnessInput,
): RelayTimerWitnessResult {
  if (!Number.isInteger(input.minimumSeconds) || input.minimumSeconds <= 0) {
    throw new Error("Relay timer witness requires a positive whole duration");
  }
  if (
    !Number.isFinite(input.startedAt.getTime()) ||
    !Number.isFinite(input.completedAt.getTime())
  ) {
    throw new Error("Relay timer witness requires valid timestamps");
  }
  const elapsedMilliseconds =
    input.completedAt.getTime() - input.startedAt.getTime();
  const requiredMilliseconds = input.minimumSeconds * 1000;
  if (elapsedMilliseconds < requiredMilliseconds) {
    const remainingSeconds = Math.ceil(
      (requiredMilliseconds - elapsedMilliseconds) / 1000,
    );
    throw new Error(
      `Relay timer witness requires ${remainingSeconds} more seconds`,
    );
  }
  return { elapsedSeconds: Math.floor(elapsedMilliseconds / 1000) };
}

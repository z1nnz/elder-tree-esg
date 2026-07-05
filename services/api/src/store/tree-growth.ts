import type { TreeStage } from "@elder-tree/contracts";

export function stageForPoints(points: number): TreeStage {
  if (points >= 1000) return "MATURE";
  if (points >= 500) return "YOUNG_TREE";
  if (points >= 250) return "SEEDLING";
  if (points >= 100) return "SPROUT";
  return "SEED";
}

export function nextStageAt(points: number): number | null {
  if (points < 100) return 100;
  if (points < 250) return 250;
  if (points < 500) return 500;
  if (points < 1000) return 1000;
  return null;
}

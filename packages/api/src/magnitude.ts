import type { MagnitudeCategory } from "@zentryx/db/schema";
export const DEFAULT_WEIGHTS: Record<MagnitudeCategory, number> = {
  attendance: 1,
  post: 1,
  endorsement: 1,
};
export const MIN_WEIGHT = 0.5;
export const MAX_WEIGHT = 2;
export function clampWeight(w: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w));
}
export function computeScore(
  events: { category: MagnitudeCategory; points: number; weight: number }[],
): number {
  const sum = events.reduce((acc, e) => acc + e.points * clampWeight(e.weight), 0);
  return Math.max(0, Math.round(sum));
}

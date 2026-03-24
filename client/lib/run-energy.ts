/** Level-running kcal from mass × distance; mirrors `server/core/run_energy.py`. */

export const KCAL_PER_KG_FAT_THEORY = 7700;

/** ~1 kcal per kg per km on level ground (literature often ~0.9–1.1). */
export const KCAL_PER_KG_KM_RUNNING = 1.0;

export function kcalRunningMassDistance(
  weightKg: number,
  distanceKm: number,
  met: number = KCAL_PER_KG_KM_RUNNING
): number {
  return weightKg * distanceKm * met;
}

export function fatEquivKgFromKcal(kcal: number): number {
  return kcal / KCAL_PER_KG_FAT_THEORY;
}

export function distanceKmFromSpeed(
  speedKmh: number,
  durationSeconds: number
): number {
  return speedKmh * (durationSeconds / 3600);
}

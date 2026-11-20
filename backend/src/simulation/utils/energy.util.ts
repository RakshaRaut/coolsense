export function calculateEnergy(
  powerWatts: number,
  dtSeconds: number,
): number {
  return (powerWatts * dtSeconds) / 3600000;
}
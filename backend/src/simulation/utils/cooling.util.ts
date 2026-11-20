export function calculateCooling(
  compressorState: boolean,
  ratedCapacity: number,
): number {
  return compressorState ? ratedCapacity : 0;
}

export function calculateInverterCooling(
  compressorState: boolean,
  ratedCapacity: number,
  coolingDemand: number,
): number {
  if (!compressorState) {
    return 0;
  }

  const demand = Math.max(0, Math.min(1, coolingDemand));

  return ratedCapacity * demand;
}
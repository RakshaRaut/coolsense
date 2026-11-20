export function calculatePower(
  compressorState: boolean,
  compressorPower: number,
  fanPower: number,
): number {
  return compressorState
    ? compressorPower + fanPower
    : fanPower;
}

export function calculateInverterPower(
  coolingCapacity: number,
  ratedCoolingCapacity: number,
  ratedPowerWatts: number,
  fanPowerWatts: number,
): number {
  if (coolingCapacity <= 0) {
    return fanPowerWatts;
  }

  const coolingRatio = Math.min(
    1,
    coolingCapacity / ratedCoolingCapacity,
  );

  const compressorPower =
    ratedPowerWatts * coolingRatio;

  return compressorPower + fanPowerWatts;
}
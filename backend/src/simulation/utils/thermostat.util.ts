export function updateCompressor(
  roomTemperature: number,
  targetTemperature: number,
  differential: number,
  previousState: boolean,
): boolean {
  if (roomTemperature >= targetTemperature + differential) {
    return true;
  }

  if (roomTemperature <= targetTemperature - differential) {
    return false;
  }

  return previousState;
}
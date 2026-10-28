export type SpecialAction = 'escalate' | 'acknowledge' | null;

/*
IP: station name, manufacturer, OCPP error, whether the station is AC
OP: 'escalate' or 'acknowledge' if a special rule applies, otherwise null
*/
export function checkSpecialCase(
  stationName: string,
  hardware: string,
  ocppError: string,
  isAC: boolean
): SpecialAction {
  // France (LFR) AC stations: escalate only Offline alerts from DBT or Schneider Electric
  if (stationName.startsWith('LFR') && isAC) {
    const hw = hardware.toLowerCase();
    const isDbtOrSchneider = hw.includes('dbt') || hw.includes('schneider');
    return ocppError === 'Offline' && isDbtOrSchneider ? 'escalate' : 'acknowledge';
  }

  return null; // no special rule — use the normal flow
}
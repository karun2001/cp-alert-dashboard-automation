const AC_TYPES = new Set(['type1', 'type2', 'type3', 'schuko']);
const DC_TYPES = new Set(['ccs', 'ccs1', 'ccs2', 'chademo', 'gbt']);

/*
IP: statuses from isOccupied (connector ID -> { type, ... }), optional station name
OP: true if every connector is AC, otherwise false
*/
export function isAC(statuses: Record<string, { type: string }> | undefined, stationName = ''): boolean {
  const types = Object.values(statuses ?? {}).map(c => c.type?.toLowerCase() ?? '');

  // No connector info: fall back to the station name, e.g. "... (DC) ..."
  if (types.length === 0) {
    if (/\(DC\)/i.test(stationName)) return false;
    if (/\(AC\)/i.test(stationName)) return true;
    console.warn(`isAC: no connector types for ${stationName || 'station'} — treating as not AC`);
    return false;
  }

  // Report connector types we haven't classified yet
  const unknown = types.filter(t => !AC_TYPES.has(t) && !DC_TYPES.has(t));
  if (unknown.length) {
    console.warn(`isAC: unknown connector type(s) ${unknown.join(', ')} on ${stationName || 'station'} — treating as not AC`);
  }

  return types.every(t => AC_TYPES.has(t));
}
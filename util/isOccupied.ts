type ConnectorInfo = {
  type: string;        // 'type2', 'ccs', 'chademo' (from class)
  classStatus: string; // from class
  status: string;      // 'Occupied', 'Available', 'Inactive' (from tooltip)
  evseId: string;
  error: string | null;
};

export async function isOccupied(
  page,
  cpid: string
): Promise<{ statuses: Record<string, ConnectorInfo>; occupied: boolean } | null> {
  // 1. Fetch the connector status list for this station
  let html: string;
  try {
    const res = await page.request.get(
      `https://community.beenergised.cloud/infrastructure/cp/details/connector_status_list/${cpid}?_=${Date.now()}`
    );
    if (!res.ok()) {
      console.error(`Failed to fetch connector status for cpid ${cpid}: ${res.status()}`);
      return null;
    }
    html = await res.text();
  } catch (error) {
    console.error(`Network error fetching connector status for cpid ${cpid}:`, error.message);
    return null;
  }

  // 2. Parse each connector icon and its tooltip
  const decode = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
     .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');

  const statuses: Record<string, ConnectorInfo> = {};
  const iconRe = /<i class="connector-([\w-]+) status-([\w-]+)[^"]*"[^>]*data-original-title="([^"]*)"/g;

  let m;
  while ((m = iconRe.exec(html)) !== null) {
    const title = decode(m[3]);
    const id = title.match(/System ID #(\d+)/)?.[1];
    if (!id) continue;

    const bolds = [...title.matchAll(/<b>([^<]+)<\/b>/g)].map(b => b[1].trim());
    const err = bolds[2] ?? null;

    statuses[id] = {
      type:        m[1],
      classStatus: m[2],
      status:      title.match(/Status:\s*([^<&\n]+)/)?.[1]?.trim() ?? '',
      evseId:      bolds[1] ?? '',
      error:       err && err !== 'NoError' ? err : null,
    };
  }

  if (Object.keys(statuses).length === 0) {
    console.warn(`No connectors found in status list for cpid ${cpid}`);
  }

  // 3. The station counts as occupied if ANY connector is occupied
  const occupied = Object.values(statuses).some(c => c.status === 'Occupied');

  console.log('Connector statuses:', statuses);
  console.log(`Occupied: ${occupied}`);

  return { statuses, occupied };
}
//UI approach

//Click to escalate to Third party
//Find the affected connector
// Click Cancel, Navigate to previous errors
// Get the list for today's errors
// search for the vendor error & connector type
// Is it previously escalted, return true, else return false


// API call approach

//1. Click on a issue row, capture issue id      Done
//2. Get more details of the particular alert    
//3. Get previous errors list of that error
//4. Check if previously escalted

import { isRepeatedlySolved } from './isRepeatedlySolved';

export async function checkPrevEscalation(page, row) {
  // 1. Click row and get issueId
  await row.click();
  const issueId = (await row.locator('td span').first().textContent())?.trim();
  if (!issueId) {
    console.error('Could not read issueId from row');
    return null;
  }
  //console.log('issueId', issueId);

  // 2. Fetch issue details to extract cpid
  let detailResponse;
  try {
    detailResponse = await page.request.get(
      `https://community.beenergised.cloud/infrastructure/cp/operation/details/${issueId}`
    );
  } catch (error) {
    console.error(`Network error fetching details for issue ${issueId}:`, (error as Error).message);
    return null;
  }

  if (!detailResponse.ok()) {
    console.error(`Failed to fetch details for issue ${issueId}: ${detailResponse.status()}`);
    return null;
  }

  const html = await detailResponse.text();
  if (!html?.trim()) {
    console.error(`Empty response for issue ${issueId}`);
    return null;
  }

  const cpidMatch = html.match(/restart_cp\((\d+)\)/)
                 ?? html.match(/reset_cp\((\d+)\)/)
                 ?? html.match(/cpid=(\d+)/);
  if (!cpidMatch) {
    console.error(`Could not extract cpid from details page for issue ${issueId}`);
    return null;
  }
  const cpid = cpidMatch[1];
  //console.log(`✓ cpid extracted: ${cpid}`);

  // 3. Fetch previous error history (yesterday → today)
  const today = new Date();
  const previousDay = new Date(today);
  previousDay.setDate(today.getDate() - 1);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const params = new URLSearchParams({
    cpid,
    sEcho: '1',
    iColumns: '10',
    sColumns: ',,,,,,,,,',
    iDisplayStart: '0',
    iDisplayLength: '200',                 // was 50 — avoid truncation
    mDataProp_0: 'Id',            mDataProp_1: 'CpConnectorLabel',
    mDataProp_2: 'ErrorCode',     mDataProp_3: 'VendorCode',
    mDataProp_4: 'OccuredAtDate', mDataProp_5: 'SolvedAtDate',
    mDataProp_6: 'RequireOnSite', mDataProp_7: 'EscalatedToThirdParty',
    mDataProp_8: 'ActionType',    mDataProp_9: 'IsInMaintenanceWindow',
    sSearch: '', bRegex: 'false',
    iSortCol_0: '0', sSortDir_0: 'desc',   // newest first
    iSortingCols: '1',
    range_start: fmt(previousDay),
    range_end: fmt(today),
    range_field: 'Occured',
  });

  let historyResponse;
  try {
    historyResponse = await page.request.get(
      `https://community.beenergised.cloud/infrastructure/rest/cp_error_notifications?${params}`
    );
  } catch (error) {
    console.error(`Network error fetching history for cpid ${cpid}:`, (error as Error).message);
    return null;
  }

  if (!historyResponse.ok()) {
    console.error(`Failed to fetch history for cpid ${cpid}: ${historyResponse.status()}`);
    return null;
  }

  const data = await historyResponse.json();
  const errors: any[] = data.aaData ?? [];
  //console.log(`✓ ${errors.length} previous errors found for cpid ${cpid}`);

  // Find the current issue's own record
  const currentError = errors.find(e => String(e.Id) === issueId);
  if (!currentError) {
    console.error(`Current issue ${issueId} not found in history for cpid ${cpid}`);
    return null; // unknown — don't guess station-level
  }

  const affectedCpConnectorId = currentError.CpConnectorId ?? null;
  //console.log(`✓ Affected CpConnectorId: ${affectedCpConnectorId} \n Current Error: `, currentError);

  // 4. Check if the same fault was previously escalated on the same scope
  const normalize = (v?: string | number | null) => String(v ?? '').trim().toUpperCase();

  const previouslyEscalated = errors.some(e => {
    if (String(e.Id) === issueId) return false;                 // skip itself
    if (e.ActionType !== 'Escalated To Third Party') return false;

    // Same OCPP ErrorCode
    if (normalize(e.ErrorCode) !== normalize(currentError.ErrorCode)) return false;

    // Same VendorCode (only if the current issue has one)
    if (
      currentError.VendorCode &&
      normalize(e.VendorCode) !== normalize(currentError.VendorCode)
    ) {
      return false;
    }

    // Same scope
    if (!affectedCpConnectorId) {
      const match = !e.CpConnectorId;
      if (match) //console.log(`✓ Station-level error previously escalated:`, e);
      return match;
    }

    const match = e.CpConnectorId === affectedCpConnectorId;
    if (match) //console.log(`✓ Connector-level error previously escalated:`, e);
    return match;
  });

  //console.log(`Previously escalated: ${previouslyEscalated}`);

  const repeatedlySolved = isRepeatedlySolved(errors, currentError, affectedCpConnectorId, 3);

  return { html, issueId, cpid, previouslyEscalated, errors, affectedCpConnectorId, repeatedlySolved };
}
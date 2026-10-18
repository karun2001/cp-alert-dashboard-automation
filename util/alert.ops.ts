import {shouldEscalate} from './shouldEscalate';
import {totalNumberOfAlerts, getOcppAndVendorError} from './utility';
import {expect} from '@playwright/test';
import {checkPrevEscalation} from './checkPrevEscalated';
import {setPerformedActions} from './setPerdormedAction';
import {isOccupied} from './isOccupied';
import {Offline} from './Offline';

export async function alertOps(page, issueTable) {
  const pagination = page.locator('#current .pagination li a');
  let testRun = false;
  const paginationCount = testRun ? 1 : await pagination.count() - 2;
  const processedIds = new Set<string>(); // tracks all processed issueIds across pages

  for (let i = 1; i <= paginationCount; i++) {
    if (i > 1) {
      await pagination.nth(i).click();
      await page.waitForTimeout(2000);
    }

    const rows = issueTable.locator('tbody tr');
    const testCondition = testRun ? 1 : await rows.count();
    let j = 0;

    while (j < testCondition) {
      const row = rows.nth(j);
      const result = await checkPrevEscalation(page, row);

      if (!result) {
        j++;
        continue;
      }

      const { html, issueId, cpid, previouslyEscalated, errors, affectedCpConnectorId, repeatedlySolved } = result;

      // Skip already processed alerts
      if (processedIds.has(issueId)) {
        j++;
        continue;
      }

      const ocppMatch   = html.match(/<b>Error information<\/b>:<br\s*\/>([^<]+)/);
      const vendorMatch       = html.match(/<b>Additional vendor information<\/b>:<br\s*\/>([^<]+)/);
      const manufacturerMatch = html.match(/<b>Manufacturer<\/b>:<br\s*\/>([^<]+)/);

      const ocppError   = ocppMatch?.[1]?.trim()        ?? '(Leer)';
      const vendorError = vendorMatch?.[1]?.trim()      ?? '(Leer)';
      const hardware    = manufacturerMatch?.[1]?.trim() ?? '(Leer)';

      const escalate = shouldEscalate(hardware, ocppError, vendorError);
      const { statuses, occupied } = await isOccupied(page, cpid);
      console.log(
        `Alert Hardware: ${hardware}, OCPP Error: ${ocppError}, Vendor Error: ${vendorError}, ` +
        `Should Escalate: ${escalate}, Previously Escalated: ${previouslyEscalated}, ` +
        `Suggested Action: ${escalate && !previouslyEscalated ? 'Escalate' : 'Acknowledge'}, ` +
        `Affected Connector: ${affectedCpConnectorId}`+`Is Repeatedly Solved: ${repeatedlySolved}`+
        `Is Occupied: ${occupied}`
      );

      processedIds.add(issueId);

      if (!escalate || previouslyEscalated) {
        console.log('Acknowledging alert..., Station name:', await row.locator('td').nth(1).textContent());
        await page.locator('a').filter({ hasText: 'Acknowledged' }).click();
        await page.waitForTimeout(2000);
        // Row removed from table — stay at same j, row count effectively decreased
      } else if (repeatedlySolved) { 
        await setPerformedActions(page, issueTable, row, 'Error occurred repeatedly even after getting solved.');
      }
      else if(occupied) {
        // Escalate to third party as "Ongoing charging process so did not restart or reset further."
        await setPerformedActions(page, issueTable, row, 'Ongoing charging process so did not restart or reset further.');
      }
      else if (ocppError === 'Offline') {
        await Offline(page, row);
      }
      else {
        // Row stays in table — move to next
        j++;
      }

      if(testRun) {
        console.log('Test run completed — exiting after first alert');
        return;
      }
    }
  }
}
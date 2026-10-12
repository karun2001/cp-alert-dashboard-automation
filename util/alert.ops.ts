import {shouldEscalate} from './shouldEscalate';
import {totalNumberOfAlerts, getOcppAndVendorError} from './utility';
import {expect} from '@playwright/test';
import {checkPrevEscalation} from './checkPrevEscalated';

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

      const { html, issueId, cpid, previouslyEscalated, errors, affectedCpConnectorId } = result;

      // Skip already processed alerts
      if (processedIds.has(issueId)) {
        j++;
        continue;
      }

      const ocppMatch         = html.match(/<b>Error information<\/b>:<br\s*\/>([^<]+)/);
      const vendorMatch       = html.match(/<b>Additional vendor information<\/b>:<br\s*\/>([^<]+)/);
      const manufacturerMatch = html.match(/<b>Manufacturer<\/b>:<br\s*\/>([^<]+)/);

      const ocppError   = ocppMatch?.[1]?.trim()        ?? '(Leer)';
      const vendorError = vendorMatch?.[1]?.trim()      ?? '(Leer)';
      const hardware    = manufacturerMatch?.[1]?.trim() ?? '(Leer)';

      const escalate = shouldEscalate(hardware, ocppError, vendorError);

      console.log(
        `Alert Hardware: ${hardware}, OCPP Error: ${ocppError}, Vendor Error: ${vendorError}, ` +
        `Should Escalate: ${escalate}, Previously Escalated: ${previouslyEscalated}, ` +
        `Suggested Action: ${escalate && !previouslyEscalated ? 'Escalate' : 'Acknowledge'}, ` +
        `Affected Connector: ${affectedCpConnectorId}`
      );

      processedIds.add(issueId);

      if (!escalate || previouslyEscalated) {
        console.log('Acknowledging alert..., Station name:', await row.locator('td').nth(1).textContent());
        await page.locator('a').filter({ hasText: 'Acknowledged' }).click();
        await page.waitForTimeout(2000);
        // Row removed from table — stay at same j, row count effectively decreased
      } else {
        // Row stays in table — move to next
        j++;
      }
    }
  }
}
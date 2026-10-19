import { shouldEscalate } from './shouldEscalate';
import { restartStation } from './utility';
import { checkPrevEscalation } from './checkPrevEscalated';
import { setPerformedActions } from './setPerdormedAction';
import { isOccupied } from './isOccupied';
// import { Offline } from './Offline';

const CYCLE_INTERVAL_MS = 1 * 60 * 1000; // 1 minutes between passes
const WAIT_BETWEEN_ALERTS_MS = 1000;     // 2 seconds between alerts

// Show up to 500 alerts on one page
async function showAllRows(page) {
  await page.waitForTimeout(2000);
  await page.locator('.select2-selection__arrow').first().click();
  console.log('Clicked on down arrow');
  await page.waitForTimeout(2000);
  await page.getByRole('treeitem', { name: '500' }).click();
  console.log('Selected 500 in the list');
  await page.waitForTimeout(2000);
}

// Return the first unprocessed alert (ID + station name read together), or null
async function findNextUnprocessedRow(page, issueTable, processedIds: Set<string>) {
  const rowsData = await issueTable.locator('tbody tr').evaluateAll(trs =>
    trs.map(tr => ({
      id:   tr.querySelector('td.id span')?.textContent?.trim() ?? '',
      name: tr.querySelector('td.issue_information b')?.textContent?.trim() ?? '(Leer)',
    }))
  );

  const next = rowsData.find(r => r.id && !processedIds.has(r.id));
  if (!next) return null;

  return {
    issueIdOnRow: next.id,
    stationName:  next.name,
    row: issueTable.locator('tbody tr').filter({ has: page.locator(`td.id span:text-is("${next.id}")`) }),
  };
}

export async function alertOps(page, issueTable) {
  const testRun = false; // true = handle only one alert per pass

  let origonalList: string[] = []; // stations restarted in the previous pass
  let newList: string[] = [];      // stations restarted in this pass
  let cycle = 0;

  while (true) {
    cycle++;
    console.log(`\n===== Pass ${cycle} started at ${new Date().toLocaleTimeString()} =====`);
    console.log('Stations restarted last pass:', origonalList);

    await showAllRows(page);

    const processedIds = new Set<string>(); // reset every pass
    let next;

    // Loop ends when every alert in the table has been handled
    while ((next = await findNextUnprocessedRow(page, issueTable, processedIds)) !== null) {
      const { row, issueIdOnRow, stationName } = next;
      processedIds.add(issueIdOnRow); // mark first so a failure can't cause an endless retry

      try {
        const result = await checkPrevEscalation(page, row);
        if (!result) continue;

        const { html, cpid, previouslyEscalated, affectedCpConnectorId, repeatedlySolved, resolved } = result;

        // Alert was solved while we were working on it
        if (resolved) {
          console.log(`Issue ${issueIdOnRow} (${stationName}) already resolved — skipping`);
          continue;
        }

        const ocppError   = html.match(/<b>Error information<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim()            ?? '(Leer)';
        const vendorError = html.match(/<b>Additional vendor information<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim() ?? '(Leer)';
        const hardware    = html.match(/<b>Manufacturer<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim()                ?? '(Leer)';

        const escalate = shouldEscalate(hardware, ocppError, vendorError);
        const occupied = (await isOccupied(page, cpid))?.occupied ?? false;

        console.log(
          `Station: ${stationName}, Hardware: ${hardware}, OCPP Error: ${ocppError}, Vendor Error: ${vendorError}, ` +
          `Should Escalate: ${escalate}, Previously Escalated: ${previouslyEscalated}, ` +
          `Affected Connector: ${affectedCpConnectorId}, Repeatedly Solved: ${repeatedlySolved}, Occupied: ${occupied}`
        );

        // Row may have left the table during the checks above
        if (!(await row.count())) {
          console.log(`Issue ${issueIdOnRow} (${stationName}) left the table — skipping`);
          continue;
        }

        if (!escalate || previouslyEscalated) {
          console.log('Acknowledging alert — Station name:', stationName);
          await page.locator('a').filter({ hasText: 'Acknowledged' }).click();
          await page.waitForTimeout(2000);
        } else if (repeatedlySolved) {
          await setPerformedActions(page, issueTable, row, 'Error occurred repeatedly even after getting solved.');
        } else if (occupied) {
          await setPerformedActions(page, issueTable, row, 'Ongoing charging process so did not restart or reset further.');
        }
        /* else if (ocppError === 'Offline') {
          await Offline(page, row);
        } */
        else if (origonalList.includes(stationName)) {
          // Restarted last pass and the error is back — escalate
          await setPerformedActions(page, issueTable, row, 'Restarted multiple time, but the error occurs again.');
        } else if (newList.includes(stationName)) {
          // Already restarted this pass (another connector on the same station)
          console.log(`Station ${stationName} already restarted this pass — skipping`);
        } else {
          // First restart — remember the station for the next pass
          console.log(`Restarting station ${stationName}`);
          newList.push(stationName);
          await restartStation(page, row);
        }
      } catch (error) {
        console.error(`⚠ Failed on issue ${issueIdOnRow} (${stationName}): ${error.message.split('\n')[0]} — moving on`);
        await page.keyboard.press('Escape').catch(() => {}); // close any half-open form
      }

      if (testRun) {
        console.log('Test run — stopping this pass after one alert');
        break;
      }

      await page.waitForTimeout(WAIT_BETWEEN_ALERTS_MS);
    }

    console.log(`All alerts handled this pass (${processedIds.size} checked)`);

    // End of pass: this pass's restarts are checked in the next pass
    origonalList = newList;
    newList = [];

    console.log(`===== Pass ${cycle} finished. Next pass in 1 minutes =====`);
    await page.waitForTimeout(CYCLE_INTERVAL_MS);
  }
}
import { shouldEscalate } from './shouldEscalate';
import { restartStation, resetStation } from './utility';
import { checkPrevEscalation } from './checkPrevEscalated';
import { setPerformedActions } from './setPerdormedAction';
import { isOccupied } from './isOccupied';
import { isAC } from './isAC';
import { checkSpecialCase } from './specialCases';
// import { Offline } from './Offline';

const CYCLE_INTERVAL_MS = 1 * 60 * 1000; // time between passes (1 minute)
const WAIT_BETWEEN_ALERTS_MS = 1000;     // time between alerts (1 second)
const MAX_SOLVED_PER_DAY = 3;            // acknowledge if solved more than this today

type Step = 'reset' | 'restart';

// Show up to 500 alerts on one page
// Show up to 500 alerts on one page (never stops the run)
async function showAllRows(page) {
  const select = page.locator('select[name="open_issue_table_length"]');

  try {
    // Already showing 500: nothing to do
    if ((await select.inputValue()) === '500') {
      //console.log('Already showing 500 alerts per page');
      return;
    }

    await page.keyboard.press('Escape').catch(() => {}); // close anything left open

    // Open the dropdown that belongs to the alert table
    await page.locator('#open_issue_table_length .select2-selection').click();
    await page.locator('.select2-results__option', { hasText: /^500$/ }).click({ timeout: 5000 });
    //console.log('Selected 500 in the list');
  } catch {
    // Fallback: set the value directly and tell DataTables it changed
    //console.log('Dropdown did not open — setting 500 directly');
    await page.evaluate(() => {
      (window as any).jQuery('select[name="open_issue_table_length"]').val('500').trigger('change');
    }).catch(() => console.warn('Could not set 500 alerts per page — continuing with current page size'));
  }

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

// Acknowledge the selected alert
async function acknowledge(page, row, stationName: string, reason: string) {
  console.log(`Acknowledging alert — Station: ${stationName} (${reason})`);
  await row.click();
  await page.waitForTimeout(1000);
  await page.locator('a').filter({ hasText: 'Acknowledged' }).click();
  await page.waitForTimeout(2000);
}

// Count how many times the same error was solved today on the same connector
function countSolvedToday(errors: any[], issueId: string, affectedCpConnectorId): number {
  const current = errors.find(e => e.Id === issueId);
  if (!current) return 0;

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;

  return errors.filter(e =>
    e.Id !== issueId &&
    e.ErrorCode === current.ErrorCode &&
    (!affectedCpConnectorId || e.CpConnectorId === affectedCpConnectorId) &&
    e.SolvedAtDate?.startsWith(today)          // e.g. '27.10.26 21:55:59'
  ).length;
}

export async function alertOps(page, issueTable) {
  const testRun = false; // true = handle only one alert per pass

  let previousSteps = new Map<string, Step>(); // step each station reached last pass
  let currentSteps  = new Map<string, Step>(); // step each station reaches this pass
  let cycle = 0;

  // Reset → Restart → finalAction, one step per pass
  async function resetRestartThen(row, stationName: string, finalAction: () => Promise<void>) {
    const lastStep = previousSteps.get(stationName) ?? 'none';

    if (currentSteps.has(stationName)) {
      console.log(`Station ${stationName} already handled this pass (${currentSteps.get(stationName)}) — skipping`);
    } else if (lastStep === 'restart') {
      console.log(`Station ${stationName}: error persists after reset and restart`);
      await finalAction();
    } else if (lastStep === 'reset') {
      console.log(`Station ${stationName}: error persists after reset — restarting`);
      currentSteps.set(stationName, 'restart');
      await restartStation(page, row);
    } else {
      console.log(`Station ${stationName}: resetting`);
      currentSteps.set(stationName, 'reset');
      await resetStation(page, row);
    }
  }

  while (true) {
    cycle++;
    console.log(`\n===== Pass ${cycle} started at ${new Date().toLocaleTimeString()} =====`);
    console.log('Stations acted on last pass:', Object.fromEntries(previousSteps));

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

        const { html, cpid, errors, previouslyEscalated, affectedCpConnectorId, repeatedlySolved, resolved } = result;

        // Alert was solved while we were working on it
        if (resolved) {
          console.log(`Issue ${issueIdOnRow} (${stationName}) already resolved — skipping`);
          continue;
        }

        const ocppError   = html.match(/<b>Error information<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim()            ?? '(Leer)';
        const vendorError = html.match(/<b>Additional vendor information<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim() ?? '(Leer)';
        const hardware    = html.match(/<b>Manufacturer<\/b>:<br\s*\/>([^<]+)/)?.[1]?.trim()                ?? '(Leer)';

        const status      = await isOccupied(page, cpid);
        const occupied    = status?.occupied ?? false;
        const ac          = isAC(status?.statuses, stationName);
        const special  = checkSpecialCase(stationName, hardware, ocppError, ac);
        const escalate    = shouldEscalate(hardware, ocppError, vendorError);
        const solvedToday = countSolvedToday(errors ?? [], issueIdOnRow, affectedCpConnectorId);
        const lastStep    = previousSteps.get(stationName) ?? 'none';

        console.log(
        `\n\n IsssueId: ${issueIdOnRow}, Station: ${stationName}, Hardware: ${hardware}, OCPP Error: ${ocppError}, Vendor Error: ${vendorError}, ` +
        `Should Escalate: ${escalate}, Previously Escalated: ${previouslyEscalated}, ` +
        `Affected Connector: ${affectedCpConnectorId}, Repeatedly Solved: ${repeatedlySolved}, ` +
        `Solved today: ${solvedToday}, Occupied: ${occupied}, AC: ${ac}, ` +
        `Special: ${special ?? 'none'}, Last step: ${lastStep}`                     // ← Special added
      );

        // Row may have left the table during the checks above
        if (!(await row.count())) {
          console.log(`Issue ${issueIdOnRow} (${stationName}) left the table — skipping`);
          continue;
        }

        if (previouslyEscalated) {
          await acknowledge(page, row, stationName, 'previously escalated');
        } else if (special === 'escalate') {
          await setPerformedActions(page, issueTable, row, 'Charging station is offline.');
        } else if (special === 'acknowledge') {
          await acknowledge(page, row, stationName, 'special rule (LFR AC station)');
        } else if (!escalate) {
          // ----- Alerts that should NOT be escalated -----
          if (occupied) {
            await acknowledge(page, row, stationName, 'station occupied');
          } else if (solvedToday > MAX_SOLVED_PER_DAY) {
            await acknowledge(page, row, stationName, `solved ${solvedToday} times today`);
          } else {
            await resetRestartThen(row, stationName, () =>
              acknowledge(page, row, stationName, 'error persists after reset and restart')
            );
          }
        } else if (repeatedlySolved) {
          // ----- Alerts that should be escalated -----
          await setPerformedActions(page, issueTable, row, 'Error occurred repeatedly even after getting solved.');
        } else if (occupied) {
          await setPerformedActions(page, issueTable, row, 'Ongoing charging process so did not restart or reset further.');
        }
        /* else if (ocppError === 'Offline') {
          await Offline(page, row);
        } */
        else {
          await resetRestartThen(row, stationName, () =>
            setPerformedActions(page, issueTable, row, 'Reset and restart performed, but the error still occurs.').then(() => {})
          );
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

    //console.log(`All alerts handled this pass (${processedIds.size} checked)`);

    // End of pass: this pass's steps are checked in the next pass
    previousSteps = currentSteps;
    currentSteps = new Map();

    console.log(`\n===== Pass ${cycle} finished. Next pass in ${CYCLE_INTERVAL_MS / 60000} minute(s) =====`);
    await page.waitForTimeout(CYCLE_INTERVAL_MS);
  }
}
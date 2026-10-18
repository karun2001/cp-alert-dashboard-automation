import { chromium } from 'playwright';  // note: 'playwright' not '@playwright/test'
import { expect } from '@playwright/test';
import path from 'path';
//import { Offline } from '../util/Offline';
//import { checkPrevEscalation } from '../util/checkPrevEscalated';
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

// async function setupAuth() {
  
//   const context = await chromium.launchPersistentContext(           //This creates a new browser profile dediicated for the automation test.
//     'C:\\Users\\KarunSharma\\playwright-automation-profile',
//     {
//       headless: false,
//       channel: 'chrome',
//     }
//   );
//   const page = await context.newPage();
//   await page.goto('https://community.beenergised.cloud/infrastructure/cp/operation/dashboard');
//   await page.waitForURL('https://community.beenergised.cloud/**');
//   await context.storageState({ path: authFile });
//   await expect(page.getByRole('link', { name: 'Infrastructure' })).toBeVisible();
//   await page.getByRole('link', { name: 'Infrastructure' }).hover();
//   await expect(page.getByRole('link', { name: 'CP Operation Dashboard' })).toBeVisible();
//   await page.getByRole('link', { name: 'CP Operation Dashboard' }).click();

//   // capture the table, go to 1st row position, click on it and print the row data.
//   await expect(page.locator('#open_issue_table')).toBeVisible();
//   const issueTable = page.locator('#open_issue_table');
// //   checkPrevEscalation(page, issueTable);

//     Offline(page, issueTable);
// }
// setupAuth().catch(console.error);




export async function Offline(page, row){
    //await table.locator('tbody tr :has-text("Offline")').first().click();
    await row.click();
    await page.waitForTimeout(2000);
    await page.getByText('Immediate reset (Hard)').click();
    await page.getByRole('button', { name: 'Immediate reset (Hard)' }).click();
    await page.waitForTimeout(5000);
    await page.locator('a').filter({ hasText: 'Escalate to third party' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Escalate to third party' }).click();
    console.log('Waiting for 5 seconds before next iteration...');  
    await page.waitForTimeout(5000);
}




// export async function Offline(page, table) {
//   // count total offline rows
//   const offlineRows = table.locator('tbody tr :has-text("Offline")');
//   const totalOffline = await offlineRows.count();
//   console.log(`Found ${totalOffline} Offline alerts to process`);

//   if (totalOffline === 0) {
//     console.log('No Offline alerts found — exiting');
//     return;
//   }

//   // traverse each offline row
//   for (let i = 0; i < totalOffline; i++) {
//     console.log(`\n─────────────────────────────────`);
//     console.log(`Processing Offline alert ${i + 1} of ${totalOffline}`);

//     try {
//       // click the row to load detail panel
//       await offlineRows.nth(i).click();
//       await page.waitForTimeout(2000);

//       // read alert details from detail panel
//       const stationId = await table
//         .locator('tbody tr')
//         .nth(i)
//         .locator('td.issue_information b')
//         .textContent();
//       const alertId = await table
//         .locator('tbody tr')
//         .nth(i)
//         .locator('td.id span')
//         .textContent();
//       const duration = await table
//         .locator('tbody tr')
//         .nth(i)
//         .locator('td.duraction span')
//         .textContent();

//       console.log(`Alert ID:  ${alertId?.trim()}`);
//       console.log(`Station:   ${stationId?.trim()}`);
//       console.log(`Duration:  ${duration?.trim()}`);

//       // check if restart button is visible
//       const restartVisible = await page
//         .getByRole('button', { name: 'Immediate reset (Hard)' })
//         .isVisible();

//       if (restartVisible) {
//         // DEMO — log instead of clicking
//         console.log(`[DEMO] Would click: "Immediate reset (Hard)" for station ${stationId?.trim()}`);
//       } else {
//         console.log(`Restart button not visible for station ${stationId?.trim()}`);
//       }

//       await page.waitForTimeout(1000);

//       // check if escalate button is visible
//       const escalateVisible = await page
//         .locator('a')
//         .filter({ hasText: 'Escalate to third party' })
//         .isVisible();

//       if (escalateVisible) {
//         // DEMO — log instead of clicking
//         console.log(`[DEMO] Would click: "Escalate to third party" for station ${stationId?.trim()}`);
//       } else {
//         console.log(`Escalate button not visible for station ${stationId?.trim()}`);
//       }

//       console.log(`[DEMO] Actions that would be performed:`);
//       console.log(`         1. Immediate reset (Hard) on station ${stationId?.trim()}`);
//       console.log(`         2. Escalate to third party for alert ${alertId?.trim()}`);
//       console.log(`[DEMO] Skipping actual clicks — demonstration mode`);

//       // wait before next iteration
//       await page.waitForTimeout(2000);

//     } catch (error) {
//       console.error(`Error processing alert ${i + 1}:`, error.message);
//       continue; // move to next alert
//     }
//   }

//   console.log(`\n─────────────────────────────────`);
//   console.log(`[DEMO] Completed — processed ${totalOffline} Offline alerts`);
//   console.log(`[DEMO] In production, each alert would have been restarted and escalated`);
// }
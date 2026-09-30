import { chromium } from 'playwright';  // note: 'playwright' not '@playwright/test'
import { expect } from '@playwright/test';
import path from 'path';
import { Offline } from '../util/Offline';
import { checkPrevEscalation } from '../util/checkPrevEscalated';
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

async function setupAuth() {
  
  const context = await chromium.launchPersistentContext(           //This creates a new browser profile dediicated for the automation test.
    'C:\\Users\\KarunSharma\\playwright-automation-profile',
    {
      headless: false,
      channel: 'chrome',
    }
  );
  const page = await context.newPage();
  await page.goto('https://community.beenergised.cloud/infrastructure/cp/operation/dashboard');
  await page.waitForURL('https://community.beenergised.cloud/**');
  await context.storageState({ path: authFile });
  await expect(page.getByRole('link', { name: 'Infrastructure' })).toBeVisible();
  await page.getByRole('link', { name: 'Infrastructure' }).hover();
  await expect(page.getByRole('link', { name: 'CP Operation Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'CP Operation Dashboard' }).click();

  // capture the table, go to 1st row position, click on it and print the row data.
  await expect(page.locator('#open_issue_table')).toBeVisible();
  const issueTable = page.locator('#open_issue_table');
//   checkPrevEscalation(page, issueTable);

    Offline(page, issueTable);
}
setupAuth().catch(console.error);


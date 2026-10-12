import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import path from 'path';
import { Offline } from '../util/Offline';
import { alertOps } from '../util/alert.ops';
import { checkPrevEscalation } from '../util/checkPrevEscalated';


const authFile = path.join(__dirname, '../playwright/.auth/user.json');

async function setupAuth() {

  const context = await chromium.launchPersistentContext(
    'C:\\Users\\KarunSharma\\playwright-automation-profile',
    {
      headless: false,
      channel: 'chrome',
    }
  );

  const page = await context.newPage();

  // navigate to dashboard
  await page.goto(
    'https://community.beenergised.cloud/infrastructure/cp/operation/dashboard'
  );

  await page.waitForURL('https://community.beenergised.cloud/**');
  await context.storageState({ path: authFile });

  // confirm dashboard loaded
  await expect(
    page.getByRole('link', { name: 'Infrastructure' })
  ).toBeVisible();

  // navigate to CP Operation Dashboard
  await page.getByRole('link', { name: 'Infrastructure' }).hover();
  await expect(
    page.getByRole('link', { name: 'CP Operation Dashboard' })
  ).toBeVisible();
  await page.getByRole('link', { name: 'CP Operation Dashboard' }).click();

  // wait for alert table to load
  await expect(page.locator('#open_issue_table')).toBeVisible();
  const issueTable = page.locator('#open_issue_table');

  // wait for real data to appear
  await page.waitForFunction(() => {
    const tbody = document.querySelector('#open_issue_table tbody');
    return tbody &&
           !tbody.textContent?.includes('Loading data') &&
           tbody.querySelectorAll('tr').length > 0;
  }, { timeout: 15000 });

  console.log('Dashboard loaded — starting DEMO run...');
  console.log('[DEMO] No actual actions will be performed');
  console.log('[DEMO] Actions will be console logged only\n');


  //Offline(page, issueTable);
  alertOps(page, issueTable);
}

setupAuth().catch(console.error);
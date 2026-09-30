import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://auth.has-to-be.com/login?state=hKFo2SA4NndFNWtCbmxFOXBpa1I0dVpKclpONC10a1h6ZlFUTaFupWxvZ2luo3RpZNkgZm13TjYtZ3FER3dJWHkxSk5Ud0wzdnY2UGhpcDdaZEqjY2lk2SA0TU9ieWxlZFNBMTY4ZDNlTHE2dEw2N29sRzJOMTFWMw&client=4MObyledSA168d3eLq6tL67olG2N11V3&protocol=oauth2&scope=openid%20profile%20email&response_mode=query&response_type=code&redirect_uri=https%3A%2F%2Fcommunity.beenergised.cloud%2Fauth%2Fsso_callback&mandant_id=59');
  await page.goto('https://community.beenergised.cloud/?dashboard_id=3fff0ccd-913f-4795-9cdc-e6962a59cd69');
  await page.getByRole('link', { name: ' CP Operation Dashboard' }).click();
  await page.goto('https://community.beenergised.cloud/infrastructure/cp/operation/dashboard');
  await page.locator('iframe[title="Rich Text Area. Press ALT-0 for help."]').contentFrame().getByText('Affected Connector: Type').click();
  await page.locator('iframe[title="Rich Text Area. Press ALT-0 for help."]').contentFrame().getByText('Affected Connector: Type').click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('link', { name: 'Previous errors' }).click();
  await page.getByText('Filter 30.08.2026—28.09.2026 Define filters for log messages:Error code').click();
  await page.locator('body').press('ControlOrMeta+c');
});
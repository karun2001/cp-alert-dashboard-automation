
export async function Offline(page, table){
    for (; ;){
    await table.locator('tbody tr :has-text("Offline")').first().click();
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
}
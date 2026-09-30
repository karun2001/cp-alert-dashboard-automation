 export async function AcknowledgeError(page, table){
    //Acknowledge errors: "OtherError / EmergencyButtonPressed", "OtherError / EmergencyButtonReleased", 
    await table.locator('tbody tr :has-text("OtherError / EmergencyButtonPressed")').first().click();
    await page.locator('a').filter({ hasText: 'Acknowledged' }).click();
    console.log('Waiting for 5 seconds before next iteration...');  
    await page.waitForTimeout(5000);
 }
 
  
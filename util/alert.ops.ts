import {shouldEscalate} from './shouldEscalate';
import {totalNumberOfAlerts, getOcppAndVendorError} from './utility';
import {expect} from '@playwright/test';

export async function alertOps(page, issueTable) {
    
    // const NumOfAlerts = await totalNumberOfAlerts(page, issueTable);
    // if (NumOfAlerts <= 0) {
    //     console.log('No alerts found in the table — exiting');
    // }
    // console.log(`Found ${NumOfAlerts} alerts in the table — processing...`);


    // Continous loop to process all alerts in the table

    const rows = await issueTable.locator('tbody tr');
    const pagination = await page.locator('#current .pagination li a');

    while( await rows.count() > 0 && await pagination.count() > 2) {
        for (let i = 1; i <= await pagination.count(); i++) {
        if(i>1){    
            await pagination.nth(i).click();
            await page.waitForTimeout(2000);
        }
        for (let j = 0; j < await rows.count(); j++) {
            /* 
                Check if the alert should be escalated  
                    1. Click on the alert to open Issue Details
                    2. Get the Hardware, OCPP Error and Vendor Error from the Error Information 
                    3. Call shouldEscalate function to determine if the alert should be escalated
            */   
           const row = rows.nth(j); 
           await row.click();
        
           const {ocppError, vendorError} = await getOcppAndVendorError(row); 

        //    const issueDetails = page.locator('#issue_details');
        //    await expect (issueDetails).toBeVisible({timeout: 5000});
           
           const errorInformation = page.locator('.error-information a');
           await expect (errorInformation).toBeVisible({timeout: 5000});
           await errorInformation.click();

           const hardware = await page.locator('#issue-details .col-xs-6')
            .filter({ hasText: 'Manufacturer' })
            .evaluate((el) => {
                const br = [...el.querySelectorAll('b')]
                    .find(b => b.textContent === 'Manufacturer')
                    ?.nextElementSibling; // this is the <br>
                    return br?.nextSibling?.textContent?.trim() ?? '(Leer)';
            });

           const escalte = shouldEscalate(hardware, ocppError, vendorError);
           console.log(`Alert Hardware: ${hardware}, OCPP Error: ${ocppError}, Vendor Error: ${vendorError}, Should Escalate: ${escalte}`); 
        }    
    }
    }
}
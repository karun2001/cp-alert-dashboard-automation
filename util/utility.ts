export async function restartStation(page, row){
  await row.click();
  await page.waitForTimeout(2000);
  await page.getByText('Immediate reset (Hard)').click();
  await page.getByRole('button', { name: 'Immediate reset (Hard)' }).click();
  await page.waitForTimeout(2000);
}

export async function totalNumberOfAlerts(page, issueTable) {
    
    const rows = await issueTable.locator('tbody tr');
    
    const pagination = await page.locator('#current .pagination li a');
    const NumberOfPages = await pagination.count() - 2; // Subtract 2 for the "Previous" and "Next" buttons
    console.log("NumberOfPages", NumberOfPages);
    
    let totalNumberOfAlerts = 0;
    for (let i = 1; i <= NumberOfPages; i++) {
        if(i>1){    
            await pagination.nth(i).click();
            await page.waitForTimeout(2000);
        }
        for (let j = 0; j < await rows.count(); j++) {
            totalNumberOfAlerts++;   
        }    
    }
    return totalNumberOfAlerts;
}

export async function getOcppAndVendorError(row) {
  try {
    const issueCell = row.locator('td.issue_information span');

    // get the full raw text
    const fullText = await issueCell.textContent();
    if (!fullText) return { ocppError: '(Leer)', vendorError: '(Leer)' };

    // get just the station name from <b> tag
    const stationName = await issueCell.locator('b').textContent();

    // remove the station name from the full text to isolate the error part
    const errorPart = fullText
      .replace(stationName ?? '', '')  // strip station name
      .trim();

    if (!errorPart) return { ocppError: '(Leer)', vendorError: '(Leer)' };

    // split OCPP / Vendor error
    if (errorPart.includes(' / ')) {
      const parts = errorPart.split(' / ');
      return {
        ocppError:   parts[0]?.trim() || '(Leer)',
        vendorError: parts[1]?.trim() || '(Leer)'
      };
    }

    // no vendor code (e.g. "Offline")
    return {
      ocppError:   errorPart,
      vendorError: '(Leer)'
    };

  } catch (error) {
    console.error('Failed to extract errors:', error.message);
    return { ocppError: '(Leer)', vendorError: '(Leer)' };
  }
}
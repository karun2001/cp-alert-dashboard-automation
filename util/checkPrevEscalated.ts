//UI approach

//Click to escalate to Third party
//Find the affected connector
// Navigate to previous errors
// Get the list for today's errors
// search for the vendor error
// Is it previously escalted


// API call approach

//1. Click on a issue row, capture issue id      Done
//2. Get more details of the particular alert    
//3. Get previous errors list of that error
//4. Check if previously escalted


export async function checkPrevEscalation (page, issueTable){
//1
    // wait for the actual data API call to complete first
    await page.waitForResponse(
        response => 
        response.url().includes('operation_open_issues') && 
        response.status() === 200,
        { timeout: 15000 }
    );

    // now click safely
    const firstRow = await issueTable.locator('tbody tr').first()
    await firstRow.click();
    
    const issueId = await firstRow.locator('td span').first().textContent(); 
    console.log("issueId", issueId);
    
//2
    let detailResponse;

  try {
    detailResponse = await page.request.get(
      `https://community.beenergised.cloud/infrastructure/cp/operation/details/${issueId}`
    );
  } catch (error) {
    // network level error — request never reached server
    console.error(`Network error fetching details for issue ${issueId}:`, error.message);
    return null;
  }

  // check HTTP status
  if (!detailResponse.ok()) {
    console.error(`Failed to fetch details for issue ${issueId}`);
    console.error(`Status: ${detailResponse.status()}`);
    console.error(`Status Text: ${detailResponse.statusText()}`);
    return null;
  }

  // parse response
  let html: string;
  try {
    html = await detailResponse.text();
  } catch (error) {
    console.error(`Failed to parse response for issue ${issueId}:`, error.message);
    return null;
  }

  // validate response is not empty
  if (!html || html.trim().length === 0) {
    console.error(`Empty response for issue ${issueId}`);
    return null;
  }

  console.log(`✓ Details fetched for issue ${issueId} — length: ${html.length}`);
  console.log("HTML", html);
  //return html;


}
/*
IP: page, table, newText, demo
OP: Escalates the alert to third party ,after updating the mesage
*/


export async function setPerformedActions(
  page,
  table,
  row,
  newText = 'Error occurred repeatedly.',
  demo = false
): Promise<boolean> {
  await row.click();
  await page.waitForTimeout(2000);
  await page.locator('a').filter({ hasText: 'Escalate to third party' }).click();
  await page.waitForTimeout(2000);
  const form = page.locator('#form_operation_escalate_sfsc');
  await form.locator('iframe.tox-edit-area__iframe').waitFor();
  const frame = page.frameLocator('#form_operation_escalate_sfsc iframe.tox-edit-area__iframe');

  // Wait for the editor content to load before checking for the line
  await frame.locator('body div').first().waitFor({ timeout: 10000 });

  const line = frame.locator('div', { hasText: /^No actions performed\.?$/ }).first();
  const lineFound = await line
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (lineFound) {
    await line.click();                // move focus into the editor
    await line.selectText();           // highlight the line's text
    await page.keyboard.type(newText); // replace the highlighted text

    // Click away so TinyMCE copies the content into the hidden textarea
    await form.locator('input#receiver').click();

    const textarea = form.locator('textarea[name="message"]');
    let value = await textarea.inputValue();
    if (!value.includes(newText)) {
      await page.evaluate(() => (window as any).tinymce.activeEditor.save());
      value = await textarea.inputValue();
    }
    
    if (value.includes(newText)) {
      console.log(`✓ Message updated to: "${newText}"`);
    } else {
      console.warn('⚠ Text update failed — escalating with original message');
    }
  } else {
    console.log('ℹ "No actions performed" not found in email — escalating without changes');
  }

  if (demo) {
    console.log('[DEMO] Would click "Escalate to third party" — cancelling form instead');
    await form.getByRole('button', { name: 'Cancel' }).click();
    return true;
  }

  await form.getByRole('button', { name: 'Escalate to third party' }).click();
  console.log('Waiting for 5 seconds before next iteration...');
  await page.waitForTimeout(5000);
  return true;
}
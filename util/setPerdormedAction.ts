/*
IP: page, table, row, newText, demo
OP: Escalates the alert to third party, after updating the message
*/

export async function setPerformedActions(
  page,
  table,
  row,
  newText = 'Error occurred repeatedly.',
  demo = false
): Promise<boolean> {
  // 1. Open the escalation form for this alert
  await row.click();
  await page.waitForTimeout(2000);
  await page.locator('a').filter({ hasText: 'Escalate to third party' }).click();

  const form = page.locator('#form_operation_escalate_sfsc');
  await form.waitFor({ timeout: 10000 });

  // 2. Update the "Performed activities" section (any failure falls through to escalate directly)
  try {
    await page.waitForFunction(() => {
      const ed = (window as any).tinymce?.activeEditor;
      return ed?.initialized && ed.getContent({ format: 'text' }).trim().length > 0;
    }, { timeout: 10000 });

    const frame = page.frameLocator('#form_operation_escalate_sfsc iframe.tox-edit-area__iframe');
    const heading = frame.locator('div, p', { hasText: /^Performed activities/ }).first();

    if (!(await heading.count())) {
      console.log('ℹ "Performed activities" section not found — escalating directly');
    } else {
      // Find the last non-empty line below the heading
      let lastLine = null;
      let lastText = '';
      for (let k = 1; k <= 10; k++) {
        const sibling = heading.locator(`xpath=following-sibling::*[${k}]`);
        if (!(await sibling.count())) break;
        const text = (await sibling.textContent())?.trim() ?? '';
        if (!text) break; // blank line marks the end of the section
        lastLine = sibling;
        lastText = text;
      }

      if (!lastLine) {
        console.log('ℹ No line under "Performed activities" — escalating directly');
      } else if (/^No actions performed\.?$/.test(lastText)) {
        // Replace "No actions performed."
        await lastLine.click();
        await lastLine.selectText();
        await page.keyboard.type(newText);
        console.log(`✓ Replaced "No actions performed." with: "${newText}"`);
      } else {
        // Keep the existing action (e.g. restart) and add the new text on the next line
        await lastLine.click();
        await lastLine.selectText();
        await page.keyboard.press('ArrowRight'); // move the cursor to the end of the line
        await page.keyboard.press('Enter');
        await page.keyboard.type(newText);
        console.log(`✓ Added "${newText}" below "${lastText}"`);
      }

      // Click away so TinyMCE saves to the textarea, then confirm
      await form.locator('input#receiver').click();
      const textarea = form.locator('textarea[name="message"]');
      if (!(await textarea.inputValue()).includes(newText)) {
        await page.evaluate(() => (window as any).tinymce.activeEditor.save());
      }
      if (!(await textarea.inputValue()).includes(newText)) {
        console.log('⚠ Text update failed — escalating with original message');
      }
    }
  } catch (error) {
    console.log(`ℹ Could not edit message (${error.message.split('\n')[0]}) — escalating directly`);
  }

  // 3. Escalate (or cancel in demo mode)
  if (demo) {
    console.log('[DEMO] Would click "Escalate to third party" — cancelling form instead');
    await form.getByRole('button', { name: 'Cancel' }).click();
    return true;
  }

  await form.getByRole('button', { name: 'Escalate to third party' }).click();
  console.log('Escalated. Waiting 5 seconds before next alert...');
  await page.waitForTimeout(5000);
  return true;
}
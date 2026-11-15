
import { test, expect } from '@playwright/test';

test('verify queue persistence after edit', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('/');

    // 2. Create new map
    await page.fill('input[placeholder="Enter a new topic and press Enter..."]', 'Queue Test Map');
    await page.keyboard.press('Enter');

    // 3. Verify map created
    await expect(page.locator('h1').filter({ hasText: 'Queue Test Map' })).toBeVisible();

    // 4. Add item to queue (don't save)
    await page.fill('input[placeholder="Add a follow-up..."]', 'Q1');
    await page.keyboard.press('Enter');

    // 5. Verify queued
    await expect(page.locator('ul[aria-label="Queued follow-ups"] li')).toHaveText(['Q1']);

    // 6. Edit current question
    // Click the question text to edit (it has a click handler)
    await page.click('h3.text-xl.font-bold');

    // Type new text
    await page.fill('input[aria-label="Edit question"]', 'Queue Test Map Edited');
    await page.keyboard.press('Enter');

    // 7. Verify queued item STILL exists
    await expect(page.locator('ul[aria-label="Queued follow-ups"] li')).toHaveText(['Q1']);

    // 8. Add another item
    await page.fill('input[placeholder="Add a follow-up..."]', 'Q2');
    await page.keyboard.press('Enter');

    // 9. Verify order
    await expect(page.locator('ul[aria-label="Queued follow-ups"] li')).toHaveText(['Q1', 'Q2']);

    // 10. Save answer
    await page.fill('textarea', 'Answer 1');
    await page.click('button:has-text("Save")');

    // 11. Verify Q1 is now active (highlighted in inbox)
    // The inbox item with Q1 should be active (bg-indigo-600)
    const q1Item = page.locator('[role="navigation"] [role="listitem"]').filter({ hasText: 'Q1' });
    await expect(q1Item).toHaveClass(/bg-indigo-600/);

    // 12. Verify Q2 is in inbox (not active)
    const q2Item = page.locator('[role="navigation"] [role="listitem"]').filter({ hasText: 'Q2' });
    await expect(q2Item).not.toHaveClass(/bg-indigo-600/);

    // 13. Verify Inbox Order: Q1 then Q2?
    // We need to check the order of elements
    const inboxItems = page.locator('[role="navigation"] [role="listitem"]');
    const firstItem = inboxItems.nth(0);
    const secondItem = inboxItems.nth(1);

    await expect(firstItem).toContainText('Q1');
    await expect(secondItem).toContainText('Q2');
});

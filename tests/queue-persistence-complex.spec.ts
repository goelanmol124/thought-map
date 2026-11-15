
import { test, expect } from '@playwright/test';

test('verify queue order with multiple questions and editing', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('/');

    // 2. Create new map
    const mapName = `Queue Order Test ${Date.now()}`;
    await page.fill('input[placeholder="Enter a new topic and press Enter..."]', mapName);
    await page.keyboard.press('Enter');

    // 3. Verify map created
    await expect(page.locator('h1').filter({ hasText: mapName })).toBeVisible();

    // 4. Add Q1, Q2, Q3
    const questions = ['Q1', 'Q2', 'Q3'];
    for (const q of questions) {
        await page.fill('input[placeholder="Add a follow-up..."]', q);
        await page.keyboard.press('Enter');
        // Wait a bit to ensure distinct timestamps if that mattered (it doesn't, we use IDs)
        await page.waitForTimeout(100);
    }

    // 5. Verify all queued
    await expect(page.locator('ul[aria-label="Queued follow-ups"] li')).toHaveText(['Q1', 'Q2', 'Q3']);

    // 6. Save (Answer the root node)
    await page.fill('textarea', 'Root Answer');
    await page.click('button:has-text("Save")');

    // 7. Verify Inbox Order: Q1, Q2, Q3
    const inboxItems = page.locator('[role="navigation"] [role="listitem"]');
    await expect(inboxItems).toHaveCount(3);
    await expect(inboxItems.nth(0)).toContainText('Q1');
    await expect(inboxItems.nth(1)).toContainText('Q2');
    await expect(inboxItems.nth(2)).toContainText('Q3');

    // 8. Select Q2 (middle item)
    await inboxItems.nth(1).click();

    // 9. Edit Q2
    await page.click('h3.text-xl.font-bold'); // Click title to edit
    await page.fill('input[aria-label="Edit question"]', 'Q2 Edited');
    await page.keyboard.press('Enter');

    // 10. Verify Inbox Order is STILL Q1, Q2 Edited, Q3
    // The active item should be Q2 Edited
    await expect(inboxItems.nth(0)).toContainText('Q1');
    await expect(inboxItems.nth(1)).toContainText('Q2 Edited');
    await expect(inboxItems.nth(2)).toContainText('Q3');

    // 11. Answer Q2 Edited
    await page.fill('textarea', 'Answer for Q2');
    await page.click('button:has-text("Save")');

    // 12. Verify Inbox Order: Q1, Q3 (Q2 is gone from inbox)
    // Wait for inbox to update
    await expect(inboxItems).toHaveCount(2);
    await expect(inboxItems.nth(0)).toContainText('Q1');
    await expect(inboxItems.nth(1)).toContainText('Q3');

    // 13. Verify Q1 is now active (since it was the first one? or does it jump to next?)
    // Logic says: find first newly added OR default to first in inbox.
    // We didn't add new questions. So it should default to first in inbox (Q1).
    await expect(inboxItems.nth(0)).toHaveClass(/bg-indigo-600/);

});

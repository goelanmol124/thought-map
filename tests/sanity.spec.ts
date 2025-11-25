import { test, expect } from '@playwright/test';

test('sanity check', async ({ page }) => {
    console.log('Sanity check started');
    await page.goto('https://example.com');
    const title = await page.title();
    console.log('Title:', title);
    expect(title).toBe('Example Domain');
});

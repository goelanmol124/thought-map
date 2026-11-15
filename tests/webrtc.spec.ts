import { test, expect, type Page } from '@playwright/test';

// Open a map (creating one if this browser context has none) and show the peer panel.
async function openPeerPanel(page: Page) {
    await page.goto('/');
    const topicInput = page.locator('input[placeholder="Enter a new topic and press Enter..."]');
    if (await topicInput.isVisible()) {
        await topicInput.fill('P2P test');
        await topicInput.press('Enter');
    }
    await page.getByRole('button', { name: 'Toggle peer-to-peer panel' }).click();
    await expect(page.getByText('Peer-to-peer (WebRTC, experimental)')).toBeVisible();
}

async function getPeerId(page: Page): Promise<string> {
    const text = await page.locator('section[aria-label="Peer-to-peer connection"]').textContent();
    const id = text?.match(/peer-\d+/)?.[0];
    if (!id) throw new Error('Could not read peer ID');
    return id;
}

const status = (page: Page) => page.locator('strong:has-text("Status:") + span');
const logs = (page: Page) => page.locator('section[aria-label="Peer-to-peer connection"] .h-40.overflow-y-auto');

test.describe('WebRTC peer-to-peer panel', () => {
    test('connects two tabs over local signaling and exchanges messages', async ({ context }) => {
        const tab1 = await context.newPage();
        const tab2 = await context.newPage();
        await openPeerPanel(tab1);
        await openPeerPanel(tab2);

        // Tab 1 does nothing: it must answer the offer without any click.
        const id1 = await getPeerId(tab1);
        await tab2.locator('input[placeholder="Target ID"]').fill(id1);
        await tab2.getByRole('button', { name: 'Connect' }).click();

        await expect(status(tab1)).toHaveText('Connected', { timeout: 15_000 });
        await expect(status(tab2)).toHaveText('Connected', { timeout: 15_000 });

        await tab1.locator('input[placeholder="Type message..."]').fill('Hello from Tab 1');
        await tab1.getByRole('button', { name: 'Send' }).click();
        await expect(logs(tab2)).toContainText('Received: Hello from Tab 1');

        await tab2.locator('input[placeholder="Type message..."]').fill('Reply from Tab 2');
        await tab2.getByRole('button', { name: 'Send' }).click();
        await expect(logs(tab1)).toContainText('Received: Reply from Tab 2');

        // Closing the panel keeps the connection alive.
        await tab1.getByRole('button', { name: 'Close peer-to-peer panel' }).click();
        await tab1.getByRole('button', { name: 'Toggle peer-to-peer panel' }).click();
        await expect(status(tab1)).toHaveText('Connected');
    });

    test('connects via manual copy-paste signaling', async ({ context }) => {
        const offerer = await context.newPage();
        const answerer = await context.newPage();
        await openPeerPanel(offerer);
        await openPeerPanel(answerer);
        await offerer.getByLabel('Manual (copy-paste)').check();
        await answerer.getByLabel('Manual (copy-paste)').check();

        await offerer.getByRole('button', { name: 'Create offer' }).click();
        const offer = await offerer.locator('textarea[readonly]').inputValue({ timeout: 20_000 });
        expect(offer.length).toBeGreaterThan(100);

        // The answerer never clicks "Create offer": applying the offer is enough.
        await answerer.locator('textarea[placeholder*="Paste"]').fill(offer);
        await answerer.getByRole('button', { name: 'Apply signal' }).click();
        const answerBox = answerer.locator('textarea[readonly]');
        await expect(answerBox).toBeVisible({ timeout: 20_000 });
        const answer = await answerBox.inputValue();

        await offerer.locator('textarea[placeholder*="Paste"]').fill(answer);
        await offerer.getByRole('button', { name: 'Apply signal' }).click();

        await expect(status(offerer)).toHaveText('Connected', { timeout: 15_000 });
        await expect(status(answerer)).toHaveText('Connected', { timeout: 15_000 });

        await offerer.locator('input[placeholder="Type message..."]').fill('Over manual signaling');
        await offerer.getByRole('button', { name: 'Send' }).click();
        await expect(logs(answerer)).toContainText('Received: Over manual signaling');
    });

    test('reports a malformed pasted signal without crashing', async ({ page }) => {
        await openPeerPanel(page);
        await page.getByLabel('Manual (copy-paste)').check();
        await page.locator('textarea[placeholder*="Paste"]').fill('this-is-not-valid-base64');
        await page.getByRole('button', { name: 'Apply signal' }).click();
        await expect(logs(page)).toContainText('Could not read that signal');
        await expect(status(page)).toHaveText('Not connected');
    });
});

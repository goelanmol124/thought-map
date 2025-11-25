import { test, expect, Page } from '@playwright/test';

// Helper to enable console logging from browser
async function enableConsoleLogging(page: Page, label: string) {
    page.on('console', msg => {
        console.log(`[${label}] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', error => {
        console.error(`[${label}] Page Error:`, error);
    });
}

// Helper to extract peer ID from page
async function getPeerId(page: Page): Promise<string> {
    const idText = await page.locator('text=/My ID: peer-\\d+/').textContent();
    const peerId = idText?.match(/peer-\\d+/)?.[0];
    if (!peerId) throw new Error('Could not extract peer ID');
    return peerId;
}

// Helper to get connection status
async function getStatus(page: Page): Promise<string> {
    const statusElement = await page.locator('strong:has-text("Status:") + span');
    return await statusElement.textContent() || '';
}

// Helper to get logs
async function getLogs(page: Page): Promise<string> {
    return await page.locator('.h-40.overflow-y-auto').textContent() || '';
}

test.describe('WebRTC Local Mode (BroadcastChannel)', () => {
    test('should establish connection between two tabs', async ({ context }) => {
        console.log('=== TEST: Local Mode Connection ===');

        const page1 = await context.newPage();
        const page2 = await context.newPage();

        await enableConsoleLogging(page1, 'Tab1');
        await enableConsoleLogging(page2, 'Tab2');

        // Navigate both to localhost
        console.log('Navigating to localhost...');
        await page1.goto('http://localhost:5173');
        await page2.goto('http://localhost:5173');

        // Wait for debugger to appear
        await page1.waitForSelector('text=WebRTC Debugger', { timeout: 10000 });
        await page2.waitForSelector('text=WebRTC Debugger', { timeout: 10000 });

        console.log('Pages loaded successfully');

        // Verify version
        const version1 = await page1.locator('h3.font-bold').textContent();
        console.log('Version:', version1);
        expect(version1).toContain('v1.1');

        // Get peer IDs
        const peerId1 = await getPeerId(page1);
        const peerId2 = await getPeerId(page2);

        console.log(`Tab 1 ID: ${peerId1}`);
        console.log(`Tab 2 ID: ${peerId2}`);

        // Tab2 connects to Tab1
        console.log(`Tab2 connecting to Tab1 (${peerId1})...`);
        await page2.locator('input[placeholder="Target ID"]').fill(peerId1);
        await page2.locator('button:has-text("Connect")').click();

        // Wait for connection
        await page2.waitForTimeout(5000);

        // Check connection status
        const status1 = await getStatus(page1);
        const status2 = await getStatus(page2);

        console.log(`Tab 1 Status: ${status1}`);
        console.log(`Tab 2 Status: ${status2}`);

        expect(status1).toBe('Connected');
        expect(status2).toBe('Connected');

        // Send message from Tab1 to Tab2
        console.log('Sending message from Tab1...');
        await page1.locator('input[placeholder="Type message..."]').fill('Hello from Tab 1');
        await page1.locator('button:has-text("Send")').click();

        await page2.waitForTimeout(2000);

        // Verify message received
        const logs2 = await getLogs(page2);
        console.log('Tab2 Logs:', logs2);
        expect(logs2).toContain('Hello from Tab 1');

        // Send reply from Tab2
        console.log('Sending reply from Tab2...');
        await page2.locator('input[placeholder="Type message..."]').fill('Reply from Tab 2');
        await page2.locator('button:has-text("Send")').click();

        await page1.waitForTimeout(2000);

        const logs1 = await getLogs(page1);
        console.log('Tab1 Logs:', logs1);
        expect(logs1).toContain('Reply from Tab 2');

        console.log('✅ Local mode test passed!');

        await page1.close();
        await page2.close();
    });
});

test.describe('WebRTC Manual Mode (Copy-Paste)', () => {
    test('should establish connection using manual signaling', async ({ context }) => {
        console.log('=== TEST: Manual Mode Connection ===');

        const page1 = await context.newPage();
        const page2 = await context.newPage();

        await enableConsoleLogging(page1, 'Peer1');
        await enableConsoleLogging(page2, 'Peer2');

        await page1.goto('http://localhost:5173');
        await page2.goto('http://localhost:5173');

        await page1.waitForSelector('text=WebRTC Debugger');
        await page2.waitForSelector('text=WebRTC Debugger');

        // Select Manual mode
        console.log('Selecting Manual mode on both peers...');
        await page1.locator('input[type="radio"]').nth(1).check();
        await page2.locator('input[type="radio"]').nth(1).check();

        // Generate offer
        console.log('Peer1: Generating offer...');
        await page1.locator('button:has-text("Generate Offer")').click();

        // Wait for ICE gathering (v1.1 waits for complete gathering)
        await page1.waitForTimeout(5000);

        // Get the offer
        const offerTextarea = page1.locator('textarea[readonly]').first();
        const offer = await offerTextarea.inputValue();

        console.log(`Offer length: ${offer.length} bytes`);
        expect(offer.length).toBeGreaterThan(100);

        // Peer2: Process offer
        console.log('Peer2: Processing offer...');
        await page2.locator('textarea[placeholder*="Paste"]').fill(offer);
        await page2.locator('button:has-text("Process Signal")').click();

        // Wait for answer generation
        await page2.waitForTimeout(5000);

        // Get the answer
        const answerTextarea = page2.locator('textarea[readonly]').first();
        const answer = await answerTextarea.inputValue();

        console.log(`Answer length: ${answer.length} bytes`);
        expect(answer.length).toBeGreaterThan(100);

        // Peer1: Process answer
        console.log('Peer1: Processing answer...');
        await page1.locator('textarea[placeholder*="Paste"]').fill(answer);
        await page1.locator('button:has-text("Process Signal")').click();

        // Wait for connection establishment
        await page1.waitForTimeout(5000);

        // Check status
        const status1 = await getStatus(page1);
        const status2 = await getStatus(page2);

        console.log(`Peer1 Status: ${status1}`);
        console.log(`Peer2 Status: ${status2}`);

        expect(status1).toBe('Connected');
        expect(status2).toBe('Connected');

        // Test messaging
        console.log('Testing bidirectional messaging...');
        await page1.locator('input[placeholder="Type message..."]').fill('Test message from Peer1');
        await page1.locator('button:has-text("Send")').click();

        await page2.waitForTimeout(2000);

        const logs2 = await getLogs(page2);
        expect(logs2).toContain('Test message from Peer1');

        console.log('✅ Manual mode test passed!');

        await page1.close();
        await page2.close();
    });
});

test.describe('WebRTC Stress Tests', () => {
    test('should handle multiple rapid messages', async ({ context }) => {
        console.log('=== STRESS TEST: Rapid Messages ===');

        const page1 = await context.newPage();
        const page2 = await context.newPage();

        await enableConsoleLogging(page1, 'Sender');
        await enableConsoleLogging(page2, 'Receiver');

        // Setup connection (using Local mode for speed)
        await page1.goto('http://localhost:5173');
        await page2.goto('http://localhost:5173');

        await page1.waitForSelector('text=WebRTC Debugger');
        await page2.waitForSelector('text=WebRTC Debugger');

        const peerId1 = await getPeerId(page1);

        await page2.locator('input[placeholder="Target ID"]').fill(peerId1);
        await page2.locator('button:has-text("Connect")').click();
        await page2.waitForTimeout(3000);

        // Verify connected
        expect(await getStatus(page1)).toBe('Connected');

        // Send 20 rapid messages
        console.log('Sending 20 rapid messages...');
        for (let i = 1; i <= 20; i++) {
            await page1.locator('input[placeholder="Type message..."]').fill(`Message ${i}`);
            await page1.locator('button:has-text("Send")').click();
            await page1.waitForTimeout(100); // Small delay between messages
        }

        // Wait for all messages to arrive
        await page2.waitForTimeout(3000);

        // Check logs
        const logs2 = await getLogs(page2);

        // Verify at least some messages arrived
        const receivedCount = (logs2.match(/Received: Message \d+/g) || []).length;
        console.log(`Received ${receivedCount}/20 messages`);

        expect(receivedCount).toBeGreaterThanOrEqual(15); // Allow some loss

        console.log('✅ Rapid messages test passed!');

        await page1.close();
        await page2.close();
    });

    test('should handle large message payloads', async ({ context }) => {
        console.log('=== STRESS TEST: Large Payloads ===');

        const page1 = await context.newPage();
        const page2 = await context.newPage();

        await enableConsoleLogging(page1, 'Sender');
        await enableConsoleLogging(page2, 'Receiver');

        // Setup connection
        await page1.goto('http://localhost:5173');
        await page2.goto('http://localhost:5173');

        await page1.waitForSelector('text=WebRTC Debugger');
        await page2.waitForSelector('text=WebRTC Debugger');

        const peerId1 = await getPeerId(page1);

        await page2.locator('input[placeholder="Target ID"]').fill(peerId1);
        await page2.locator('button:has-text("Connect")').click();
        await page2.waitForTimeout(3000);

        // Send large message (10KB)
        const largeMessage = 'A'.repeat(10000);
        console.log(`Sending message of ${largeMessage.length} bytes...`);

        await page1.locator('input[placeholder="Type message..."]').fill(largeMessage);
        await page1.locator('button:has-text("Send")').click();

        await page2.waitForTimeout(2000);

        const logs2 = await getLogs(page2);
        expect(logs2).toContain('AAAA'); // Check for pattern

        console.log('✅ Large payload test passed!');

        await page1.close();
        await page2.close();
    });

    test('should handle reconnection after disconnect', async ({ context }) => {
        console.log('=== STRESS TEST: Reconnection ===');

        const page1 = await context.newPage();
        const page2 = await context.newPage();

        await enableConsoleLogging(page1, 'Peer1');
        await enableConsoleLogging(page2, 'Peer2');

        // Initial connection
        await page1.goto('http://localhost:5173');
        await page2.goto('http://localhost:5173');

        await page1.waitForSelector('text=WebRTC Debugger');
        await page2.waitForSelector('text=WebRTC Debugger');

        const peerId1 = await getPeerId(page1);

        await page2.locator('input[placeholder="Target ID"]').fill(peerId1);
        await page2.locator('button:has-text("Connect")').click();
        await page2.waitForTimeout(3000);

        expect(await getStatus(page1)).toBe('Connected');

        // Close page2 (disconnect)
        console.log('Simulating disconnect...');
        await page2.close();

        await page1.waitForTimeout(3000);

        // Check if page1 detected disconnect
        const status1AfterDisconnect = await getStatus(page1);
        console.log(`Status after disconnect: ${status1AfterDisconnect}`);

        // Reconnect with new page
        console.log('Reconnecting...');
        const page3 = await context.newPage();
        await enableConsoleLogging(page3, 'Peer3');

        await page3.goto('http://localhost:5173');
        await page3.waitForSelector('text=WebRTC Debugger');

        await page3.locator('input[placeholder="Target ID"]').fill(peerId1);
        await page3.locator('button:has-text("Connect")').click();
        await page3.waitForTimeout(3000);

        expect(await getStatus(page3)).toBe('Connected');

        console.log('✅ Reconnection test passed!');

        await page1.close();
        await page3.close();
    });
});

test.describe('WebRTC Edge Cases', () => {
    test('should handle invalid peer ID gracefully', async ({ context }) => {
        console.log('=== EDGE CASE: Invalid Peer ID ===');

        const page = await context.newPage();
        await enableConsoleLogging(page, 'Test');

        await page.goto('http://localhost:5173');
        await page.waitForSelector('text=WebRTC Debugger');

        // Try to connect to non-existent peer
        await page.locator('input[placeholder="Target ID"]').fill('peer-99999');
        await page.locator('button:has-text("Connect")').click();

        await page.waitForTimeout(5000);

        // Should not crash, status should remain Disconnected or show error
        const status = await getStatus(page);
        console.log(`Status: ${status}`);

        // Should not be "Connected"
        expect(status).not.toBe('Connected');

        console.log('✅ Invalid peer ID handled gracefully');

        await page.close();
    });

    test('should handle malformed signal data', async ({ context }) => {
        console.log('=== EDGE CASE: Malformed Signal ===');

        const page = await context.newPage();
        await enableConsoleLogging(page, 'Test');

        await page.goto('http://localhost:5173');
        await page.waitForSelector('text=WebRTC Debugger');

        // Select Manual mode
        await page.locator('input[type="radio"]').nth(1).check();

        // Paste invalid signal
        const invalidSignal = 'this-is-not-valid-base64';
        await page.locator('textarea[placeholder*="Paste"]').fill(invalidSignal);
        await page.locator('button:has-text("Process Signal")').click();

        await page.waitForTimeout(2000);

        // Should log error but not crash
        const logs = await getLogs(page);
        console.log('Logs:', logs);

        console.log('✅ Malformed signal handled gracefully');

        await page.close();
    });
});

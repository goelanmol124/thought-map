import { expect, test, type Page } from '@playwright/test';
import { MAX_INQUIRY_JSON_CHARS } from '../src/inquiry';
import {
  createInquiry,
  openDecisionBrief,
  resetClientStorage,
} from './helpers/inquiry';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetClientStorage(page);
});

test('rejects invalid evidence URLs with an accessible alert and does not add evidence', async ({
  page,
}) => {
  await createInquiry(page, 'Should we trust this source link?');

  await page.getByRole('button', { name: /add evidence/i }).click();
  await page.getByRole('button', { name: 'supports', exact: true }).click();
  await page.getByLabel('Evidence note').fill('Looks supportive but the URL is unsafe.');
  await page.getByLabel('Source name').fill('Suspicious source');
  await page.getByLabel('Source URL').fill('https://user:pass@evil.example/report');
  await page.getByRole('button', { name: /add to reasoning/i }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/valid http:\/\/ or https:\/\/ link/i);
  await expect(page.getByLabel('Source URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('0 pieces')).toBeVisible();
  await expect(page.getByRole('link', { name: /Suspicious source/i })).toHaveCount(0);
});

test('rejects oversized Dashboard imports before reading the file', async ({ page }) => {
  await installFileTextProbe(page);

  const oversized = Buffer.alloc(MAX_INQUIRY_JSON_CHARS + 1, 0x61);
  await page.getByLabel('Import inquiry JSON file').setInputFiles({
    name: 'oversized.thoughtmap.json',
    mimeType: 'application/json',
    buffer: oversized,
  });

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/too large to import/i);
  const maxLabel = await page.evaluate(
    (max) => max.toLocaleString(),
    MAX_INQUIRY_JSON_CHARS,
  );
  await expect(alert).toContainText(maxLabel);

  expect(await page.evaluate(() => (window as unknown as { __fileTextCalls: number }).__fileTextCalls))
    .toBe(0);
});

test('blob-backed brief export still starts a download', async ({ page }) => {
  await createInquiry(page, 'Should we keep blob exports working?');
  await page.getByLabel('Your best answer right now').fill('Yes — download must still begin.');
  await page.getByRole('button', { name: /resolve & continue/i }).click();
  await openDecisionBrief(page);

  await page.evaluate(() => {
    const tracked = window as unknown as { __objectUrlStarts: number };
    tracked.__objectUrlStarts = 0;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      tracked.__objectUrlStarts += 1;
      return original(object);
    };
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export brief/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.md$/i);
  expect(
    await page.evaluate(() => (window as unknown as { __objectUrlStarts: number }).__objectUrlStarts),
  ).toBeGreaterThan(0);
});

async function installFileTextProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tracked = window as unknown as { __fileTextCalls: number };
    tracked.__fileTextCalls = 0;
    const original = File.prototype.text;
    File.prototype.text = function patchedText(this: File, ...args: []) {
      tracked.__fileTextCalls += 1;
      return original.apply(this, args);
    };
  });
}

import { expect, test } from '@playwright/test';
import {
  activeQuestion,
  createInquiry,
  followUpQuestion,
  openDecisionBrief,
  openQuestionList,
  questionLoop,
  resetClientStorage,
} from './helpers/inquiry';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetClientStorage(page);
});

test('Enter creates a decision while Shift+Enter inserts a newline', async ({ page }) => {
  const title = 'Should keyboard submission begin this inquiry?';
  const decisionField = page.getByLabel('Decision or difficult question');

  await decisionField.fill(title);
  await decisionField.press('Shift+Enter');
  await expect(decisionField).toHaveValue(`${title}\n`);
  await decisionField.press('Enter');

  await expect(page.getByLabel('Inquiry title')).toHaveValue(title);

  await page.getByRole('button', { name: 'Back to all inquiries' }).click();
  await expect(decisionField).toBeVisible();
  await expect(decisionField).not.toBeFocused();
});

test('hidden import input is skipped in the dashboard tab order', async ({ page }) => {
  const homeLink = page.getByRole('link', { name: 'IdeaMap home' });
  const fileInput = page.getByLabel('Import inquiry JSON file');
  const importButton = page.getByRole('button', { name: 'Import', exact: true });
  const themeButton = page.getByRole('button', { name: /Use (dark|light) theme/ });

  await expect(fileInput).toHaveAttribute('tabindex', '-1');
  await homeLink.focus();
  await page.keyboard.press('Tab');
  await expect(importButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(themeButton).toBeFocused();
  await expect(fileInput).not.toBeFocused();
});

test('Unknowns queue uses roving focus and activates only on Enter', async ({ page }) => {
  await createInquiry(page, 'Should we expand the partner program?');
  await page.getByLabel('Your best answer right now').fill('Only after the operating model is clear.');

  const followUps = [
    'Who owns partner onboarding?',
    'What margin should partners retain?',
    'Can support absorb the added volume?',
  ];
  for (const followUp of followUps) {
    await followUpQuestion(page).fill(followUp);
    await page.getByRole('button', { name: /^Stage follow-up question:/ }).click();
  }
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  const rows = openQuestionList(page).locator('.loop-item > button:first-child');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(rows.nth(1)).toHaveAttribute('tabindex', '-1');
  await expect(rows.nth(2)).toHaveAttribute('tabindex', '-1');

  const selectedBeforeNavigation = await activeQuestion(page).inputValue();
  await rows.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(rows.nth(1)).toBeFocused();
  await expect(rows.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(activeQuestion(page)).toHaveValue(selectedBeforeNavigation);

  await page.keyboard.press('End');
  await expect(rows.nth(2)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rows.nth(0)).toBeFocused();
  await expect(activeQuestion(page)).toHaveValue(selectedBeforeNavigation);

  await page.keyboard.press('End');
  await expect(rows.nth(2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(activeQuestion(page)).toHaveValue(followUps[2]);
});

test('live updates expose named status regions', async ({ page }) => {
  await createInquiry(page, 'Should we change the quarterly planning cadence?');

  const focusNotifications = page.getByRole('status', {
    name: 'Focus panel notifications',
  });
  await expect(focusNotifications).toContainText(/Now working on:/);
  await expect(page.getByRole('status', { name: 'Draft save status' })).toBeVisible();
  await expect(
    questionLoop(page).getByRole('status', { name: 'Unknowns queue status' }),
  ).toContainText('1 unresolved');

  await followUpQuestion(page).fill('Would monthly reviews reduce surprises?');
  await page.getByRole('button', { name: /^Stage follow-up question:/ }).click();
  await expect(focusNotifications).toHaveText('Follow-up staged and saved on this device');

  await openDecisionBrief(page);
  await page.getByRole('button', { name: 'Copy memo' }).click();
  await expect(
    page.getByRole('status', { name: 'Decision memo notifications' }),
  ).toHaveText('Decision memo copied to clipboard');
});

import { expect, test, type Download, type Page } from '@playwright/test';
import {
  activeQuestion,
  createInquiry,
  followUpQuestion,
  openDecisionBrief,
  openQuestionList,
  outlineQuestion,
  questionLoop,
  resetClientStorage,
} from './helpers/inquiry';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetClientStorage(page);
});

test('creates an inquiry from the dashboard', async ({ page }) => {
  await createInquiry(
    page,
    'Should we focus the next six months on self-serve teams?',
    'A decision we can explain to the team',
  );

  await expect(page.getByLabel('Intended outcome')).toHaveValue(
    'A decision we can explain to the team',
  );
  await expect(activeQuestion(page)).toHaveValue(
    'Should we focus the next six months on self-serve teams?',
  );
  await expect(page.getByLabel('Your best answer right now')).toBeVisible();
});

test('answers the root question with a staged follow-up', async ({ page }) => {
  await createInquiry(page, 'Should we launch the beta next month?');

  await page.getByLabel('Your best answer right now').fill('Only if support coverage is ready.');
  await page.getByRole('button', { name: 'Leaning' }).click();
  await followUpQuestion(page).fill('Do we have weekend support coverage?');
  await page.getByLabel('Follow-up priority').selectOption('blocking');
  await page.getByRole('button', { name: 'Stage follow-up' }).click();

  await expect(page.getByLabel('Staged follow-up questions')).toContainText(
    'Do we have weekend support coverage?',
  );

  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await expect(activeQuestion(page)).toHaveValue('Do we have weekend support coverage?');
  await expect(openQuestionList(page)).toContainText('Do we have weekend support coverage?');
  await expect(
    outlineQuestion(page, /Do we have weekend support coverage/i),
  ).toBeVisible();
});

test('supports queue selection between open questions', async ({ page }) => {
  await createInquiry(page, 'Is the pricing change worth the churn risk?');

  await page.getByLabel('Your best answer right now').fill('Yes, with a grandfather clause.');
  await followUpQuestion(page).fill('What churn rate is acceptable?');
  await page.getByRole('button', { name: 'Stage follow-up' }).click();
  await followUpQuestion(page).fill('Can sales explain the change clearly?');
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await expect(activeQuestion(page)).toHaveValue('What churn rate is acceptable?');

  const queue = openQuestionList(page);
  await expect(queue).toContainText('Can sales explain the change clearly?');
  await queue
    .getByRole('button', { name: /Can sales explain the change clearly\? open question/i })
    .click();

  await expect(activeQuestion(page)).toHaveValue('Can sales explain the change clearly?');
  await expect(
    questionLoop(page).getByRole('button', { name: /Next best question/i }),
  ).toContainText('What churn rate is acceptable?');
});

test('keeps inquiry and question selection isolated between tabs', async ({ page, context }) => {
  const inquiryTitle = 'Should we isolate each tab workspace?';
  const firstUnknown = 'Which customer segment goes first?';
  const secondUnknown = 'What rollout guardrail do we need?';
  await createInquiry(page, inquiryTitle);
  await page.getByLabel('Your best answer right now').fill('Run a narrow pilot.');
  await followUpQuestion(page).fill(firstUnknown);
  await page.getByRole('button', { name: 'Stage follow-up' }).click();
  await followUpQuestion(page).fill(secondUnknown);
  await page.getByRole('button', { name: /resolve & continue/i }).click();
  await expect(activeQuestion(page)).toHaveValue(firstUnknown);

  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await otherTab.getByRole('button', { name: `Open ${inquiryTitle}` }).click();
  await openQuestionList(otherTab)
    .getByRole('button', {
      name: `${secondUnknown} open question · unknown`,
      exact: true,
    })
    .click();
  await expect(activeQuestion(otherTab)).toHaveValue(secondUnknown);

  const localDraft = 'Does this assumption survive the enterprise case?';
  await followUpQuestion(page).fill(localDraft);
  await activeQuestion(otherTab).fill('What rollout safety limit do we need?');
  await activeQuestion(otherTab).blur();

  await expect(activeQuestion(page)).toHaveValue(firstUnknown);
  await expect(followUpQuestion(page)).toHaveValue(localDraft);

  await otherTab.getByRole('button', { name: 'Back to all inquiries' }).click();
  await createInquiry(otherTab, 'Should the second tab open another inquiry?');
  await expect(page.getByLabel('Inquiry title')).toHaveValue(inquiryTitle);
  await expect(activeQuestion(page)).toHaveValue(firstUnknown);
  await expect(followUpQuestion(page)).toHaveValue(localDraft);
  await otherTab.close();
});

test('adds evidence to the active question', async ({ page }) => {
  await createInquiry(page, 'Should we renew the analytics contract?');

  await page.getByRole('button', { name: /add evidence/i }).click();
  await page.getByRole('button', { name: 'supports', exact: true }).click();
  await page.getByLabel('Evidence note').fill('Usage grew 40% quarter over quarter.');
  await page.getByLabel('Source name').fill('Product analytics');
  await page.getByLabel('Source URL').fill('https://example.com/analytics');
  await page.getByRole('button', { name: /add to reasoning/i }).click();

  await expect(page.getByRole('heading', { name: 'Evidence' })).toBeVisible();
  await expect(page.getByText('Usage grew 40% quarter over quarter.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Product analytics/i })).toHaveAttribute(
    'href',
    'https://example.com/analytics',
  );
});

test('persists inquiry work across reload', async ({ page }) => {
  const title = 'Should we open a second office?';
  await createInquiry(page, title, 'A location decision');

  await page.getByLabel('Your best answer right now').fill('Not this year.');
  await page.getByRole('button', { name: 'Supported' }).click();
  await page.getByRole('button', { name: /add evidence/i }).click();
  await page.getByLabel('Evidence note').fill('Lease costs exceed budget by 18%.');
  await page.getByRole('button', { name: /add to reasoning/i }).click();

  // Resolve so the answer is written into durable inquiry state.
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await page.reload();
  await expect(page.getByLabel('Inquiry title')).toHaveValue(title);

  await page.getByRole('button', { name: 'Back to all inquiries' }).click();
  await page.getByRole('button', { name: `Open ${title}` }).click();

  await expect(page.getByLabel('Intended outcome')).toHaveValue('A location decision');
  await outlineQuestion(page, new RegExp(title, 'i')).click();
  await expect(page.getByLabel('Your best answer right now')).toHaveValue('Not this year.');
  await expect(page.getByText('Lease costs exceed budget by 18%.')).toBeVisible();
});

test('exposes decision brief and export affordances', async ({ page }) => {
  await createInquiry(page, 'Should we sunset the legacy plan?');
  await page.getByLabel('Your best answer right now').fill('Yes, after a 90-day notice.');
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await openDecisionBrief(page);

  await expect(page.getByText('Root question')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Should we sunset the legacy plan?', level: 3 }),
  ).toBeVisible();
  await expect(page.getByLabel('Inquiry state')).toBeVisible();
  await expect(page.getByLabel('Inquiry progress')).toBeVisible();

  const markdownDownload = waitForDownload(page);
  await page.getByRole('button', { name: /export brief/i }).click();
  const markdown = await markdownDownload;
  expect(markdown.suggestedFilename()).toMatch(/\.md$/i);

  const jsonDownload = waitForDownload(page);
  await page.getByRole('button', { name: /^Backup$/i }).click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toMatch(/\.json$/i);
});

test('responsive smoke: mobile navigation reaches focus and brief', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createInquiry(page, 'Should we pause paid acquisition?');

  const mobileNav = page.getByRole('navigation', { name: 'Inquiry views' });
  await expect(mobileNav).toBeVisible();

  await mobileNav.getByRole('tab', { name: 'Loop' }).click();
  await expect(questionLoop(page)).toBeVisible();

  await mobileNav.getByRole('tab', { name: 'Focus' }).click();
  await expect(page.getByLabel('Your best answer right now')).toBeVisible();

  await mobileNav.getByRole('tab', { name: 'Brief' }).click();
  await expect(page.getByRole('heading', { name: 'Decision brief' })).toBeVisible();
});

test('keyboard shortcut resolves the active answer', async ({ page }) => {
  await createInquiry(page, 'Should we rewrite the onboarding flow?');

  const answer = page.getByLabel('Your best answer right now');
  await answer.fill('Rewrite the first session only.');
  await followUpQuestion(page).fill('Which metrics prove success?');
  await answer.focus();
  await page.keyboard.press('Control+Enter');

  await expect(activeQuestion(page)).toHaveValue('Which metrics prove success?');
});

test('recovers stance and uncommitted composer drafts after reload', async ({ page }) => {
  await createInquiry(page, 'Should we change the activation metric?');

  await page.getByRole('button', { name: 'Leaning' }).click();
  await followUpQuestion(page).fill('Would retained usage tell a different story?');
  await page.getByLabel('Follow-up priority').selectOption('blocking');
  await page.getByRole('button', { name: /add evidence/i }).click();
  await page.getByRole('button', { name: 'weakens', exact: true }).click();
  await page.getByLabel('Evidence note').fill('The current metric ignores week-two retention.');
  await page.getByLabel('Source name').fill('Retention review');
  await page.getByLabel('Source URL').fill('https://example.com/retention');

  await page.reload();

  await expect(page.getByRole('button', { name: 'Leaning' })).toHaveAttribute('aria-pressed', 'true');
  await expect(followUpQuestion(page)).toHaveValue('Would retained usage tell a different story?');
  await expect(page.getByLabel('Follow-up priority')).toHaveValue('blocking');
  await expect(page.getByLabel('Evidence note')).toHaveValue(
    'The current metric ignores week-two retention.',
  );
  await expect(page.getByLabel('Source name')).toHaveValue('Retention review');
  await expect(page.getByLabel('Source URL')).toHaveValue('https://example.com/retention');
});

test('resolves into the globally ranked unknown and never points sole current to itself', async ({
  page,
}) => {
  await createInquiry(page, 'Should we enter the enterprise segment?');
  await expect(
    questionLoop(page).getByRole('button', { name: /next best question/i }),
  ).toHaveCount(0);

  await page.getByLabel('Your best answer right now').fill('Only with a design partner.');
  await followUpQuestion(page).fill('Can the product support SSO this quarter?');
  await page.getByLabel('Follow-up priority').selectOption('normal');
  await page.getByRole('button', { name: 'Stage follow-up' }).click();
  await followUpQuestion(page).fill('Is there a committed design partner?');
  await page.getByLabel('Follow-up priority').selectOption('blocking');
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await expect(activeQuestion(page)).toHaveValue('Is there a committed design partner?');
});

test('records and copies only a ready, authored decision memo', async ({ page }) => {
  await createInquiry(page, 'Should we discontinue the free plan?');
  await openDecisionBrief(page);

  const recordDecision = page.getByRole('button', { name: 'Record decision' });
  await expect(recordDecision).toBeDisabled();
  await expect(page.getByText(/Not ready:/i))
    .toContainText(/write the current call/i);

  await page.getByRole('tab', { name: 'Unknowns' }).click();
  await page.getByLabel('Your best answer right now').fill('Yes, after a 60-day migration period.');
  await page.getByRole('button', { name: /resolve & continue/i }).click();
  await openDecisionBrief(page);
  await expect(recordDecision).toBeDisabled();

  await page.getByRole('textbox', { name: 'Decision memo' }).fill(
    'Discontinue free because support cost exceeds qualified pipeline. Reopen if conversion falls.',
  );
  await page.getByLabel('Review date').fill('2026-10-01');
  await page.getByLabel('Review trigger').fill('Paid conversion falls below 8%');
  await expect(recordDecision).toBeEnabled();
  await recordDecision.click();
  await expect(page.getByLabel('Inquiry state — decision status')).toHaveValue('decided');

  await page.getByRole('button', { name: 'Copy memo' }).click();
  await expect(page.getByText('Decision memo copied to clipboard')).toHaveCount(1);
});

test('keeps open counts and decided status consistent', async ({ page }) => {
  await createInquiry(page, 'Should counts and status use one definition?');
  await page.getByLabel('Your best answer right now').fill('Only after the blocker clears.');
  await followUpQuestion(page).fill('Has the blocking dependency cleared?');
  await page.getByLabel('Follow-up priority').selectOption('blocking');
  await page.getByRole('button', { name: /resolve & continue/i }).click();

  await expect(page.getByText(/1 unknown · 1 resolved/i)).toBeVisible();
  await expect(questionLoop(page).getByText('1 unresolved')).toBeVisible();
  const outline = page.getByRole('navigation', { name: 'Reasoning outline' });
  await expect(outline.getByText('1 unknown', { exact: true })).toBeVisible();
  await expect(outline.getByRole('treeitem')).toHaveCount(2);

  await openDecisionBrief(page);
  await expect(page.getByLabel('Inquiry progress')).toContainText(/1\s*unknowns resolved/);
  await expect(page.getByLabel('Inquiry progress')).toContainText(/1\s*unknowns open/);
  const status = page.getByLabel('Inquiry state — decision status');
  await status.selectOption('decided');
  await expect(status).not.toHaveValue('decided');
  await expect(page.getByText(/Not ready:/i)).toContainText(/Resolve 1 blocking unknown/i);
});

function waitForDownload(page: Page): Promise<Download> {
  return page.waitForEvent('download');
}

/**
 * Dry-run demo of the locked IdeaMap spine — paced for video holds
 * from the perception/aura insight wave (see demo/exports/INSIGHTS_V4_CHECKLIST.md).
 *
 * Run:  npm run test:demo
 * Optional: HEADED=1  DEMO_SLOW_MO=400
 */
import { expect, test, type Page } from '@playwright/test';
import {
  activeQuestion,
  followUpQuestion,
  openDecisionBrief,
  resetClientStorage,
} from './helpers/inquiry';

const ROOT_QUESTION = 'Should we focus the next six months on self-serve teams?';
const ROOT_ANSWER =
  'Yes — if a new team can reach first value without a CSM.';
const EVIDENCE_NOTE =
  'Three design partners stalled until someone ran setup for them.';
const BLOCKER =
  'Can a new team reach first value without sales-led onboarding?';
const BLOCKER_ANSWER = 'Not yet — activation still needs a guided path.';
const DECISION_MEMO =
  'Yes for six months, contingent on activation without CSM. Revisit if three target teams ask for assisted onboarding.';

/** Hold a beat so the video can register UI state (insight I13). */
async function beat(page: Page, ms = 900): Promise<void> {
  await page.waitForTimeout(ms);
}

test.describe.configure({ mode: 'serial' });

test('IdeaMap locked spine — dry-run demo video', async ({ page }) => {
  // I23: viewport locked in demo-video project + video.size
  await resetClientStorage(page);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByLabel('Decision or difficult question')).toBeVisible({
    timeout: 30_000,
  });

  // I01/I02: short land on hero (title card added in assembly)
  const decisionField = page.getByLabel('Decision or difficult question');
  await decisionField.fill(ROOT_QUESTION);
  await beat(page, 800);

  // I02: arm Begin ≥1s before click
  const begin = page.getByRole('button', { name: /begin inquiry/i });
  await begin.hover();
  await beat(page, 1200);
  await begin.click();
  await expect(activeQuestion(page)).toHaveValue(ROOT_QUESTION);

  // I03: land in workspace before typing
  await beat(page, 1000);

  // I04: provisional call — hold so “draft ≠ resolve” can read
  const answer = page.getByLabel('Your best answer right now');
  await answer.fill(ROOT_ANSWER);
  await beat(page, 1400);

  await page.getByRole('button', { name: 'Leaning', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leaning', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await beat(page, 900);

  // I05: evidence being added + SUPPORTS dwell ≥2s
  await page.getByRole('button', { name: /add evidence \(optional\)/i }).click();
  await beat(page, 500);
  await page.getByRole('button', { name: 'supports', exact: true }).click();
  await page.getByLabel('Evidence note').fill(EVIDENCE_NOTE);
  await beat(page, 400);
  await page.getByRole('button', { name: /add to reasoning/i }).click();
  await expect(page.getByText(EVIDENCE_NOTE)).toBeVisible();
  await beat(page, 2200);

  // I06: stage Blocking unknown — hold staged chip
  await expect(page.getByRole('heading', { name: 'What could change this call?' })).toBeVisible();
  await followUpQuestion(page).fill(BLOCKER);
  await page.getByLabel('Follow-up priority').selectOption('blocking');
  await beat(page, 800);
  await followUpQuestion(page).press('Enter');
  await expect(page.getByLabel('Staged follow-up questions')).toContainText(BLOCKER);
  await beat(page, 1400);

  // I07: Resolve #1 — pre/post holds
  const resolve = page.getByRole('button', { name: /resolve & continue/i });
  await resolve.scrollIntoViewIfNeeded();
  await resolve.hover();
  await beat(page, 1100);
  await resolve.click();
  await expect(activeQuestion(page)).toHaveValue(BLOCKER);
  // I06 hero: break-into / child unknown dwell ≥2.5s
  await beat(page, 2600);

  // Answer blocker
  await page.getByLabel('Your best answer right now').fill(BLOCKER_ANSWER);
  await beat(page, 1000);

  // I07: Resolve #2
  await resolve.hover();
  await beat(page, 1100);
  await resolve.click();
  await beat(page, 1400);

  // I08: Decision memo — Not ready on incomplete → fill → Ready (never Ready on empty)
  await openDecisionBrief(page);
  await beat(page, 700);

  const readiness = page.getByLabel('Decision readiness');
  await readiness.scrollIntoViewIfNeeded();
  await expect(readiness).toContainText(/Not ready:/i);
  await beat(page, 1600);

  const memo = page.getByRole('textbox', { name: 'Decision memo' });
  await memo.scrollIntoViewIfNeeded();
  await memo.fill(DECISION_MEMO);
  await beat(page, 900);

  await readiness.scrollIntoViewIfNeeded();
  await expect(readiness).toContainText(/Ready to record/i);
  await beat(page, 1800);

  const recordDecision = page.getByRole('button', { name: 'Record decision' });
  await expect(recordDecision).toBeEnabled();
  await recordDecision.scrollIntoViewIfNeeded();
  await recordDecision.hover();
  await beat(page, 900);
  await recordDecision.click();
  await expect(page.getByLabel('Inquiry state — decision status')).toHaveValue('decided');
  await beat(page, 1200);

  // I09: privacy footer continuous hold before assembly endcard
  await page.getByRole('button', { name: 'Back to all inquiries' }).click();
  await expect(
    page.getByRole('button', { name: `Open ${ROOT_QUESTION}` }),
  ).toBeVisible();
  const privacy = page.getByText('Strategy stays on this device');
  await privacy.scrollIntoViewIfNeeded();
  await expect(privacy).toBeVisible();
  await beat(page, 2400);
});

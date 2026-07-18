import { expect, type Page } from '@playwright/test';

/** Active question title field in the focus panel. */
export const activeQuestion = (page: Page) =>
  page.getByRole('textbox', { name: 'Question', exact: true });

/** Follow-up composer input (exact name avoids "Staged follow-up questions"). */
export const followUpQuestion = (page: Page) =>
  page.getByRole('textbox', { name: 'Follow-up question', exact: true });

/** Question loop sidebar (queue + next-best). Prefer a visible instance when mobile duplicates exist. */
export const questionLoop = (page: Page) =>
  page.getByRole('complementary', { name: 'Question loop' }).filter({ visible: true }).first();

/** Open-question queue list inside the loop. */
export const openQuestionList = (page: Page) =>
  questionLoop(page).getByRole('list');

/** Reasoning outline tree for selecting any question. */
export const reasoningTree = (page: Page) =>
  page.getByRole('navigation', { name: 'Reasoning outline' }).getByRole('tree').first();

/** Select a question from the reasoning outline by visible title text. */
export const outlineQuestion = (page: Page, title: string | RegExp) =>
  reasoningTree(page).getByRole('treeitem', { name: title });

/** Clear persisted inquiry/map state between browser journeys. */
export async function resetClientStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('indexedDB' in window) {
      const databases = typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : [{ name: 'thought-map-data' }];
      await Promise.all(
        databases
          .map((db) => db.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              new Promise<void>((resolve, reject) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
                request.onblocked = () => resolve();
              }),
          ),
      );
    }
  });
  await page.reload();
}

export async function createInquiry(
  page: Page,
  question: string,
  desiredOutcome?: string,
): Promise<void> {
  const questionField = page.getByLabel('Decision or difficult question');
  await expect(questionField).toBeVisible();
  await questionField.fill(question);

  if (desiredOutcome) {
    await page.getByRole('button', { name: /add an intended outcome/i }).click();
    await page.getByLabel('What should this inquiry produce?').fill(desiredOutcome);
  }

  await page.getByRole('button', { name: /begin inquiry/i }).click();
  await expect(page.getByLabel('Inquiry title')).toHaveValue(question);
}

export async function openDecisionBrief(page: Page): Promise<void> {
  const desktopTab = page.getByRole('tab', { name: /decision memo|decision brief/i });
  if (await desktopTab.isVisible()) {
    await desktopTab.click();
  } else {
    await page.getByRole('navigation', { name: 'Inquiry views' })
      .getByRole('tab', { name: /brief|memo/i })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: /decision memo|decision brief/i }).first(),
  ).toBeVisible();
}

import { expect, test } from '@playwright/test';
import { activeQuestion, outlineQuestion, resetClientStorage } from './helpers/inquiry';

/**
 * Migration helpers are not exported as pure functions (they depend on Yjs),
 * so legacy → inquiry conversion is covered here through the browser entry path.
 */
test('migrates legacy localStorage thought maps into inquiries', async ({ page }) => {
  await resetClientStorage(page);

  await page.evaluate(() => {
    const mapId = 'map_1700000000000';
    localStorage.setItem('thoughtMaps', JSON.stringify({
      [mapId]: {
        id: mapId,
        topic: 'Legacy map about pricing',
        currentQuestionId: 2,
        nodes: [
          {
            id: 1,
            question: 'Legacy map about pricing',
            answer: 'Raise prices carefully',
            parentId: null,
            isAnswered: true,
          },
          {
            id: 2,
            question: 'Will churn spike?',
            answer: '',
            parentId: 1,
            isAnswered: false,
          },
        ],
      },
    }));
    localStorage.setItem('activeMapId', mapId);
  });

  await page.reload();

  // Migration restores the prior active map as the active inquiry when possible.
  const title = page.getByLabel('Inquiry title');
  const openLegacy = page.getByRole('button', { name: /Open Legacy map about pricing/i });

  await expect(title.or(openLegacy)).toBeVisible({ timeout: 15_000 });

  if (await openLegacy.isVisible()) {
    await openLegacy.click();
  }

  await expect(title).toHaveValue('Legacy map about pricing');
  await expect(activeQuestion(page)).toHaveValue('Will churn spike?');
  await expect(outlineQuestion(page, /Will churn spike/i)).toBeVisible();
});

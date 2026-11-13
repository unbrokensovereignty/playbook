import { expect, open, test } from './app.ts';

test('the built-in self-test passes', async ({ page, errors }) => {
  await open(page, 'selftest');
  await page.getByRole('button', { name: /Run \d+ checks/ }).click();
  const result = page.locator('[data-testid=selftest-result]');
  await expect(result).toContainText(/All passed|failed/, { timeout: 50_000 });
  await expect(result).toContainText('All passed');
  expect(errors).toEqual([]);
});

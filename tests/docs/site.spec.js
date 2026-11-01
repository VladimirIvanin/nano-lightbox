import { test, expect } from '@playwright/test';

test('GitHub Pages subdirectory loads documentation, size data and browser example', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/site-dist/');
  await expect(page).toHaveTitle('Nano Lightbox — документация');
  const { gzipBytes: { core } } = await (await page.request.get('/site-dist/dist/sizes.json')).json();
  await expect(page.locator('[data-size="core"]').first()).toHaveText(core < 1024 ? `${core} B` : `${(core / 1024).toFixed(2)} KiB`);
  await page.getByRole('button', { name: /Открыть модалку/ }).click();
  await expect(page.locator('#demo-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Инстансы / InSales', exact: true }).click();
  await page.getByText('Фото A1', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 2');
  expect(errors).toEqual([]);
});

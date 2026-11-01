import { test, expect } from '@playwright/test';

for (const api of ['auto', 'instances']) {
  test(`${api}: fullscreen layout, controls and thumbnails fit desktop and mobile`, async ({ page }) => {
    await page.goto(api === 'auto' ? '/examples/gallery.html' : '/examples/instances.html');
    await (api === 'auto' ? page.locator('main a').first() : page.getByText('Фото A1', { exact: true })).click();
    const dialog = page.locator('.nl-gallery');
    await expect(dialog.locator('.nl-dismiss svg')).toHaveCount(1);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => dialog.evaluate(d => ({ width: d.clientWidth, height: d.clientHeight }))).toEqual(viewport);
      for (const selector of ['.nl-dismiss', '.nl-next', '.nl-count', '.nl-thumbs']) {
        const node = dialog.locator(selector);
        if (!await node.count()) continue;
        const box = await node.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    }
    await dialog.locator('.nl-next').click();
    await expect(dialog.locator('.nl-count')).toContainText('2 /');
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.locator('.nl-count')).toContainText('1 /');
    await dialog.locator('.nl-dismiss').click();
    await expect(dialog).toHaveCount(0);
  });

  test(`${api}: empty stage closes, but drags, cancel and closedby prevent dismissal`, async ({ page }) => {
    await page.goto(api === 'auto' ? '/examples/gallery.html' : '/examples/instances.html');
    await (api === 'auto' ? page.locator('main a').first() : page.getByText('Фото A1', { exact: true })).click();
    const dialog = page.locator('.nl-gallery');
    const gesture = async (start, end, distance = 0) => dialog.evaluate((d, { start, end, distance }) => {
      d.querySelector(start).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: 100, clientY: 100 }));
      d.querySelector(end).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, button: 0, clientX: 100 + distance, clientY: 100 }));
    }, { start, end, distance });
    await gesture('.nl-slide img', '.nl-slide');
    await expect(dialog).toBeVisible();
    await gesture('.nl-slide', '.nl-slide', 100);
    await expect(dialog).toBeVisible();
    await dialog.evaluate(d => d.setAttribute('closedby', 'closerequest'));
    await gesture('.nl-slide', '.nl-slide');
    await expect(dialog).toBeVisible();
    await dialog.evaluate(d => d.setAttribute('closedby', 'any'));
    if (api === 'auto') {
      await dialog.evaluate(d => d.addEventListener('cancel', e => e.preventDefault(), { once: true }));
    } else {
      await page.evaluate(() => {
        const root = document.querySelector('section');
        NanoLightbox.getScope(root).gallery(root.querySelector('.photos')).on('beforeclose', e => e.preventDefault(), { once: true });
      });
    }
    await gesture('.nl-slide', '.nl-slide');
    await expect(dialog).toBeVisible();
    await gesture('.nl-slide', '.nl-slide');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).toBe('');
  });
}

test('HTML appearance inherits independently and templates retain their markup', async ({ page }) => {
  await page.goto('/examples/gallery.html');
  const trigger = page.locator('a[data-nl-gallery="editorial"]').first();
  await trigger.evaluate(a => a.dataset.nlTheme = 'dark');
  await page.locator('#editorial-template').evaluate(t => t.content.querySelector('.nl-dismiss').textContent = 'Закрыть');
  await trigger.click();
  const dialog = page.locator('.nl-gallery');
  await expect(dialog).toHaveClass(/editorial-gallery/);
  await expect(dialog).toHaveAttribute('data-nl-theme', 'dark');
  await expect(dialog.locator('.nl-dismiss')).toHaveText('Закрыть');
  await expect(dialog.locator('.nl-thumbs-slot .nl-thumbs button')).toHaveCount(2);
  await expect(dialog.locator('.nl-caption')).toHaveText('Озеро среди гор');
  await dialog.locator('.nl-next').click();
  await expect(dialog.locator('.nl-caption')).toHaveText('Горный хребет');
  await expect(dialog.locator('.nl-count')).toHaveText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await page.locator('#editorial-template').evaluate(t => t.content.querySelector('.nl-track').childElementCount)).toBe(0);
  await trigger.evaluate(a => delete a.dataset.nlTheme);
  await trigger.click();
  await expect(dialog).toHaveAttribute('data-nl-theme', 'light');
  await expect(dialog.locator('.nl-count')).toHaveText('1 / 2');
});

test('instance template supports rebuild, safe captions, deferred options and isolation', async ({ page }) => {
  await page.goto('/examples/instances.html');
  await page.evaluate(async () => {
    const root = document.querySelector('section');
    window.customGallery = NanoLightbox.getScope(root).gallery(root.querySelector('.photos'));
    const template = document.createElement('template');
    template.innerHTML = '<header class="nl-toolbar"><span class="nl-count"></span><button class="nl-dismiss">Close</button></header><div class="nl-stage"><div class="nl-track"></div><button class="nl-previous"></button><button class="nl-next"></button></div><aside class="nl-footer"><span class="nl-caption"></span><div class="nl-thumbs-slot"></div></aside>';
    customGallery.setOptions({ template, className: 'catalog-view', theme: 'light', thumbs: true });
    await customGallery.open(0);
    customGallery.setOptions({ theme: 'dark', className: '', template: null });
    customGallery.setItems([{ src: './assets/one.svg', caption: '<img src=x onerror=alert(1)>', thumb: './assets/one.svg' }, { src: './assets/two.svg' }]);
  });
  const dialog = page.locator('.nl-gallery');
  await expect(dialog).toHaveClass(/catalog-view/);
  await expect(dialog).toHaveAttribute('data-nl-theme', 'light');
  await expect(dialog.locator('.nl-caption')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(dialog.locator('.nl-caption img')).toHaveCount(0);
  await expect(dialog.locator('aside .nl-thumbs button')).toHaveCount(2);
  await dialog.locator('.nl-next').click();
  await expect(dialog.locator('.nl-count')).toHaveText('2 / 2');
  await page.evaluate(async () => { customGallery.close(); await customGallery.open(0); });
  await expect(dialog).toHaveClass('nl-gallery');
  await expect(dialog).toHaveAttribute('data-nl-theme', 'dark');
  await expect(dialog.locator('aside')).toHaveCount(0);
  await expect(dialog.locator('.nl-dismiss svg')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByText('Фото B1', { exact: true }).click();
  await expect(dialog).toHaveClass('nl-gallery');
  await expect(dialog).toHaveAttribute('data-nl-theme', 'dark');
});

test('invalid templates release sessions and subsequent opens still work in both APIs', async ({ page }) => {
  await page.goto('/examples/gallery.html');
  const result = await page.evaluate(async () => {
    const { openGallery } = await import('/dist/gallery.js');
    const { createScope } = await import('/dist/instances.js');
    const link = document.querySelector('main a');
    let rejected = false;
    try { await openGallery(link, { template: '#missing' }); } catch { rejected = true; }
    const invalid = document.createElement('template');
    invalid.innerHTML = '<div class="nl-track"></div>';
    const scope = createScope(document.querySelector('main'));
    const gallery = scope.gallery(scope.root, { template: invalid });
    let errors = 0;
    gallery.on('error', () => errors++);
    const opened = await gallery.open(0);
    const clean = !document.querySelector('.nl-gallery') && document.body.style.position === '';
    gallery.setOptions({ template: null });
    const recovered = await gallery.open(0);
    scope.destroy();
    return { rejected, opened, errors, clean, recovered };
  });
  expect(result).toEqual({ rejected: true, opened: false, errors: 1, clean: true, recovered: true });
});

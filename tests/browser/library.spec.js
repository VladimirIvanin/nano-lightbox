import { test, expect } from '@playwright/test';

test('modal only loads core, restores scroll and focus through every close route', async ({ page }) => {
  const scripts = [];
  page.on('request', req => { if (req.resourceType() === 'script') scripts.push(req.url()); });
  await page.goto('/examples/modal.html');
  const trigger = page.getByRole('button', { name: 'Открыть форму' });
  await trigger.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await trigger.click();
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await trigger.click();
  await page.locator('input').fill('Test');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  expect(await page.locator('dialog').evaluate(dialog => dialog.returnValue)).toBe('send');
  await trigger.click();
  await page.mouse.click(1, 1);
  await expect(page.locator('dialog')).not.toBeVisible();
  await trigger.click();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  expect(scripts.some(url => /gallery|thumbs|providers/.test(url))).toBe(false);
  expect(scripts).toHaveLength(2);
});

test('drawer closes on navigation and desktop breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/examples/menu.html');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.locator('#menu a[href="#contacts"]').click();
  await expect(page.locator('#menu')).not.toBeVisible();
  await expect(page).toHaveURL(/#contacts$/);
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('#menu')).not.toBeVisible();
});

test('gallery opens in the middle, synchronizes native scroll, thumbnails and resize', async ({ page }) => {
  await page.goto('/examples/gallery.html');
  await page.locator('main a').nth(1).click();
  const gallery = page.locator('.nl-gallery');
  await expect(gallery).toBeVisible();
  await expect(gallery.locator('[aria-live]')).toHaveText('2 / 6');
  await expect(gallery.locator('.nl-slide img')).toHaveCount(1);
  await expect(gallery.locator('.nl-thumbs [aria-current="true"]')).toHaveAttribute('aria-label', 'Slide 2');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(gallery.locator('[aria-live]')).toHaveText('2 / 6');
  await gallery.locator('.nl-track').evaluate(track => { track.scrollLeft = 0; });
  await expect(gallery.locator('[aria-live]')).toHaveText('1 / 6');
  await gallery.getByRole('button', { name: 'Slide 2', exact: true }).click();
  await expect(gallery.locator('[aria-live]')).toHaveText('2 / 6');
  await page.keyboard.press('Escape');
  await expect(gallery).toHaveCount(0);
  await expect(page.locator('main a').nth(1)).toBeFocused();
  await page.getByText('Одиночное изображение').click();
  await expect(gallery.locator('.nl-thumbs')).toHaveCount(0);
  await expect(gallery.getByRole('button', { name: 'Next slide' })).not.toBeVisible();
});

test('players are lazy and removed after switching or closing', async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/html' }));
  await page.goto('/examples/gallery.html');
  await expect(page.locator('iframe, video')).toHaveCount(0);
  await page.locator('main a').nth(2).click();
  await expect(page.locator('video')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next slide' }).click();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie/);
  await page.getByRole('button', { name: 'Close gallery' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('modifier clicks preserve original navigation', async ({ page }) => {
  await page.goto('/examples/gallery.html');
  const prevented = await page.locator('main a').first().evaluate(link => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
});

test('core handles nested locks and immediate close-reopen', async ({ page }) => {
  await page.goto('/examples/modal.html');
  await page.evaluate(async () => {
    const { open, close } = await import('/dist/core.js');
    const first = document.getElementById('contact');
    open(first);
    close(first);
    open(first);
    const second = document.createElement('dialog');
    second.id = 'nested';
    second.innerHTML = '<button>Nested</button>';
    document.body.append(second);
    open(second);
  });
  await expect(page.locator('#contact')).toBeVisible();
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.keyboard.press('Escape');
  await expect(page.locator('#nested')).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.keyboard.press('Escape');
  await expect(page.locator('#contact')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('');
});

test('backdrop fallback ignores drags and respects closedby', async ({ page }) => {
  await page.addInitScript(() => {
    delete HTMLDialogElement.prototype.closedBy;
    // Hide the attribute from the browser as well as removing JS reflection.
    // Deleting closedBy alone leaves native light-dismiss enabled in Chromium.
    for (const method of ['getAttribute', 'setAttribute', 'hasAttribute']) {
      const original = Element.prototype[method];
      HTMLDialogElement.prototype[method] = function (name, ...args) {
        return original.call(this, name.toLowerCase() === 'closedby' ? 'data-test-closedby' : name, ...args);
      };
    }
  });
  await page.goto('/examples/modal.html');
  await page.getByRole('button', { name: 'Открыть форму' }).click();
  const dialog = page.locator('dialog');
  expect(await dialog.evaluate(element => 'closedBy' in element)).toBe(false);
  expect(await dialog.evaluate(element => Element.prototype.getAttribute.call(element, 'closedby'))).toBeNull();
  const rect = await dialog.boundingBox();
  await page.mouse.move(rect.x + 5, rect.y + 5);
  await page.mouse.down();
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await dialog.evaluate(element => element.setAttribute('closedby', 'closerequest'));
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Открыть форму' }).click();
  await dialog.evaluate(element => element.setAttribute('closedby', 'none'));
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.evaluate(element => {
    element.setAttribute('closedby', 'AnY');
    element.addEventListener('cancel', event => event.preventDefault(), { once: true });
  });
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Открыть форму' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

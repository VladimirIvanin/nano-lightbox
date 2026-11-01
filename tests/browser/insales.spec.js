import { test, expect } from '@playwright/test';

const snippetPath = new URL('../../examples/insales/snippet.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

test.beforeEach(async ({ page }) => {
  await page.goto('/examples/instances.html');
  await page.evaluate(() => {
    window.snippetRoots = ['A', 'B'].map((name, index) => {
      const root = document.createElement('section');
      root.id = `snippet-${name}`;
      root.dataset.widgetDropItemId = String(index + 1);
      root.innerHTML = `<form data-product-id="42">
        <div class="photos">
          <div class="splide__slide--clone"><a href="/examples/assets/two.svg" data-nl-gallery="product">Клон ${name}</a></div>
          <div class="splide__slide"><a href="/examples/assets/one.svg" data-nl-gallery="product">Первое ${name}</a></div>
          <div class="splide__slide"><a href="/examples/assets/two.svg" data-nl-gallery="product">Второе ${name}</a></div>
          <div class="js-product-all-images" hidden><a href="/examples/assets/one.svg" data-nl-gallery="product">Исходник ${name}</a></div>
        </div>
        <button type="button" data-open-variant-gallery>Открыть ${name}</button>
      </form>`;
      document.body.append(root);
      return root;
    });
    window.$widget = { each(fn) { snippetRoots.forEach((root, index) => fn(index, root)); } };
    window.busHandlers = new Map();
    window.EventBus = {
      subscribe(name, fn) {
        if (!busHandlers.has(name)) busHandlers.set(name, new Set());
        busHandlers.get(name).add(fn);
      },
      unsubscribe(name, fn) { busHandlers.get(name)?.delete(fn); }
    };
    window.emitVariant = (root, images) => {
      for (const fn of busHandlers.get('change_variant:insales:product') || []) {
        fn({ action: { product: [root.querySelector('form')] }, images, title: 'Вариант' });
      }
    };
  });
  await page.addScriptTag({ path: snippetPath });
});

test('InSales isolates repeated products and maps Splide clones to original slides', async ({ page }) => {
  await page.getByText('Клон A', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('2 / 2');
  await expect(page.locator('.nl-gallery img')).toHaveAttribute('src', /two\.svg$/);
  const items = await page.evaluate(() => {
    const root = snippetRoots[0];
    return NanoLightbox.getScope(root).gallery(root.querySelector('.photos')).items.map(item => item.element.textContent);
  });
  expect(items).toEqual(['Первое A', 'Второе A']);
  await page.keyboard.press('Escape');
  await page.getByText('Первое B', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 2');
  await page.keyboard.press('Escape');

  // An identical URL in a genuine slide remains an intentional separate item.
  await page.evaluate(() => {
    const photos = snippetRoots[0].querySelector('.photos');
    photos.insertAdjacentHTML('beforeend', '<a href="/examples/assets/one.svg" data-nl-gallery="product">Другой ракурс</a>');
  });
  await page.getByText('Другой ракурс', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('3 / 3');
});

test('InSales updates an open variant, keeps photo links working and closes empty media', async ({ page }) => {
  await page.getByText('Первое A', { exact: true }).click();
  await page.evaluate(() => emitVariant(snippetRoots[0], [{ large_url: '/examples/assets/two.svg' }]));
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 1');
  await expect(page.locator('.nl-gallery img')).toHaveAttribute('src', /two\.svg$/);
  await page.keyboard.press('Escape');

  // Links and clones matching the new media list still open the gallery.
  await page.getByText('Клон A', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 1');
  await page.keyboard.press('Escape');
  await page.getByText('Второе A', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 1');
  await page.evaluate(() => emitVariant(snippetRoots[0], []));
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');

  // The old slider DOM cannot navigate to media from the previous variant.
  await page.getByText('Первое A', { exact: true }).click();
  await expect(page).toHaveURL(/\/examples\/instances\.html$/);
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  await page.getByText('Первое B', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 2');
});

test('InSales reinitialization and DOM replacement release media, locks and subscriptions', async ({ page }) => {
  await page.getByText('Клон A', { exact: true }).click();
  await page.addScriptTag({ path: snippetPath });
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  expect(await page.evaluate(() => [...busHandlers.values()].map(set => set.size))).toEqual([2, 2]);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');

  await page.getByText('Первое A', { exact: true }).click();
  const result = await page.evaluate(() => {
    const root = snippetRoots[0];
    const scope = NanoLightbox.getScope(root);
    const staleCallbacks = [...busHandlers.get('change_variant:insales:product')];
    root.nanoLightboxCleanup();
    root.replaceChildren();
    scope.destroy(); // Repeated teardown is safe.
    staleCallbacks.forEach(fn => fn({ images: [{ large_url: '/examples/assets/two.svg' }] }));
    return { state: scope.state, registered: !!NanoLightbox.getScope(root), cleanup: !!root.nanoLightboxCleanup, handlers: [...busHandlers.values()].map(set => set.size), lock: document.body.style.position };
  });
  expect(result).toEqual({ state: 'destroyed', registered: false, cleanup: false, handlers: [1, 1], lock: '' });
  await expect(page.locator('.nl-gallery, #snippet-A iframe, #snippet-A video')).toHaveCount(0);
  await page.getByText('Первое B', { exact: true }).click();
  await expect(page.locator('.nl-gallery .nl-count')).toHaveText('1 / 2');
});

test('InSales preserves modifier clicks on clone and array-backed photo links', async ({ page }) => {
  const prevented = await page.evaluate(() => {
    const link = snippetRoots[0].querySelector('.splide__slide--clone a');
    const dispatch = () => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
      link.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const dom = dispatch();
    emitVariant(snippetRoots[0], [{ large_url: '/examples/assets/two.svg' }]);
    return [dom, dispatch()];
  });
  expect(prevented).toEqual([false, false]);
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
});

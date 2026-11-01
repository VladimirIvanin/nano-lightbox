import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/examples/instances.html'); });

test('script is standalone, scopes and equal group names are isolated', async ({ page }) => {
  const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
  expect(scripts).toHaveLength(1);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.js')).map(entry => new URL(entry.name).pathname))).toEqual(['/browser-build/nano-lightbox.min.js']);
  await page.getByText('Фото A2', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('2 / 2');
  await expect(page.locator('section').nth(0).locator('output')).toHaveText('Событий: 1');
  await expect(page.locator('section').nth(1).locator('output')).toHaveText('Событий: 0');
  await page.keyboard.press('Escape');
  await page.getByText('Фото B1', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 2');
  expect(await page.evaluate(() => NanoLightbox.createScope(document.querySelector('section')) === NanoLightbox.getScope(document.querySelector('section')))).toBe(true);
});

test('events precede first change, unsubscribe, once and abort are persistent', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const root = document.querySelector('section'), scope = NanoLightbox.getScope(root);
    const gallery = scope.gallery(root.querySelector('.photos'));
    const events = [], abort = new AbortController();
    gallery.on('beforeopen', () => events.push('beforeopen'));
    gallery.on('open', () => events.push('open'));
    const remove = gallery.on('change', () => events.push('removed')); remove();
    gallery.on('change', () => events.push('aborted'), { signal: abort.signal }); abort.abort();
    gallery.on('change', () => events.push('once'), { once: true });
    gallery.on('change', () => events.push('change'));
    gallery.on('close', event => { if (!(event.detail.dialog instanceof HTMLDialogElement)) throw new Error('Close event must retain its dialog'); });
    await gallery.open(0); gallery.goTo(0); gallery.next(); gallery.close();
    await gallery.open(0); gallery.close();
    return events;
  });
  expect(result).toEqual(['beforeopen', 'open', 'once', 'change', 'change', 'beforeopen', 'open', 'change']);
});

test('opening cancellation, promise deduplication and destroy during opening', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const root = document.querySelector('section'), scope = NanoLightbox.getScope(root);
    const gallery = scope.gallery(root.querySelector('.photos'));
    const remove = gallery.on('beforeopen', event => event.preventDefault());
    const cancelled = await gallery.open(0); remove();
    const first = gallery.open(0), same = first === gallery.open(1);
    scope.destroy();
    return { cancelled, same, opened: await first, state: gallery.state, exists: !!NanoLightbox.getScope(root), lock: document.body.style.position };
  });
  expect(result).toEqual({ cancelled: false, same: true, opened: false, state: 'destroyed', exists: false, lock: '' });
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
});

test('gallery replacement respects cancellation and scope cleanup forces teardown', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const roots = [...document.querySelectorAll('section')];
    const scopes = roots.map(root => NanoLightbox.getScope(root));
    const [a, b] = scopes.map((scope, i) => scope.gallery(roots[i].querySelector('.photos')));
    await a.open(0);
    const remove = a.on('beforeclose', event => event.preventDefault());
    const blocked = await b.open(0); remove();
    const opened = await b.open(0);
    b.on('beforeclose', event => event.preventDefault());
    const cleanups = [];
    scopes[1].addCleanup(() => { cleanups.push(1); throw new Error('test cleanup'); });
    scopes[1].addCleanup(() => cleanups.push(2));
    let error;
    try { scopes[1].destroy(); } catch (cause) { error = cause.name; }
    scopes[1].destroy(); roots[1].remove();
    return { blocked, opened, a: a.state, b: b.state, cleanups, error, lock: document.body.style.position };
  });
  expect(result).toEqual({ blocked: false, opened: true, a: 'closed', b: 'destroyed', cleanups: [1, 2], error: 'AggregateError', lock: '' });
});

test('nested modal restores focus and keeps scroll locked until parent closes', async ({ page }) => {
  await page.getByText('Быстрый просмотр A', { exact: true }).click();
  await page.getByText('Фото в быстром просмотре A', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 1');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Фото в быстром просмотре A', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Быстрый просмотр A', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('parent close also closes its gallery, explicit destruction retains authored dialog', async ({ page }) => {
  await page.getByText('Быстрый просмотр A', { exact: true }).click();
  await page.getByText('Фото в быстром просмотре A', { exact: true }).click();
  await page.evaluate(() => {
    const root = document.querySelector('section'), scope = NanoLightbox.getScope(root);
    scope.modal(root.querySelector('dialog')).close();
    scope.destroy();
  });
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  await expect(page.locator('#preview-a')).toHaveCount(1);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('DOM refresh, late insertion, JS arrays and empty lists', async ({ page }) => {
  await page.evaluate(() => {
    const root = document.querySelector('section');
    root.querySelector('.photos').insertAdjacentHTML('beforeend', '<a href="./assets/one.svg" data-nl-gallery="product">AJAX</a>');
  });
  await page.getByText('AJAX', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('3 / 3');
  await page.evaluate(() => {
    const root = document.querySelector('section'), gallery = NanoLightbox.getScope(root).gallery(root.querySelector('.photos'));
    gallery.refresh(); window.testGallery = gallery;
  });
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('3 / 3');
  await page.evaluate(() => { document.querySelector('.photos a:last-child').remove(); testGallery.refresh(); });
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 2');
  await page.evaluate(() => testGallery.setItems([{ src: './assets/two.svg', caption: 'Variant' }]));
  await expect(page.locator('.nl-gallery .nl-footer')).toContainText('Variant');
  await page.evaluate(() => testGallery.setItems([]));
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
});

test('nested registered galleries and auto.js do not handle each other’s clicks', async ({ page }) => {
  await page.evaluate(async () => {
    await import('/dist/auto.js');
    const root = document.querySelector('section'), scope = NanoLightbox.getScope(root);
    const nested = document.createElement('div'); nested.innerHTML = '<a href="./assets/one.svg" data-nl-gallery="product">Nested</a>';
    root.querySelector('.photos').append(nested); scope.gallery(nested);
  });
  await page.getByText('Nested', { exact: true }).click();
  await expect(page.locator('.nl-gallery')).toHaveCount(1);
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 1');
  await page.keyboard.press('Escape');
  await page.getByText('Фото A1', { exact: true }).click();
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 2');
});

test('per-controller options apply next time and close button works with closedby none', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.querySelector('section');
    const gallery = NanoLightbox.getScope(root).gallery(root.querySelector('.photos'));
    gallery.setOptions({ closedby: 'none', labels: { close: 'Закрыть A' } });
    await gallery.open(0);
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('.nl-gallery')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть A', exact: true }).click();
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  await page.getByText('Фото B1', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close gallery', exact: true })).toBeVisible();
});

test('native parent closure frees both sessions and restores the outer opener', async ({ page }) => {
  await page.getByText('Быстрый просмотр A', { exact: true }).click();
  await page.getByText('Фото в быстром просмотре A', { exact: true }).click();
  await page.evaluate(() => document.getElementById('preview-a').close());
  await expect(page.locator('.nl-gallery')).toHaveCount(0);
  await expect(page.getByText('Быстрый просмотр A', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('destroy removes video and iframe media, and rejects stale callbacks', async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/html' }));
  await page.evaluate(async () => {
    const root = document.querySelector('section');
    window.mediaGallery = NanoLightbox.getScope(root).gallery(root.querySelector('.photos'));
    mediaGallery.setItems([{ src: '/movie.mp4' }, { src: 'https://youtu.be/M7lc1UVf-VE' }]);
    await mediaGallery.open(0);
  });
  await expect(page.locator('.nl-gallery video')).toHaveCount(1);
  await page.evaluate(() => mediaGallery.next());
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.nl-gallery iframe')).toHaveCount(1);
  await page.evaluate(() => { NanoLightbox.getScope(document.querySelector('section')).destroy(); mediaGallery.next(); });
  await expect(page.locator('iframe, video, .nl-gallery')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('ESM and script share scopes and coordinate with unscoped auto galleries', async ({ page }) => {
  const same = await page.evaluate(async () => {
    const esm = await import('/dist/instances.js');
    await import('/dist/auto.js');
    const root = document.querySelector('section');
    document.body.insertAdjacentHTML('beforeend', '<a id="outside" href="./assets/one.svg" data-nl-gallery="product">Outside</a>');
    return esm.createScope(root) === NanoLightbox.getScope(root);
  });
  expect(same).toBe(true);
  await page.getByText('Фото A1', { exact: true }).click();
  await page.evaluate(() => document.getElementById('outside').click());
  await expect(page.locator('.nl-gallery')).toHaveCount(1);
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 1');
  await page.evaluate(() => document.querySelector('.photos a').click());
  await expect(page.locator('.nl-gallery')).toHaveCount(1);
  await expect(page.locator('.nl-gallery [aria-live]')).toHaveText('1 / 2');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('InSales snippet handles synchronous replay and repeated initialization without leaks', async ({ page }) => {
  await page.evaluate(() => {
    window.snippetRoots = [1, 2].map(id => {
      const root = document.createElement('section');
      root.dataset.widgetDropItemId = String(id);
      root.innerHTML = '<form data-product-id="42"><div class="photos"><a href="/examples/assets/one.svg" data-nl-gallery="product">Image</a></div><button type="button" data-open-variant-gallery>Open variant</button></form>';
      document.body.append(root); return root;
    });
    window.$widget = { each(fn) { snippetRoots.forEach((root, index) => fn(index, root)); } };
    const replay = { action: { product: [snippetRoots[0].querySelector('form')] }, images: [{ large_url: '/examples/assets/two.svg' }], title: 'Replay' };
    window.busHandlers = new Map();
    window.EventBus = {
      subscribe(name, fn) {
        if (!busHandlers.has(name)) busHandlers.set(name, new Set());
        busHandlers.get(name).add(fn);
        if (name.startsWith('change_variant')) fn(replay);
      },
      unsubscribe(name, fn) { busHandlers.get(name)?.delete(fn); }
    };
  });
  const path = new URL('../../examples/insales/snippet.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
  await page.addScriptTag({ path });
  await page.addScriptTag({ path });
  expect(await page.evaluate(() => [...busHandlers.values()].map(set => set.size))).toEqual([2, 2]);
  const result = await page.evaluate(async () => {
    const first = NanoLightbox.getScope(snippetRoots[0]).gallery(snippetRoots[0].querySelector('.photos'));
    const second = NanoLightbox.getScope(snippetRoots[1]).gallery(snippetRoots[1].querySelector('.photos'));
    const lengths = [first.items.length, second.items.length];
    await first.open(0);
    snippetRoots.forEach(root => { root.nanoLightboxCleanup(); root.remove(); });
    return { lengths, handlers: [...busHandlers.values()].map(set => set.size), lock: document.body.style.position };
  });
  expect(result).toEqual({ lengths: [1, 0], handlers: [0, 0], lock: '' });
});

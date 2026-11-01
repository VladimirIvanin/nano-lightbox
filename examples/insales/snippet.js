/* Зависимости виджета: jquery, commonjs_v2 и nano-lightbox.js.
 * Разметка: .photos со ссылками a[data-nl-gallery], [data-product-id].
 * .photos содержит текущие слайды; .js-product-all-images — исходники.
 * Для другого слайдера адаптируйте cloneSelector под его разметку.
 * change_variant в этом примере передаёт нормализованные data.images;
 * преобразуйте реальное событие магазина к этому списку медиа.
 * Владелец DOM обязан вызвать root.nanoLightboxCleanup() перед удалением
 * или заменой корня, затем повторно запустить initializer после вставки.
 */
$widget.each(function (_, root) {
  NanoLightbox.getScope(root)?.destroy();
  const photos = root.querySelector('.photos');
  if (!photos) return;
  const scope = NanoLightbox.createScope(root);
  const cloneSelector = '.splide__slide--clone';
  const selector = `a[data-nl-gallery]:not(${cloneSelector} a):not(.js-product-all-images a)`;
  const gallery = scope.gallery(photos, { thumbs: true, selector });
  const widgetItemId = root.getAttribute('data-widget-drop-item-id');
  const form = root.querySelector('[data-product-id]');
  let variantItems = null;

  // Всё состояние готово ДО subscribe: EventBus может сразу вызвать callback.
  gallery.on('error', event => console.error('Gallery', widgetItemId, event.detail.error));
  const changeVariant = data => {
    if (scope.state === 'destroyed' || !form || data?.action?.product?.[0] !== form) return;
    const images = data.images || [];
    variantItems = images.map(image => ({ src: image.large_url, thumb: image.small_url, alt: data.title || '' }));
    gallery.setItems(variantItems); // Обновляет в том числе уже открытый диалог.
  };
  const changeSetting = data => {
    if (scope.state === 'destroyed' || String(data?.widget_item_id) !== widgetItemId) return;
    if (data.setting_name === 'gallery-thumbs') gallery.setOptions({ thumbs: data.value === true || data.value === 'true' });
  };
  const variantEvent = 'change_variant:insales:product';
  const settingEvent = 'widget:change-setting:insales:system:editor';
  scope.addCleanup(() => EventBus.unsubscribe(variantEvent, changeVariant));
  scope.addCleanup(() => EventBus.unsubscribe(settingEvent, changeSetting));
  const clicks = new AbortController();
  root.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target.closest?.('a, [data-open-variant-gallery]');
    if (!target) return;
    // Вложенный экземпляр виджета сам обрабатывает свои клики.
    for (let node = target; node && node !== root; node = node.parentElement) if (NanoLightbox.getScope(node)) return;
    if (target.hasAttribute('data-open-variant-gallery')) {
      event.preventDefault(); gallery.open(0); return;
    }
    if (!photos.contains(target) || !target.matches('a[data-nl-gallery]') || target.closest('.js-product-all-images') || target.hasAttribute('download') || (target.target && target.target !== '_self')) return;
    if (variantItems) {
      // setItems отключает DOM-делегацию контроллера: находим фото в новом списке.
      const index = variantItems.findIndex(item => new URL(item.src, document.baseURI).href === target.href);
      event.preventDefault();
      if (index >= 0) gallery.open(index); // Устаревшая ссылка не открывает старый вариант.
    } else if (target.closest(cloneSelector)) {
      // Клон остаётся кликабельным, но не становится отдельным слайдом lightbox.
      const original = [...photos.querySelectorAll(selector)].find(link => link.dataset.nlGallery === target.dataset.nlGallery && link.href === target.href && link.dataset.nlType === target.dataset.nlType && link.dataset.nlEmbed === target.dataset.nlEmbed);
      if (original) { event.preventDefault(); gallery.open(original); }
    }
  }, { signal: clicks.signal });
  scope.addCleanup(() => clicks.abort());
  root.nanoLightboxCleanup = () => scope.destroy();
  scope.addCleanup(() => { delete root.nanoLightboxCleanup; });
  // Подписываемся последними: даже синхронный replay видит готовый cleanup.
  EventBus.subscribe(variantEvent, changeVariant);
  EventBus.subscribe(settingEvent, changeSetting);
});

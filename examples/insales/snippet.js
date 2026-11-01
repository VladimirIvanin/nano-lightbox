/* Зависимости виджета: jquery, commonjs_v2 и nano-lightbox.js.
 * Разметка: .photos со ссылками a[data-nl-gallery], [data-product-id].
 * Владелец DOM обязан вызвать root.nanoLightboxCleanup() перед удалением
 * или заменой корня, затем повторно запустить initializer после вставки.
 */
$widget.each(function (_, root) {
  NanoLightbox.getScope(root)?.destroy();
  const scope = NanoLightbox.createScope(root);
  const gallery = scope.gallery(root.querySelector('.photos'), { thumbs: true });
  const widgetItemId = root.getAttribute('data-widget-drop-item-id');
  const form = root.querySelector('[data-product-id]');

  // Всё состояние готово ДО subscribe: EventBus может сразу вызвать callback.
  gallery.on('error', event => console.error('Gallery', widgetItemId, event.detail.error));
  const changeVariant = data => {
    if (scope.state === 'destroyed' || !form || data?.action?.product?.[0] !== form) return;
    const images = data.images || [];
    gallery.setItems(images.map(image => ({ src: image.large_url, thumb: image.small_url, alt: data.title || '' })));
  };
  const changeSetting = data => {
    if (scope.state === 'destroyed' || String(data?.widget_item_id) !== widgetItemId) return;
    if (data.setting_name === 'gallery-thumbs') gallery.setOptions({ thumbs: data.value === true || data.value === 'true' });
  };
  const variantEvent = 'change_variant:insales:product';
  const settingEvent = 'widget:change-setting:insales:system:editor';
  scope.addCleanup(() => EventBus.unsubscribe(variantEvent, changeVariant));
  scope.addCleanup(() => EventBus.unsubscribe(settingEvent, changeSetting));
  EventBus.subscribe(variantEvent, changeVariant);
  EventBus.subscribe(settingEvent, changeSetting);

  // После setItems галерея открывается индексом, например из локальной кнопки.
  const clicks = new AbortController();
  root.addEventListener('click', event => {
    if (event.target.closest('[data-open-variant-gallery]')) gallery.open(0);
  }, { signal: clicks.signal });
  scope.addCleanup(() => clicks.abort());
  root.nanoLightboxCleanup = () => scope.destroy();
  scope.addCleanup(() => { delete root.nanoLightboxCleanup; });
});

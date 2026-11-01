import { open, close } from './core.js';

document.addEventListener('click', async event => {
  const target = event.target.closest?.('[data-nl-open], [data-nl-close], a[data-nl-gallery]');
  if (!target || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const registry = globalThis[Symbol.for('nano-lightbox.instances')];
  if (registry && [...registry.scopes.keys()].some(root => root.contains(target))) return;
  if (target.hasAttribute('data-nl-close')) {
    const dialog = target.closest('dialog');
    if (dialog) { event.preventDefault(); close(dialog); }
  } else if (target.hasAttribute('data-nl-open')) {
    const dialog = document.getElementById(target.dataset.nlOpen);
    if (dialog instanceof HTMLDialogElement) { event.preventDefault(); open(dialog, target); }
  } else if (!target.download && (!target.target || target.target === '_self')) {
    event.preventDefault();
    try {
      const { openGallery } = await import('./gallery.js');
      await openGallery(target);
    } catch {
      location.assign(target.href);
    }
  }
});

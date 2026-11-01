import { open as openDialog, close as closeDialog, release } from './core.js';
import { resolveMedia } from './providers.js';
import { createGalleryShell, galleryAppearance } from './gallery-shell.js';

// Shared by ESM and classic-script builds, including repeated script loads.
const registry = globalThis[Symbol.for('nano-lightbox.instances')] ||= { scopes: new Map() };
const galleries = globalThis[Symbol.for('nano-lightbox.gallery')] ||= { active: null };
const defaults = { close: 'Close gallery', previous: 'Previous slide', next: 'Next slide', original: 'Open original', gallery: 'Media gallery', unavailable: 'Media unavailable', slide: 'Slide' };

export function getScope(root) { return registry.scopes.get(root); }

export function createScope(root) {
  if (!(root instanceof Element)) throw new TypeError('Scope root must be an Element');
  if (getScope(root)) return getScope(root);
  const controllers = new Map();
  const cleanups = new Set();
  const events = new AbortController();
  let destroyed = false;
  const scope = {
    get root() { return root; },
    get state() { return destroyed ? 'destroyed' : 'ready'; },
    modal(element, options = {}) { return register(element, options, false); },
    gallery(element, options = {}) { return register(element, options, true); },
    addCleanup(fn) {
      if (typeof fn !== 'function') throw new TypeError('Cleanup must be a function');
      if (destroyed) fn(); else cleanups.add(fn);
      return () => cleanups.delete(fn);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      for (const controller of [...controllers.values()].reverse()) controller.destroy();
      const errors = [];
      for (const cleanup of cleanups) { try { cleanup(); } catch (error) { errors.push(error); } }
      cleanups.clear();
      registry.scopes.delete(root);
      root = null;
      if (errors.length) throw new AggregateError(errors, 'Scope cleanup failed');
    }
  };
  function register(element, options, gallery) {
    if (destroyed) throw new Error('Scope is destroyed');
    if (!(element instanceof Element) || !root.contains(element)) throw new TypeError('Controller element must belong to its scope');
    if (!gallery && !(element instanceof HTMLDialogElement)) throw new TypeError('Modal must be a dialog');
    if (controllers.has(element)) return controllers.get(element);
    const controller = createController(scope, element, options, gallery, () => controllers.delete(element), owns);
    controllers.set(element, controller);
    return controller;
  }
  function owns(node, container) {
    for (let current = node; current; current = current.parentElement) {
      if (current === container) return true;
      if (controllers.has(current) || (current !== root && getScope(current))) return false;
    }
    return false;
  }
  root.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target.closest?.('[data-nl-open], [data-nl-close], a');
    if (!target) return;
    // The nearest scope owns the event.
    for (let node = target; node && node !== root; node = node.parentElement) if (getScope(node)) return;
    if (target.hasAttribute('data-nl-close')) {
      const controller = controllers.get(target.closest('dialog'));
      if (controller) { event.preventDefault(); controller.close('button'); }
    } else if (target.hasAttribute('data-nl-open')) {
      const dialog = [...controllers.keys()].find(node => node instanceof HTMLDialogElement && node.id === target.dataset.nlOpen);
      if (dialog) { event.preventDefault(); controllers.get(dialog).open(target); }
    } else if (!target.download && (!target.target || target.target === '_self')) {
      for (let node = target; node; node = node.parentElement) {
        const controller = controllers.get(node);
        if (controller?.isGallery && controller.matches(target)) {
          event.preventDefault(); controller.open(target); break;
        }
        if (node === root) break;
      }
    }
  }, { signal: events.signal });
  registry.scopes.set(root, scope);
  return scope;
}

function createController(scope, container, initial, isGallery, unregister, owns) {
  let options = { closedby: 'any', returnFocus: true, selector: 'a[data-nl-gallery]', ...initial, labels: { ...initial.labels }, ...(initial.items ? { items: initial.items.map(item => ({ ...item })) } : {}) };
  let applied, dialog = isGallery ? null : container, state = 'closed', pending, generation = 0;
  let items = [], index = -1, trigger, parent, view, lifecycle;
  let listeners = new Map();
  const target = new EventTarget();
  const controller = {
    isGallery,
    get state() { return state; },
    get dialog() { return dialog; },
    get index() { return index; },
    get items() { return items.map(item => ({ ...item })); },
    get parent() { return parent; },
    matches(node) { return !options.items && node.matches(options.selector) && owns(node, container); },
    setOptions(next) {
      if (state === 'destroyed') return;
      options = { ...options, ...next, labels: { ...options.labels, ...next.labels } };
      if (next.items) options.items = next.items.map(item => ({ ...item }));
    },
    on(name, handler, settings = {}) {
      if (state === 'destroyed' || settings.signal?.aborted) return () => {};
      const remove = () => { target.removeEventListener(name, wrapped); settings.signal?.removeEventListener('abort', remove); listeners.get(name)?.delete(remove); };
      const wrapped = event => { if (settings.once) remove(); handler(event); };
      if (!listeners.has(name)) listeners.set(name, new Map());
      listeners.get(name).set(remove, handler);
      target.addEventListener(name, wrapped);
      settings.signal?.addEventListener('abort', remove, { once: true });
      return remove;
    },
    off(name, handler) { for (const [remove, fn] of listeners.get(name) || []) if (!handler || fn === handler) remove(); },
    open(input) {
      if (pending) return pending;
      if (state === 'destroyed') return Promise.resolve(false);
      if (state === 'open') return Promise.resolve(true);
      const token = ++generation;
      state = 'opening';
      pending = Promise.resolve().then(() => {
        if (state !== 'opening' || token !== generation) return false;
        applied = { ...(isGallery ? galleryAppearance(input instanceof Element ? input : container, options) : options), labels: { ...defaults, ...options.labels } };
        trigger = input instanceof Element ? input : document.activeElement;
        if (isGallery) {
          items = readItems(input);
          index = input instanceof Element ? items.findIndex(item => item.element === input) : (input ?? 0);
          if (!items.length || !Number.isInteger(index) || index < 0 || index >= items.length) { state = 'closed'; return false; }
        }
        if (!emit('beforeopen', {}, true) || token !== generation) { if (state !== 'destroyed') state = 'closed'; return false; }
        if (isGallery && galleries.active && galleries.active !== controller && !galleries.active.close('replace')) { state = 'closed'; return false; }
        if (token !== generation || !container.isConnected) { if (state !== 'destroyed') state = 'closed'; return false; }
        parent = trigger?.closest('dialog');
        lifecycle = new AbortController();
        if (isGallery) {
          dialog = document.createElement('dialog');
          dialog.className = 'nl-gallery';
          dialog.setAttribute('aria-label', applied.labels.gallery);
          document.body.append(dialog);
        }
        dialog.setAttribute('closedby', applied.closedby);
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (applied.closedby !== 'none') controller.close('cancel'); }, { signal: lifecycle.signal });
        dialog.addEventListener('close', () => { if (!dialog?.open) finish('native'); }, { signal: lifecycle.signal });
        if (parent && parent !== dialog) parent.addEventListener('close', () => controller.close('parent', true), { signal: lifecycle.signal });
        if (isGallery) view = renderGallery(dialog, items, applied, select, error => emit('error', { error }), () => controller.close('button'));
        openDialog(dialog, applied.returnFocus ? trigger : null);
        state = 'open';
        if (isGallery) galleries.active = controller;
        emit('open');
        if (state === 'open' && isGallery) { view.go(index); emit('change'); }
        return state === 'open';
      }).catch(error => {
        if (state !== 'destroyed') { finish('error'); emit('error', { error }); }
        return false;
      }).finally(() => { pending = null; });
      return pending;
    },
    close(reason = 'api', force = false) {
      if (state === 'closed' || state === 'destroyed') return true;
      if (!force && !emit('beforeclose', { reason }, true)) return false;
      const child = galleries.active;
      if (!isGallery && child?.parent === dialog && !child.close('parent', force)) return false;
      ++generation;
      finish(reason);
      return true;
    },
    destroy() {
      if (state === 'destroyed') return;
      controller.close('destroy', true);
      state = 'destroyed';
      emit('destroy');
      for (const name of listeners.keys()) controller.off(name);
      listeners.clear();
      unregister();
      unregister = null;
      container = dialog = trigger = parent = null;
      items = [];
      options = applied = null;
    }
  };
  function emit(name, detail = {}, cancelable = false) {
    return target.dispatchEvent(new CustomEvent(name, { cancelable, detail: { controller, scope, dialog, index, item: items[index], element: items[index]?.element, ...detail } }));
  }
  function readItems(input) {
    const settings = state === 'open' ? applied : options;
    if (settings.items) return settings.items.map(item => ({ ...item }));
    const group = input instanceof Element ? input.dataset.nlGallery : trigger?.dataset.nlGallery;
    return [...container.querySelectorAll(settings.selector)].filter(link => owns(link, container) && (group ? link.dataset.nlGallery === group : input instanceof Element ? link === input : true)).map(link => ({
      src: link.href, type: link.dataset.nlType, embed: link.dataset.nlEmbed, caption: link.dataset.nlCaption, alt: link.dataset.nlAlt || link.querySelector('img')?.alt,
      thumb: link.dataset.nlThumb || link.querySelector('img')?.src, element: link
    }));
  }
  function finish(reason) {
    if (state === 'closed' || state === 'destroyed') return;
    if (!isGallery && galleries.active?.parent === dialog) galleries.active.close('parent', true);
    const closedDialog = dialog;
    lifecycle?.abort();
    view?.destroy(); view = null;
    if (dialog) { if (dialog.open) closeDialog(dialog); else release(dialog); }
    state = 'closed';
    if (galleries.active === controller) galleries.active = null;
    if (isGallery) { dialog?.remove(); dialog = null; }
    emit('close', { reason, dialog: closedDialog });
    parent = trigger = null;
  }
  function select(next) {
    if (state !== 'open' || !Number.isInteger(next) || next < 0 || next >= items.length || next === index) return;
    index = next; view.go(index); emit('change');
  }
  if (isGallery) Object.assign(controller, {
    goTo: select, next: () => select(index + 1), prev: () => select(index - 1),
    refresh() {
      if (state === 'destroyed' || (state === 'open' ? applied.items : options.items)) return;
      const old = items[index]?.element;
      items = readItems(trigger);
      rebuild(Math.max(0, items.findIndex(item => item.element === old)));
    },
    setItems(next) {
      if (state === 'destroyed') return;
      if (!Array.isArray(next)) throw new TypeError('Items must be an array');
      options.items = next.map(item => ({ ...item }));
      if (state === 'open') applied.items = options.items;
      items = options.items.map(item => ({ ...item }));
      rebuild(0);
    }
  });
  function rebuild(next) {
    if (state !== 'open') return;
    if (!items.length) { controller.close('empty', true); return; }
    index = next;
    view.destroy(); dialog.replaceChildren();
    view = renderGallery(dialog, items, applied, select, error => emit('error', { error }), () => controller.close('button'));
    view.go(index); emit('change');
  }
  return controller;
}

function renderGallery(dialog, items, options, select, error, close) {
  const abort = new AbortController();
  const labels = options.labels;
  const button = (label, text, action) => {
    const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.setAttribute('aria-label', label);
    node.addEventListener('click', action, { signal: abort.signal }); return node;
  };
  let current = -1, timer;
  const { track, caption, updateControls } = createGalleryShell(dialog, options, labels, {
    dismiss: close, previous: () => select(current - 1), next: () => select(current + 1)
  }, items.length);
  const slides = items.map(() => { const node = document.createElement('div'); node.className = 'nl-slide'; node.inert = true; track.append(node); return node; });
  const thumbs = [];
  if (options.thumbs) {
    const strip = document.createElement('div'); strip.className = 'nl-thumbs';
    items.forEach((item, i) => {
      const node = button(`${labels.slide} ${i + 1}`, String(i + 1), () => select(i));
      if (item.thumb) { const img = document.createElement('img'); img.src = item.thumb; img.alt = ''; img.loading = 'lazy'; node.replaceChildren(img); }
      strip.append(node); thumbs.push(node);
    });
    (dialog.querySelector('.nl-thumbs-slot') || dialog).append(strip);
  }
  function clear(node) {
    const video = node.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    node.replaceChildren(); node.inert = true;
  }
  function go(index) {
    clearTimeout(timer);
    if (current !== index) {
      if (current >= 0) clear(slides[current]);
      current = index;
      const item = items[index], slide = slides[index]; slide.inert = false;
      try {
        const media = resolveMedia(item.src, { type: item.type, embed: item.embed });
        const node = document.createElement(media.type === 'image' ? 'img' : media.type === 'video' ? 'video' : 'iframe');
        if (media.type === 'image') { node.alt = item.alt || ''; node.addEventListener('error', () => { slide.textContent = labels.unavailable; error(new Error('Image unavailable')); }, { signal: abort.signal, once: true }); }
        else if (media.type === 'video') { node.controls = true; node.playsInline = true; node.preload = 'metadata'; if (item.thumb) node.poster = item.thumb; }
        else { node.title = item.caption || labels.gallery; node.allowFullscreen = true; node.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; }
        node.src = media.src; slide.append(node);
        const url = new URL(item.src, document.baseURI);
        if (['http:', 'https:'].includes(url.protocol)) { const link = document.createElement('a'); link.className = 'nl-original'; link.href = url.href; link.textContent = labels.original; link.target = '_blank'; link.rel = 'noopener'; slide.append(link); }
      } catch (cause) { slide.textContent = labels.unavailable; error(cause); }
      caption.textContent = item.caption || '';
      updateControls(index);
      thumbs.forEach((node, i) => node.setAttribute('aria-current', String(i === index)));
      const thumb = thumbs[index];
      if (thumb) thumb.parentElement.scrollTo({ left: thumb.offsetLeft - thumb.parentElement.offsetLeft - (thumb.parentElement.clientWidth - thumb.clientWidth) / 2, behavior: 'instant' });
      dialog.dispatchEvent(new CustomEvent('nl:change', { detail: { index } }));
    }
    track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' });
  }
  track.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(() => { if (track.clientWidth) select(Math.max(0, Math.min(items.length - 1, Math.round(track.scrollLeft / track.clientWidth)))); }, 140); }, { signal: abort.signal });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, video, iframe, [contenteditable]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select(current + (event.key === 'ArrowRight' ? 1 : -1)); }
  }, { signal: abort.signal });
  const observer = new ResizeObserver(() => { if (current >= 0) go(current); }); observer.observe(track);
  return { go, destroy() { abort.abort(); clearTimeout(timer); observer.disconnect(); slides.forEach(clear); } };
}

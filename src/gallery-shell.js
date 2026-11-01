// Both entry points use the same chrome; templates replace only this shell.
export function createGalleryShell(dialog, options, labels, actions, length) {
  const template = typeof options.template === 'string' ? document.querySelector(options.template) : options.template;
  if (options.template && !(template instanceof HTMLTemplateElement)) throw new TypeError('Gallery template must be a <template> or its selector');
  if (template) dialog.append(template.content.cloneNode(true));
  else dialog.innerHTML = `<div class="nl-toolbar"><span class="nl-count"></span><button class="nl-dismiss"></button></div><div class="nl-stage"><div class="nl-track"></div><button class="nl-previous"></button><button class="nl-next"></button></div><div class="nl-footer"><span class="nl-caption"></span></div>`;
  const parts = {};
  for (const name of ['track', 'caption', 'count', 'dismiss', 'previous', 'next']) {
    const nodes = dialog.querySelectorAll(`.nl-${name}`);
    if (nodes.length !== 1) throw new TypeError(`Gallery template needs exactly one .nl-${name}`);
    parts[name] = nodes[0];
  }
  if (parts.track.childElementCount) throw new TypeError('Gallery template track must be empty');
  const paths = { dismiss: 'm6 6 12 12M6 18 18 6', previous: 'm15 6-6 6 6 6', next: 'm9 6 6 6-6 6' };
  for (const name of ['dismiss', 'previous', 'next']) {
    const button = parts[name];
    if (!(button instanceof HTMLButtonElement)) throw new TypeError(`.nl-${name} must be a button`);
    button.type = 'button';
    const label = labels[name === 'dismiss' ? 'close' : name];
    button.setAttribute('aria-label', label);
    button.title = label;
    if (!button.innerHTML.trim()) button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[name]}"/></svg>`;
    button.addEventListener('click', actions[name]);
  }
  parts.dismiss.autofocus = true;
  parts.previous.hidden = parts.next.hidden = length === 1;
  parts.count.setAttribute('aria-live', 'polite');
  parts.count.setAttribute('aria-atomic', 'true');
  // Fullscreen dialogs have no outside area. Treat the empty stage as backdrop,
  // but never close after a swipe or a drag starting on media.
  let pressed;
  const empty = event => event.target === parts.track || event.target.classList.contains('nl-slide');
  parts.track.addEventListener('pointerdown', event => { pressed = event.button === 0 && empty(event) ? event : null; });
  parts.track.addEventListener('pointercancel', () => { pressed = null; });
  parts.track.addEventListener('pointerup', event => {
    const start = pressed;
    pressed = null;
    if (start?.pointerId === event.pointerId && empty(event) && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 8 && dialog.getAttribute('closedby')?.toLowerCase() === 'any' && dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) actions.dismiss();
  });
  if (options.className) dialog.classList.add(...options.className.trim().split(/\s+/).filter(Boolean));
  dialog.dataset.nlTheme = options.theme || 'dark';
  return { ...parts, updateControls(index) {
    const focused = document.activeElement;
    parts.count.textContent = `${index + 1} / ${length}`;
    parts.previous.disabled = index === 0;
    parts.next.disabled = index === length - 1;
    // Disabling the focused edge button otherwise drops keyboard navigation
    // outside the dialog in Chromium and Firefox.
    if (focused === parts.previous && focused.disabled) (parts.next.disabled ? parts.dismiss : parts.next).focus({ preventScroll: true });
    if (focused === parts.next && focused.disabled) (parts.previous.disabled ? parts.dismiss : parts.previous).focus({ preventScroll: true });
  } };
}

export function galleryAppearance(trigger, options = {}) {
  const inherited = {};
  for (const name of ['theme', 'template', 'class']) {
    inherited[name === 'class' ? 'className' : name] = trigger.closest(`[data-nl-${name}]`)?.getAttribute(`data-nl-${name}`);
  }
  return { ...inherited, ...options };
}

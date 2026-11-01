const shared = globalThis[Symbol.for('nano-lightbox.core')] ||= { sessions: new Map() };
const { sessions } = shared;

export function release(dialog) {
  const session = sessions.get(dialog);
  if (!sessions.delete(dialog)) return;
  session.controller.abort();
  if (!sessions.size) {
    const [body, root, x, y] = shared.saved;
    document.body.style.cssText = body;
    document.documentElement.style.cssText = root;
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  }
  if (session.opener?.isConnected && (!sessions.size || [...sessions.keys()].pop().contains(session.opener))) session.opener.focus({ preventScroll: true });
}

export function open(dialog, opener = document.activeElement) {
  if (dialog.open) return;
  release(dialog);
  const x = scrollX;
  const y = scrollY;
  dialog.showModal();
  if (!sessions.size) {
    const { body, documentElement: root } = document;
    shared.saved = [body.style.cssText, root.style.cssText, x, y];
    const gap = innerWidth - root.clientWidth;
    body.style.position = 'fixed';
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = '100%';
    body.style.boxSizing = 'border-box';
    body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gap}px`;
    root.style.overflow = 'hidden';
  }
  const controller = new AbortController();
  const options = { signal: controller.signal };
  sessions.set(dialog, { opener, controller });
  dialog.addEventListener('close', () => { if (!dialog.open) release(dialog); }, options);
  if (!dialog.hasAttribute('closedby')) dialog.setAttribute('closedby', 'any');
  if (!('closedBy' in dialog)) {
    const mode = () => dialog.getAttribute('closedby')?.toLowerCase();
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    let pressed = null;
    dialog.addEventListener('cancel', event => { if (mode() === 'none') event.preventDefault(); }, options);
    dialog.addEventListener('pointerdown', event => { pressed = event.button === 0 && outside(event) ? event.pointerId : null; }, options);
    dialog.addEventListener('pointerup', event => {
      if (pressed === event.pointerId && outside(event) && mode() === 'any' && dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) close(dialog);
      pressed = null;
    }, options);
    dialog.addEventListener('pointercancel', () => { pressed = null; }, options);
  }
}

export function close(dialog, value) {
  dialog.close(value);
  release(dialog);
}

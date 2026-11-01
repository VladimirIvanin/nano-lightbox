export function createThumbs(dialog, links, go) {
  const strip = document.createElement('div');
  strip.className = 'nl-thumbs';
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Choose slide');
  const buttons = links.map((link, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Slide ${index + 1}`);
    const src = link.dataset.nlThumb || link.querySelector('img')?.currentSrc || link.querySelector('img')?.src;
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      button.append(img);
    } else button.textContent = index + 1;
    button.addEventListener('click', () => go(index));
    strip.append(button);
    return button;
  });
  dialog.append(strip);
  return selected => {
    buttons.forEach((button, index) => button.setAttribute('aria-current', String(index === selected)));
    const button = buttons[selected];
    strip.scrollTo({ left: button.offsetLeft - strip.offsetLeft - (strip.clientWidth - button.clientWidth) / 2, behavior: 'instant' });
  };
}

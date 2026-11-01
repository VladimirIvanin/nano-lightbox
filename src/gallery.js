import { open, close } from './core.js';
import { resolveMedia } from './providers.js';
import { createGalleryShell, galleryAppearance } from './gallery-shell.js';

let active;
let opening = false;
const galleries = globalThis[Symbol.for('nano-lightbox.gallery')] ||= { active: null };

export async function openGallery(trigger, options = {}) {
  if (opening || active?.open) return;
  opening = true;
  try {
    const group = trigger.dataset.nlGallery;
    const scopes = globalThis[Symbol.for('nano-lightbox.instances')]?.scopes;
    const links = group ? [...document.querySelectorAll('a[data-nl-gallery]')].filter(link => link.dataset.nlGallery === group && ![...(scopes?.keys() || [])].some(root => root.contains(link))) : [trigger];
    let index = links.indexOf(trigger);
    if (index < 0) throw new Error('Gallery trigger must be in the document');
    const dialog = document.createElement('dialog');
    dialog.className = 'nl-gallery';
    dialog.setAttribute('aria-label', trigger.dataset.nlLabel || 'Media gallery');
    const { track, caption, updateControls } = createGalleryShell(dialog, galleryAppearance(trigger, options), {
      close: 'Close gallery', previous: 'Previous slide', next: 'Next slide'
    }, { dismiss: () => close(dialog), previous: () => go(index - 1), next: () => go(index + 1) }, links.length);
    const slides = links.map(() => {
      const slide = document.createElement('div');
      slide.className = 'nl-slide';
      slide.inert = true;
      track.append(slide);
      return slide;
    });
    let updateThumbs = () => {};
    let timer;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    function clear(slide) {
      const video = slide.querySelector('video');
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
      slide.replaceChildren();
      slide.inert = true;
    }

    function select(selected) {
      clearTimeout(timer);
      if (selected !== index) clear(slides[index]);
      index = selected;
      const slide = slides[index];
      const link = links[index];
      slide.inert = false;
      if (!slide.childElementCount) {
        try {
          const media = resolveMedia(link.href, { type: link.dataset.nlType, embed: link.dataset.nlEmbed });
          const element = document.createElement(media.type === 'image' ? 'img' : media.type === 'video' ? 'video' : 'iframe');
          if (media.type === 'image') {
            element.alt = link.dataset.nlAlt || link.querySelector('img')?.alt || '';
            element.addEventListener('error', () => { slide.textContent = 'Image unavailable'; }, { once: true });
          } else if (media.type === 'video') {
            element.controls = true;
            element.playsInline = true;
            element.preload = 'metadata';
            if (link.dataset.nlThumb) element.poster = link.dataset.nlThumb;
          } else {
            element.title = link.dataset.nlCaption || 'Video player';
            element.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
            element.allowFullscreen = true;
          }
          element.src = media.src;
          slide.append(element);
        } catch {
          slide.textContent = 'Media unavailable';
        }
        const original = document.createElement('a');
        original.className = 'nl-original';
        original.href = link.href;
        original.textContent = 'Open original';
        original.target = '_blank';
        original.rel = 'noopener';
        if (['http:', 'https:'].includes(new URL(link.href).protocol)) slide.append(original);
      }
      caption.textContent = link.dataset.nlCaption || '';
      updateControls(index);
      updateThumbs(index);
      dialog.dispatchEvent(new CustomEvent('nl:change', { detail: { index } }));
    }

    function go(selected) {
      if (selected < 0 || selected >= links.length) return;
      select(selected);
      track.scrollTo({ left: selected * track.clientWidth, behavior: reduced() ? 'instant' : 'smooth' });
    }

    // Wait for native snapping to settle before activating media during a swipe.
    track.addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(() => select(Math.max(0, Math.min(links.length - 1, Math.round(track.scrollLeft / track.clientWidth)))), 140);
    });
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, video, iframe, [contenteditable]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        go(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    const observer = new ResizeObserver(() => {
      track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' });
    });
    dialog.addEventListener('close', () => {
      clearTimeout(timer);
      observer.disconnect();
      slides.forEach(clear);
      dialog.remove();
      if (active === dialog) active = undefined;
    }, { once: true });
    if (trigger.closest('[data-nl-thumbs]')) {
      const { createThumbs } = await import('./thumbs.js');
      updateThumbs = createThumbs(dialog.querySelector('.nl-thumbs-slot') || dialog, links, go);
    }
    if (galleries.active && !galleries.active.close('replace')) { observer.disconnect(); return; }
    document.body.append(dialog);
    active = dialog;
    const session = { close() { close(dialog); dialog.dispatchEvent(new Event('close')); return true; } };
    galleries.active = session;
    dialog.addEventListener('close', () => { if (galleries.active === session) galleries.active = null; }, { once: true });
    open(dialog, trigger);
    select(index);
    track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' });
    observer.observe(track);
    return dialog;
  } finally {
    opening = false;
  }
}

import { close } from '../dist/core.js';

for (const tablist of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  function activate(selected) {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
  }
  tablist.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) activate(tab);
  });
  tablist.addEventListener('keydown', event => {
    const index = tabs.indexOf(document.activeElement);
    const offset = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: tabs.length - index - 1 }[event.key];
    if (offset === undefined || index < 0) return;
    event.preventDefault();
    const tab = tabs[(index + offset + tabs.length) % tabs.length];
    activate(tab);
    tab.focus();
  });
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.closest('.code-block').querySelector('code').textContent);
      button.textContent = 'Скопировано';
    } catch {
      button.textContent = 'Выделите код вручную';
    }
    setTimeout(() => { button.textContent = 'Копировать'; }, 2000);
  });
}

const navigation = [...document.querySelectorAll('.sidebar nav a[href^="#"]')];
const sections = navigation.map(link => document.querySelector(link.hash));
let ticking = false;
function highlight() {
  const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= 160) || sections[0];
  for (const link of navigation) {
    if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  ticking = false;
}
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(highlight); }
}, { passive: true });
highlight();

const menu = document.getElementById('demo-menu');
menu?.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  menu.addEventListener('close', () => { location.hash = link.hash; }, { once: true });
  close(menu);
});

try {
  const response = await fetch(new URL('../dist/sizes.json', import.meta.url));
  if (response.ok) {
    const { gzipBytes } = await response.json();
    for (const node of document.querySelectorAll('[data-size]')) {
      const size = gzipBytes[node.dataset.size];
      node.textContent = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(2)} KiB`;
    }
  }
} catch { /* Keep the last measured sizes when the report is unavailable. */ }

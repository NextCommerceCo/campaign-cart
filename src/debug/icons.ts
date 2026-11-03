const lucide = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const ICONS = {
  logo: '<svg viewBox="0 0 148 148" fill="currentColor" stroke="currentColor" stroke-width="2.5"><path d="M100.143 81.8349L98.205 80.5596L43.8535 44.7978C43.1486 44.378 42.4606 44.1524 41.8457 44.1523C39.8673 44.1523 38.258 45.7609 38.2578 47.7392V101.117C38.2579 103.095 39.8673 104.704 41.8457 104.704H45.6807V117.046H41.8457C33.0653 117.046 26 109.98 26 101.2V47.8232C26 39.0429 33.0653 31.9775 41.8457 31.9775C44.9198 31.9776 48.002 32.8807 50.5537 34.6123L99.596 67.9736L100.143 68.3457V81.8349Z"/><path d="M106.818 31.9775C115.599 31.9775 122.664 39.0429 122.664 47.8232V101.2C122.664 109.98 115.599 117.046 106.818 117.046C103.744 117.046 100.662 116.142 98.11 114.411L49.0684 81.0498L48.5215 80.6777V67.1914L50.457 68.4629L104.802 104.136C105.51 104.56 106.201 104.788 106.818 104.788C108.797 104.788 110.406 103.178 110.406 101.2V47.8232C110.406 45.8447 108.797 44.2353 106.818 44.2353H102.983V31.9775H106.818Z"/></svg>',
  pick: lucide('<path d="M4.04 4.04 10.5 21l2.5-7.5L20.5 11z"/>'),
  close: lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  dockLeft: lucide('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'),
  dockRight: lucide('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>'),
  check: lucide('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  route: lucide(
    '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  ),
  cart: lucide(
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  ),
  card: lucide('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'),
  chevron: lucide('<path d="m6 9 6 6 6-6"/>'),
  plus: lucide('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  fail: lucide('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
  wait: lucide('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>'),
  warn: lucide('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
  search: lucide('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): HTMLElement {
  const el = document.createElement('span');
  el.className = 'icon';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = ICONS[name];
  return el;
}

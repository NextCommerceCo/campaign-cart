/**
 * Debug overlay icons — Font Awesome (free solid).
 *
 * Individual icons are imported by name so Rollup tree-shakes the rest of the
 * pack out of the debug chunk, and rendered as inline SVG (path data from the
 * icon definition). Inline SVG avoids shipping the Font Awesome webfont/CSS into
 * the debug shadow root, and colour follows `currentColor`.
 *
 * The exported function keeps the name `lucide()` only so existing call sites
 * don't need to change. To add an icon: import it from
 * `@fortawesome/free-solid-svg-icons` and add it to `ICONS` under a short key.
 */

import {
  faCartShopping,
  faTag,
  faBox,
  faGear,
  faBullhorn,
  faCreditCard,
  faChartColumn,
  faDatabase,
  faFilter,
  faMagnifyingGlass,
  faMagnifyingGlassMinus,
  faInbox,
  faBolt,
  faCheck,
  faCircleCheck,
  faBan,
  faCircleXmark,
  faClock,
  faTriangleExclamation,
  faPause,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

export type IconName =
  // Panel tab icons
  | 'cart'
  | 'tag'
  | 'package'
  | 'settings'
  | 'megaphone'
  | 'card'
  | 'chart'
  | 'database'
  // Analytics panel
  | 'filter'
  | 'search'
  | 'search-x'
  | 'inbox'
  | 'bolt'
  | 'check'
  | 'check-circle'
  | 'ban'
  | 'x-circle'
  | 'clock'
  | 'alert'
  | 'pause'
  | 'x';

const ICONS: Record<IconName, IconDefinition> = {
  cart: faCartShopping,
  tag: faTag,
  package: faBox,
  settings: faGear,
  megaphone: faBullhorn,
  card: faCreditCard,
  chart: faChartColumn,
  database: faDatabase,
  filter: faFilter,
  search: faMagnifyingGlass,
  'search-x': faMagnifyingGlassMinus,
  inbox: faInbox,
  bolt: faBolt,
  check: faCheck,
  'check-circle': faCircleCheck,
  ban: faBan,
  'x-circle': faCircleXmark,
  clock: faClock,
  alert: faTriangleExclamation,
  pause: faPause,
  x: faXmark,
};

/** Render a Font Awesome icon as an inline SVG string. */
export function lucide(
  name: IconName,
  opts: { size?: number; class?: string; style?: string } = {}
): string {
  const def = ICONS[name];
  const [width, height, , , path] = def.icon;
  const d = Array.isArray(path) ? path.join('') : path;
  const size = opts.size ?? 16;
  const cls = opts.class ? ` ${opts.class}` : '';
  // Align with adjacent text by default; callers can override via opts.style.
  const style = `vertical-align:-0.125em;${opts.style ?? ''}`;
  return `<svg class="fa-icon${cls}" width="${size}" height="${size}" viewBox="0 0 ${width} ${height}" fill="currentColor" style="${style}" aria-hidden="true"><path d="${d}"/></svg>`;
}

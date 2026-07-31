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
  faCircleMinus,
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
  | 'activity'
  | 'database'
  // Analytics panel
  | 'filter'
  | 'search'
  | 'search-x'
  | 'inbox'
  | 'bolt'
  | 'check'
  | 'check-circle'
  | 'minus-circle'
  | 'ban'
  | 'x-circle'
  | 'clock'
  | 'alert'
  | 'pause'
  | 'x'
  // Provider brand icons
  | 'google'
  | 'facebook'
  | 'gtm'
  | 'next'
  | 'rudderstack';

/**
 * Normalised icon spec used by {@link lucide}. Font Awesome icons are filled
 * glyphs (`stroke: false`); custom icons (Feather-style line icons, brand
 * logos) are added as raw path data with their own viewBox and stroke mode.
 */
interface IconSpec {
  width: number;
  height: number;
  /** SVG path `d` (one or many sub-paths). Omit when {@link body} is set. */
  path?: string | string[];
  /** When true, render as a stroked line icon instead of a filled glyph. */
  stroke?: boolean;
  /**
   * Raw inner SVG markup for multi-colour brand logos that carry their own
   * `fill`s (e.g. the Google Tag Manager logo). When set, {@link path}/
   * {@link stroke} are ignored and `currentColor` is not applied.
   */
  body?: string;
}

/** Adapt a Font Awesome icon definition to an {@link IconSpec}. */
function fa(def: IconDefinition): IconSpec {
  const [width, height, , , path] = def.icon;
  return { width, height, path };
}

const ICONS: Record<IconName, IconSpec> = {
  cart: fa(faCartShopping),
  tag: fa(faTag),
  package: fa(faBox),
  settings: fa(faGear),
  megaphone: fa(faBullhorn),
  card: fa(faCreditCard),
  chart: fa(faChartColumn),
  database: fa(faDatabase),
  filter: fa(faFilter),
  search: fa(faMagnifyingGlass),
  'search-x': fa(faMagnifyingGlassMinus),
  inbox: fa(faInbox),
  bolt: fa(faBolt),
  check: fa(faCheck),
  'check-circle': fa(faCircleCheck),
  'minus-circle': fa(faCircleMinus),
  ban: fa(faBan),
  'x-circle': fa(faCircleXmark),
  clock: fa(faClock),
  alert: fa(faTriangleExclamation),
  pause: fa(faPause),
  x: fa(faXmark),
  // Feather-style "activity" pulse line (stroked, 24×24 viewBox).
  activity: {
    width: 24,
    height: 24,
    path: 'M22 12h-4l-3 9L9 3l-3 9H2',
    stroke: true,
  },
  // Brand glyphs (Simple Icons path data, single-colour, 24×24 viewBox).
  google: {
    width: 24,
    height: 24,
    path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
  // Facebook logo: brand-blue circle with the white "f" (keeps its own fills).
  facebook: {
    width: 24,
    height: 24,
    body:
      '<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>' +
      '<path fill="#ffffff" d="M16.671 15.543l.532-3.47h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.996s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.643H7.078v3.47h3.047v8.385a12.06 12.06 0 0 0 3.75 0v-8.385h2.796z"/>',
  },
  // NextCampaign "N" mark in brand blue (keeps its own fill).
  next: {
    width: 117,
    height: 102,
    body:
      '<path fill="#3C7DFF" d="M83.5,58.3l-1.9-1.3L27.2,21.2c-.7-.4-1.4-.6-2-.6-2,0-3.6,1.6-3.6,3.6v53.4c0,2,1.6,3.6,3.6,3.6h3.8v12.3h-3.8c-8.8,0-15.8-7.1-15.8-15.8V24.3c0-8.8,7.1-15.8,15.8-15.8,3.1,0,6.2.9,8.7,2.6h0l49,33.4.5.4v13.5ZM90.2,8.4c8.8,0,15.8,7.1,15.8,15.8v53.4c0,8.8-7.1,15.8-15.8,15.8s-6.2-.9-8.7-2.6h0l-49-33.4-.5-.4v-13.5l1.9,1.3,54.3,35.7c.7.4,1.4.7,2,.7,2,0,3.6-1.6,3.6-3.6V24.3c0-2-1.6-3.6-3.6-3.6h-3.8v-12.3h3.8Z"/>',
  },
  // RudderStack logo: blue rounded tile with the white "sail" mark.
  rudderstack: {
    width: 24,
    height: 24,
    body:
      '<rect width="24" height="24" rx="5.5" fill="#2E5CE6"/>' +
      '<path d="M6.5 6.5H17A10.5 10.5 0 0 1 6.5 17Z" fill="#ffffff"/>',
  },
  // Google Tag Manager logo (layered blues, keeps its own fills).
  gtm: {
    width: 48,
    height: 48,
    body:
      '<polygon points="28.1 45.74 19.93 37.56 37.48 19.83 45.8 28.15 28.1 45.74" fill="#8AB4F8"/>' +
      '<path d="M28.16,10.51,19.84,2.19,2.2,19.83a5.88,5.88,0,0,0,0,8.32L19.84,45.79,28,37.59,14.67,24Z" fill="#4285F4"/>' +
      '<path d="M45.8,19.83,28.16,2.19a5.88,5.88,0,0,0-8.32,8.32L37.49,28.15a5.88,5.88,0,0,0,8.32-8.32Z" fill="#8AB4F8"/>' +
      '<circle cx="23.94" cy="41.7" r="5.83" transform="translate(-22.48 29.14) rotate(-45)" fill="#1A73E8"/>',
  },
};

/** Render an icon (Font Awesome or custom) as an inline SVG string. */
export function lucide(
  name: IconName,
  opts: { size?: number; class?: string; style?: string } = {}
): string {
  const spec = ICONS[name];
  const size = opts.size ?? 16;
  const cls = opts.class ? ` ${opts.class}` : '';
  // Align with adjacent text by default; callers can override via opts.style.
  const style = `vertical-align:-0.125em;${opts.style ?? ''}`;

  // Multi-colour brand logo: emit its own markup verbatim, no currentColor.
  if (spec.body) {
    return `<svg class="fa-icon${cls}" width="${size}" height="${size}" viewBox="0 0 ${spec.width} ${spec.height}" style="${style}" aria-hidden="true">${spec.body}</svg>`;
  }

  const paths = Array.isArray(spec.path) ? spec.path : [spec.path ?? ''];
  // Stroked line icons (Feather-style) vs. filled glyphs (FA, brand logos).
  const paint = spec.stroke
    ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    : 'fill="currentColor"';
  const body = paths.map(d => `<path d="${d}"/>`).join('');
  return `<svg class="fa-icon${cls}" width="${size}" height="${size}" viewBox="0 0 ${spec.width} ${spec.height}" ${paint} style="${style}" aria-hidden="true">${body}</svg>`;
}

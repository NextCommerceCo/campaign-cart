import type { Engine } from '../engine/engine';
import { resolve } from '../engine/values';
import { type IconName, icon } from './icons';
import type { PageConfigModal } from './config';
import type { LocaleSummary } from './locale';
import type { Theme } from './theme';
import { badge, type Child, h, iconButton, link, plural, priceText } from './view';

export type MenuTab =
  'issues' | 'journey' | 'checkout' | 'analytics' | 'events' | 'elements' | 'state' | 'logs' | 'benchmark';

export interface MenuInput {
  info: { version: string; apiBase: string; funnel: string; scope: string; off: () => void };
  dev: boolean;
  right: boolean;
  resetting: boolean;
  issues: { count: number; tone: string };
  pages: number;
  checkout: string;
  analytics: string;
  locale: LocaleSummary;
  events: number;
  pageConfig: PageConfigModal;
  settings: boolean;
  setSettings: (on: boolean) => void;
  counts: () => Record<'elements' | 'logs', number>;
  show: (tab: MenuTab) => void;
  /** Opens the panel with the globe's Locale popover. */
  geo: () => void;
  pick: () => void;
  flip: () => void;
  theme: Theme | undefined;
  setTheme: (theme: Theme | undefined) => void;
  toggleDev: () => void;
  reset: () => void;
}

const cartText = (engine: Engine) => {
  const units = Number(resolve(engine, 'cart.quantity')?.value ?? 0);
  const total = resolve(engine, 'cart.total');
  if (!units) return 'Empty';
  const shown = total?.value === undefined ? '' : ` · ${priceText(engine, Number(total.value))}`;
  return `${plural(units, 'item')}${shown}`;
};

const entry = (glyph: IconName, label: string, value: Child, onclick: () => void, variant = '') => {
  const el = h(
    'button',
    { type: 'button', onclick, role: 'menuitem' },
    icon(glyph),
    h('span', {}, label),
    value && h('span', { className: 'mval', title: typeof value === 'string' ? value : '' }, value),
  );
  if (variant) el.dataset.variant = variant;
  return el;
};

const separator = () => h('div', { role: 'separator' });

const choice = (
  role: 'menuitemcheckbox' | 'menuitemradio',
  glyph: IconName,
  label: string,
  on: boolean,
  onclick: () => void,
) => {
  const tick = h('span', 'mval', icon('tick'));
  tick.dataset.indicator = '';
  return h(
    'button',
    { type: 'button', onclick, role, ariaChecked: String(on) },
    icon(glyph),
    h('span', {}, label),
    tick,
  );
};

const group = (label: string, ...items: Child[]) =>
  h('div', { role: 'group', ariaLabel: label }, h('div', { role: 'heading' }, label), ...items);

const menu = (...items: Child[]) => h('div', { className: 'mlist', role: 'menu', ariaLabel: 'Debug' }, ...items);

const THEMES: Array<[IconName, string, Theme | undefined]> = [
  ['monitor', 'Auto', undefined],
  ['sun', 'Light', 'light'],
  ['moon', 'Dark', 'dark'],
];

const localeValue = ({ text, differs }: LocaleSummary) => {
  if (!differs) return text;
  const differ = "Differs from the visitor's geo";
  return h('span', {}, text, h('span', { className: 'mdot', title: differ, role: 'img', ariaLabel: differ }));
};

const devSwitch = (on: boolean, onclick: () => void) => {
  return h(
    'button',
    {
      type: 'button',
      onclick,
      title: 'Adds the Developer tab: Elements, State, Logs, Performance, and ids in the others',
      role: 'menuitemcheckbox',
      ariaChecked: String(on),
    },
    icon('flask'),
    h('span', {}, 'Developer mode'),
    h('span', 'mval', h('span', 'mswitch')),
  );
};

const settingsView = (m: MenuInput): Child[] => {
  return [
    h(
      'div',
      'mtop',
      iconButton('back', 'Back', () => m.setSettings(false), 'icon-sm'),
      h('b', {}, 'Settings'),
    ),
    menu(
      entry('settings', 'Page config', m.pageConfig.trying() && 'Trying', () => m.pageConfig.open()),
      separator(),
      group(
        'Theme',
        ...THEMES.map(([glyph, label, theme]) =>
          choice('menuitemradio', glyph, label, m.theme === theme, () => m.setTheme(theme)),
        ),
      ),
      separator(),
      group(
        'Position',
        choice('menuitemradio', 'dockLeft', 'Left', !m.right, () => m.right && m.flip()),
        choice('menuitemradio', 'dockRight', 'Right', m.right, () => !m.right && m.flip()),
      ),
    ),
  ];
};

export function menuView(engine: Engine, m: MenuInput): Child[] {
  if (m.settings) return settingsView(m);
  const { campaign } = engine.getState();
  const { count, tone } = m.issues;
  const counts = m.dev ? m.counts() : undefined;
  return [
    h(
      'div',
      'mhead',
      h(
        'div',
        {},
        h('b', { title: campaign?.name ?? '' }, campaign?.name ?? 'Loading campaign…'),
        h('small', {}, [campaign?.currency, `SDK v${m.info.version}`].filter(Boolean).join(' · ')),
      ),
      iconButton('settings', 'Settings', () => m.setSettings(true), 'icon-sm'),
    ),
    m.pageConfig.trying() &&
      h(
        'p',
        'mtry',
        'This tab tries a nextConfig of its own.',
        link('Open', () => m.pageConfig.open()),
        link('Reset', () => m.pageConfig.reset()),
      ),
    menu(
      entry(
        count ? 'warn' : 'check',
        'Issues',
        badge(count ? String(count) : 'None', count ? (tone === 'red' ? 'destructive' : 'warning') : 'success'),
        () => m.show('issues'),
      ),
      entry('route', 'Journey', `${plural(m.pages, 'page')} in this tab`, () => m.show('journey')),
      entry('cart', 'Checkout', `${cartText(engine)} · ${m.checkout}`, () => m.show('checkout')),
      entry('send', 'Analytics', m.analytics, () => m.show('analytics')),
      entry('globe', 'Locale', localeValue(m.locale), m.geo),
      entry('bolt', 'Events', String(m.events), () => m.show('events')),
      separator(),
      devSwitch(m.dev, m.toggleDev),
      ...(counts
        ? [
            entry('code', 'Elements', String(counts.elements), () => m.show('elements')),
            entry('braces', 'State', '', () => m.show('state')),
            entry('list', 'Logs', String(counts.logs), () => m.show('logs')),
            entry('gauge', 'Performance', '', () => m.show('benchmark')),
            entry('pick', 'Pick an element', '', m.pick),
          ]
        : []),
      separator(),
      entry('reset', 'Reset saved data', m.resetting && 'Click again', m.reset, 'destructive'),
      entry('power', 'Turn off debug', '', m.info.off),
    ),
    h(
      'p',
      m.resetting ? 'mnote red' : 'mnote',
      m.resetting
        ? "Click again to clear this funnel's cart, form and order."
        : 'Debug stays on in this tab until you turn it off.',
    ),
  ];
}

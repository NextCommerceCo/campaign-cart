import type { Engine } from '../engine/engine';
import { format, localeOf } from '../engine/format';
import { resolve } from '../engine/values';
import { type IconName, icon } from './icons';
import type { PageConfigModal } from './config';
import type { LocaleSummary } from './locale';
import type { Theme } from './theme';
import { badge, type Child, h, iconButton, plural } from './view';

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
  const state = engine.getState();
  const units = Number(resolve(engine, 'cart.quantity')?.value ?? 0);
  const total = resolve(engine, 'cart.total');
  if (!units) return 'Empty';
  const price = total?.value === undefined ? '' : ` · ${format(total, state.campaign?.currency, localeOf(state))}`;
  return `${plural(units, 'item')}${price}`;
};

const entry = (glyph: IconName, label: string, value: Child, onclick: () => void, variant = '') => {
  const el = h(
    'button',
    { type: 'button', onclick },
    icon(glyph),
    h('span', {}, label),
    value && h('span', { className: 'mval', title: typeof value === 'string' ? value : '' }, value),
  );
  el.setAttribute('role', 'menuitem');
  if (variant) el.dataset.variant = variant;
  return el;
};

const separator = () => {
  const el = h('div');
  el.setAttribute('role', 'separator');
  return el;
};

const choice = (
  role: 'menuitemcheckbox' | 'menuitemradio',
  glyph: IconName,
  label: string,
  on: boolean,
  onclick: () => void,
) => {
  const el = h(
    'button',
    { type: 'button', onclick },
    icon(glyph),
    h('span', {}, label),
    h('span', 'mval', icon('tick')),
  );
  el.setAttribute('role', role);
  el.setAttribute('aria-checked', String(on));
  el.lastElementChild!.setAttribute('data-indicator', '');
  return el;
};

const group = (label: string, ...items: Child[]) => {
  const heading = h('div', {}, label);
  heading.setAttribute('role', 'heading');
  const el = h('div', {}, heading, ...items);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  return el;
};

const menu = (...items: Child[]) => {
  const el = h('div', 'mlist', ...items);
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', 'Debug');
  return el;
};

const THEMES: Array<[IconName, string, Theme | undefined]> = [
  ['monitor', 'Auto', undefined],
  ['sun', 'Light', 'light'],
  ['moon', 'Dark', 'dark'],
];

const localeValue = ({ text, differs }: LocaleSummary) => {
  if (!differs) return text;
  const dot = h('span', { className: 'mdot', title: "Differs from the visitor's geo" });
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', dot.title);
  return h('span', {}, text, dot);
};

const devSwitch = (on: boolean, onclick: () => void) => {
  const el = h(
    'button',
    {
      type: 'button',
      onclick,
      title: 'Adds the Developer tab: Elements, State, Logs, Performance, and ids in the others',
    },
    icon('flask'),
    h('span', {}, 'Developer mode'),
    h('span', 'mval', h('span', 'mswitch')),
  );
  el.setAttribute('role', 'menuitemcheckbox');
  el.setAttribute('aria-checked', String(on));
  return el;
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
        h('button', { type: 'button', className: 'link', onclick: () => m.pageConfig.open() }, 'Open'),
        h('button', { type: 'button', className: 'link', onclick: () => m.pageConfig.reset() }, 'Reset'),
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

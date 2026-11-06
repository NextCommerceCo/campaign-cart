import type { Engine } from '../engine/engine';
import { format, localeOf } from '../engine/format';
import { resolve } from '../engine/values';
import { type IconName, icon } from './icons';
import { badge, button, type Child, h, iconButton, plural } from './view';

export type MenuTab = 'issues' | 'journey' | 'checkout' | 'analytics' | 'elements' | 'events' | 'logs';

export interface MenuInput {
  info: { version: string; apiBase: string; funnel: string; scope: string; off: () => void };
  dev: boolean;
  right: boolean;
  resetting: boolean;
  issues: { count: number; tone: string };
  pages: number;
  checkout: string;
  analytics: string;
  locale: () => Child;
  counts: () => Record<'elements' | 'events' | 'logs', number>;
  show: (tab: MenuTab) => void;
  pick: () => void;
  flip: () => void;
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

const item = (glyph: IconName, label: string, value: Child, onclick: () => void, go = true) =>
  h(
    'button',
    { type: 'button', className: 'item', onclick },
    h('span', 'label', icon(glyph), label),
    h('span', { className: 'value', title: typeof value === 'string' ? value : '' }, value),
    go && h('span', 'go', icon('chevron')),
  );

const toggle = (label: string, detail: string, on: boolean, onclick: () => void) => {
  const el = h(
    'button',
    { type: 'button', className: 'mswitch', onclick },
    h('span', {}, label),
    h('small', {}, detail),
    h('span', 'mtrack'),
  );
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-checked', String(on));
  return el;
};

export function menuView(engine: Engine, m: MenuInput): Child[] {
  const { campaign } = engine.getState();
  const { count, tone } = m.issues;
  const reset = button(
    'Reset saved data',
    m.reset,
    { variant: m.resetting ? 'destructive' : 'outline', size: 'sm' },
    "Clears this funnel's cart, form and order",
  );
  if (!m.resetting) reset.classList.add('danger');
  const counts = m.dev ? m.counts() : undefined;
  const setup: Array<[string, string]> = [
    ['API', m.info.apiBase.replace(/^https?:\/\//, '')],
    ['Funnel', m.info.funnel || '—'],
    ['Storage', m.info.scope],
  ];
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
      iconButton(
        m.right ? 'dockLeft' : 'dockRight',
        m.right ? 'Move to the left' : 'Move to the right',
        m.flip,
        'icon-sm',
      ),
    ),
    h(
      'div',
      'mlist',
      item(
        count ? 'warn' : 'check',
        'Issues',
        badge(count ? String(count) : 'None', count ? (tone === 'red' ? 'destructive' : 'warning') : 'success'),
        () => m.show('issues'),
      ),
      item('route', 'Journey', `${plural(m.pages, 'page')} in this tab`, () => m.show('journey')),
      item('cart', 'Checkout', `${cartText(engine)} · ${m.checkout}`, () => m.show('checkout')),
      item('send', 'Analytics', m.analytics, () => m.show('analytics')),
      ...(counts
        ? [
            h('hr'),
            item('code', 'Elements', String(counts.elements), () => m.show('elements')),
            item('bolt', 'Events', String(counts.events), () => m.show('events')),
            item('list', 'Logs', String(counts.logs), () => m.show('logs')),
            item('pick', 'Pick an element', '', m.pick, false),
          ]
        : []),
    ),
    m.locale(),
    m.dev && h('dl', 'minfo', ...setup.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { title: v }, v)])),
    h('div', 'mlist', toggle('Developer mode', 'Events, Elements, State and Logs', m.dev, m.toggleDev)),
    h(
      'div',
      'mfoot',
      h('div', {}, reset, button('Turn off debug', m.info.off, { variant: 'outline', size: 'sm' })),
      h(
        'p',
        m.resetting ? 'red' : '',
        m.resetting
          ? "Click again to clear this funnel's cart, form and order."
          : 'Debug stays on in this tab until you turn it off.',
      ),
    ),
  ];
}

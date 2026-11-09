import type { Engine } from '../../engine/engine';
import type { analyticsFlow } from '../tabs/analytics';
import type { benchmarkView } from '../tabs/benchmark';
import type { cartView } from '../tabs/cart';
import type { checkoutView } from '../tabs/checkout';
import type { PageConfigModal } from '../tabs/config';
import { type Box, countElements, elementsView, highlighter, pick } from '../tabs/elements';
import type { eventsView } from '../tabs/events';
import type { issuesView } from '../tabs/issues';
import type { journeyView } from '../tabs/journey';
import type { LocaleTab } from '../tabs/locale';
import type { logsView } from '../tabs/logs';
import type { DetailModal } from './stream';
import { type IconName, icon } from './icons';
import type { DebugInfo } from '../index';
import { menuView } from './menu';
import type { followTheme } from './theme';
import type { DebugActions, Panel } from '../state';
import {
  ANALYTICS_CSS,
  BENCH_CSS,
  STREAM_CSS,
  CART_CSS,
  CHECKOUT_CSS,
  CONFIG_CSS,
  JOURNEY_CSS,
  LOCALE_CSS,
  PANEL_CSS,
  TSUGI_CSS,
} from './styles';
import { DEV, type Tab, TABS, tabBar } from './tabs';
import { type Child, h, iconButton, nodes, plural, tree } from './view';

const FILTERED: Tab[] = ['elements', 'analytics', 'events', 'logs'];

type View = 'closed' | 'menu' | 'panel';

/** What the panel shows; it changes through `enter`, `goTo` and the toggles below. */
interface Ui {
  view: View;
  tab: Tab;
  /** The element the Elements tab inspects. */
  picked?: Element;
  right: boolean;
  dev: boolean;
  /** Reset in the menu asks once more before it clears the tab. */
  resetting: boolean;
  /** The menu shows its settings. */
  settings: boolean;
  /** The visitor-geo popover is open. */
  geo: boolean;
}

export const uiOf = (saved: Panel): Ui => ({
  view: saved.open ? 'panel' : 'closed',
  tab: saved.tab in TABS ? (saved.tab as Tab) : 'journey',
  right: saved.right,
  dev: saved.dev === true,
  resetting: false,
  settings: false,
  geo: false,
});

/** Shows the menu or the panel, or neither; leaving the menu drops its settings and reset prompt. */
const enter = (ui: Ui, view: View) => {
  ui.view = view;
  if (view !== 'menu') ui.resetting = ui.settings = false;
  if (view === 'closed') ui.geo = false;
};

interface Dom {
  host: HTMLElement;
  box: Box;
  body: HTMLElement;
  menu: HTMLElement;
  issueCount: HTMLElement;
  filter: HTMLInputElement;
  search: HTMLElement;
  bar: ReturnType<typeof tabBar>;
  dock: HTMLButtonElement;
  globe: HTMLButtonElement;
  switches: HTMLElement;
  geo: HTMLElement;
  root: HTMLElement;
  style: HTMLStyleElement;
}

export interface Tabs {
  detail: DetailModal;
  events: ReturnType<typeof eventsView>;
  pageConfig: PageConfigModal;
  flow: ReturnType<typeof analyticsFlow>;
  cart: ReturnType<typeof cartView>;
  journey: ReturnType<typeof journeyView>;
  checkout: ReturnType<typeof checkoutView>;
  bench: ReturnType<typeof benchmarkView>;
  logs: ReturnType<typeof logsView>;
  locale: LocaleTab;
  issues: ReturnType<typeof issuesView>;
}

/** The panel: its state, elements and tabs, and what it listens with. */
export interface Shell extends Dom, Tabs {
  engine: Engine;
  debug: DebugActions;
  info: DebugInfo;
  ui: Ui;
  open: Set<string>;
  /** Each tab's filter text, kept while another tab shows. */
  queries: Partial<Record<Tab, string>>;
  theme: ReturnType<typeof followTheme>;
  later: () => void;
  stopPicking?: () => void;
  flash?: { part: string; until: number };
}

/** The panel's elements, in a shadow root on the page. */
export function mount(s: Shell): Dom {
  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body scrollbar-sm');
  const menu = h('div', 'menu pop dropdown');
  const issueCount = h('span', 'issues');
  const filter = h('input', { type: 'search', className: 'input', placeholder: 'Filter…', oninput: () => paint(s) });
  const search = h('div', 'search', filter);
  const button = (name: IconName, label: string, onclick: () => void) => iconButton(name, label, onclick, 'icon-sm');
  const bar = tabBar(
    (t) => show(s, t),
    () => togglePick(s),
  );
  const dock = button('dockRight', 'Move to the right', () => flip(s));
  const globe = button('globe', 'Visitor geo', () => ((s.ui.geo = !s.ui.geo), paint(s)));
  const switches = h('div', 'lswitch');
  const geo = h('div', 'geo pop scrollbar-sm');
  const toggle = () => setView(s, s.ui.view === 'closed' ? 'menu' : 'closed');
  const fab = h(
    'button',
    { type: 'button', className: 'fab', title: 'Campaign SDK debug', onclick: toggle },
    icon('logo'),
    issueCount,
  );
  const close = button('close', 'Close', () => setView(s, 'closed'));
  const head = h('div', 'head', h('div', 'tabs', bar.strip), bar.select, globe, dock, close);
  const panel = h('div', 'panel pop', head, switches, bar.menu, search, body, geo);
  const hint = h('div', 'hint', 'Click an element to inspect it', h('span', 'dim', ' · Esc to cancel'));
  const root = h('div', 'root', panel, menu, fab, hint);
  const style = h(
    'style',
    {},
    ...[TSUGI_CSS, PANEL_CSS, CART_CSS, CHECKOUT_CSS, JOURNEY_CSS, LOCALE_CSS],
    ...[CONFIG_CSS, ANALYTICS_CSS, BENCH_CSS, STREAM_CSS],
  );
  host.attachShadow({ mode: 'open' }).append(style, box.el, root);
  document.body.append(host);
  return { host, box, body, menu, issueCount, filter, search, bar, dock, globe, switches, geo, root, style };
}

function tabView(s: Shell): Child[] {
  const { engine, ui } = s;
  const query = s.filter.value.trim().toLowerCase();
  const views: Record<Tab, () => Child[]> = {
    journey: () => s.journey.view(),
    issues: () => s.issues.view(),
    checkout: () => s.checkout.view(),
    state: () => Object.entries(engine.getState()).map(([k, v]) => tree(h('span', 'key', k), v, k, s.open)),
    elements: () =>
      elementsView(engine, s.box, ui.picked, query, () => {
        ui.picked = undefined;
        paint(s);
      }),
    analytics: () => s.flow.view(query),
    events: () => s.events.view(query),
    logs: () => s.logs.view(query),
    benchmark: () => s.bench.view(),
  };
  return views[ui.tab]();
}

const menuOf = (s: Shell, issues: { count: number; tone: string }): Parameters<typeof menuView>[1] => {
  const { engine, debug, info, ui } = s;
  return {
    info,
    dev: ui.dev,
    right: ui.right,
    resetting: ui.resetting,
    issues,
    pages: debug.state().pages.length,
    checkout: s.checkout.summary(),
    analytics: s.flow.summary(),
    locale: s.locale.summary(),
    events: s.events.count(),
    pageConfig: s.pageConfig,
    settings: ui.settings,
    setSettings: (on) => ((ui.settings = on), paint(s)),
    counts: () => ({ elements: countElements(), logs: engine.log.entries().length }),
    show: (t) => show(s, t),
    geo: () => ((ui.geo = true), show(s, ui.tab)),
    pick: () => togglePick(s),
    flip: () => flip(s),
    theme: debug.state().panel.theme,
    setTheme: (picked) => (debug.setPanel({ theme: picked }), s.theme(), paint(s)),
    toggleDev: () => (debug.setPanel({ dev: (ui.dev = !ui.dev) }), s.later()),
    reset: () => (ui.resetting ? info.reset() : ((ui.resetting = true), s.later())),
  };
};

function paintPanel(s: Shell, count: number, tone: string) {
  const { ui, info, body, flash } = s;
  s.switches.replaceChildren(...nodes(s.locale.switchers()));
  s.globe.setAttribute('aria-expanded', String(ui.geo));
  s.geo.hidden = !ui.geo;
  if (ui.geo) s.geo.replaceChildren(...nodes(s.locale.view()));
  s.bar.paint({
    tab: ui.tab,
    dev: ui.dev,
    issues: count,
    tone,
    setup: [
      ['API', info.apiBase.replace(/^https?:\/\//, '')],
      ['Funnel', info.funnel || '—'],
      ['Storage', info.scope],
    ],
  });
  s.search.hidden = !FILTERED.includes(ui.tab);
  body.replaceChildren(...nodes(tabView(s)));
  if (flash && Date.now() < flash.until) body.querySelector(`[data-focus="${flash.part}"]`)?.classList.add('flash');
}

export function paint(s: Shell) {
  const { ui, root, dock, issueCount } = s;
  const { count, tone } = s.issues.find();
  issueCount.textContent = count ? plural(count, 'Issue') : '';
  issueCount.className = `issues ${tone}`;
  root.dataset.view = ui.view;
  root.classList.toggle('picking', !!s.stopPicking);
  root.classList.toggle('right', ui.right);
  root.classList.toggle('dev', ui.dev);
  if (!ui.dev && DEV.includes(ui.tab)) goTo(s, 'journey');
  dock.title = ui.right ? 'Move to the left' : 'Move to the right';
  dock.setAttribute('aria-label', dock.title);
  dock.replaceChildren(icon(ui.right ? 'dockLeft' : 'dockRight'));
  if (ui.view === 'menu') s.menu.replaceChildren(...nodes(menuView(s.engine, menuOf(s, { count, tone }))));
  if (ui.view === 'panel') paintPanel(s, count, tone);
}

export function setView(s: Shell, next: View) {
  enter(s.ui, next);
  if (next !== 'menu') s.debug.setPanel({ open: next === 'panel', tab: s.ui.tab });
  paint(s);
}

function goTo(s: Shell, next: Tab) {
  const { ui, filter, queries } = s;
  if (next !== ui.tab) {
    queries[ui.tab] = filter.value;
    filter.value = queries[next] ?? '';
    s.body.scrollTop = 0;
  }
  ui.tab = next;
}

export function show(s: Shell, next: Tab) {
  goTo(s, next);
  setView(s, 'panel');
}

function flip(s: Shell) {
  s.ui.right = !s.ui.right;
  s.debug.setPanel({ right: s.ui.right });
  paint(s);
}

/** Shows a tab scrolled to its `[data-focus]` part, flashed for a moment. */
export function focus(s: Shell, t: Tab, part: string) {
  s.flash = { part, until: Date.now() + 1600 };
  show(s, t);
  s.body.querySelector(`[data-focus="${part}"]`)?.scrollIntoView({ block: 'center' });
}

function togglePick(s: Shell) {
  if (s.stopPicking) return s.stopPicking();
  if (s.ui.view === 'menu') enter(s.ui, 'closed');
  s.stopPicking = pick(s.host, s.box, (el) => {
    s.stopPicking = undefined;
    if (el) {
      s.ui.picked = el;
      goTo(s, 'elements');
      s.filter.value = '';
      enter(s.ui, 'panel');
    }
    paint(s);
  });
  paint(s);
}

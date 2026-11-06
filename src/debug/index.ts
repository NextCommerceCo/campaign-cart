import type { Line } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import type { Send } from '../engine/types';
import { card, countElements, explain, highlighter, inspect, matches, pick } from './elements';
import { analyticsFlow } from './analytics';
import { cartView } from './cart';
import { checkoutView } from './checkout';
import { eventsView } from './events';
import { type IconName, icon } from './icons';
import { journeyView, pageKind } from './journey';
import { localeTab } from './locale';
import { logsView } from './logs';
import { menuView } from './menu';
import type { ProviderConfig } from './providers';
import { followTheme } from './theme';
import { createDebug, type PageVisit } from './state';
import { CART_CSS, CHECKOUT_CSS, JOURNEY_CSS, LOCALE_CSS, PANEL_CSS, TSUGI_CSS } from './styles';
import { badge, type Child, empty, h, iconButton, nodes, plural, tab as tabButton, tablist, tree } from './view';

const TABS = {
  journey: 'Journey',
  issues: 'Issues',
  checkout: 'Checkout',
  analytics: 'Analytics',
  locale: 'Locale',
  events: 'Events',
  elements: 'Elements',
  state: 'State',
  logs: 'Logs',
};
type Tab = keyof typeof TABS;
const FILTERED: Tab[] = ['elements', 'analytics', 'events', 'logs'];
const DEV: Tab[] = ['events', 'elements', 'state', 'logs'];
const LIMIT = 200;
export interface DebugInfo {
  version: string;
  apiBase: string;
  scope: string;
  funnel: string;
  arrived: { lines: Line[]; reset: boolean };
  reset: () => void;
  off: () => void;
  analytics: () => ProviderConfig;
  send: Send;
}

export function startDebug(engine: Engine, info: DebugInfo): void {
  const open = new Set(['cart']);
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const debug = engine.attach((ctx) =>
    createDebug(ctx, {
      at: Date.now(),
      path: location.pathname,
      title: document.title,
      kind: pageKind(),
      scope: info.scope,
      reload: navigation?.type === 'reload',
      ...info.arrived,
    }),
  );
  const saved = debug.state().panel;
  let view: 'closed' | 'menu' | 'panel' = saved.open ? 'panel' : 'closed';
  let tab: Tab = saved.tab in TABS ? (saved.tab as Tab) : 'journey';
  let picked: Element | undefined;
  let stopPicking: (() => void) | undefined;
  let right = saved.right;
  let dev = saved.dev === true;
  let queued = false;
  let resetting = false;
  let settings = false;
  const queries: Partial<Record<Tab, string>> = {};

  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body scrollbar-sm');
  const menu = h('div', 'menu pop dropdown');
  const issues = h('span', 'issues');
  const filter = h('input', { type: 'search', className: 'input', placeholder: 'Filter…', oninput: () => render() });
  const search = h('div', 'search', filter);
  const button = (name: IconName, label: string, onclick: () => void) => iconButton(name, label, onclick, 'icon-sm');
  const tabs = (Object.keys(TABS) as Tab[]).map((t) => {
    const el = tabButton(false, () => show(t), TABS[t]);
    el.dataset.tab = t;
    return el;
  });
  const strip = tablist({ size: 'sm' });
  strip.append(...tabs);
  const tabpick = h(
    'select',
    { className: 'select tabpick', onchange: () => show(tabpick.value as Tab) },
    ...(Object.keys(TABS) as Tab[]).map((t) => h('option', { value: t }, TABS[t])),
  );
  tabpick.setAttribute('aria-label', 'Panel tab');
  const pickButton = button('pick', 'Pick an element', () => togglePick());
  const flip = () => {
    right = !right;
    debug.setPanel({ right });
    render();
  };
  const dock = button('dockRight', 'Move to the right', flip);
  const fab = h(
    'button',
    {
      type: 'button',
      className: 'fab',
      title: 'Campaign SDK debug',
      onclick: () => setView(view === 'closed' ? 'menu' : 'closed'),
    },
    icon('logo'),
    issues,
  );
  const panel = h(
    'div',
    'panel pop',
    h(
      'div',
      'head',
      h('div', 'tabs', strip),
      tabpick,
      pickButton,
      dock,
      button('close', 'Close', () => setView('closed')),
    ),
    search,
    body,
  );
  const hint = h('div', 'hint', 'Click an element to inspect it', h('span', 'dim', ' · Esc to cancel'));
  const root = h('div', 'root', panel, menu, fab, hint);
  const style = h('style', {}, TSUGI_CSS, PANEL_CSS, CART_CSS, CHECKOUT_CSS, JOURNEY_CSS, LOCALE_CSS);
  let paymentIcons: Promise<void> | undefined;
  const loadPaymentIcons = () =>
    (paymentIcons ??= import('../../vendor/tsugi/payment-icons.css?raw').then((m) => style.append(m.default)));
  host.attachShadow({ mode: 'open' }).append(style, box.el, root);
  document.body.append(host);
  const theme = followTheme(host, () => debug.state().panel.theme);

  const query = () => filter.value.trim().toLowerCase();
  const events = eventsView(engine, open);
  const flow = analyticsFlow({ open, config: info.analytics });
  const cart = cartView(engine, { open, render: () => render(), showState: () => show('state') });
  const journey = journeyView(engine, debug, { render: () => render() });
  const checkout = checkoutView(engine, cart, { render: () => render(), paymentIcons: () => void loadPaymentIcons() });
  root.append(cart.dialog);
  const logs = logsView(engine, open, idOf);
  const locale = localeTab(engine, debug, info.send, () => later());

  const findIssues = () => {
    const page = inspect(engine).filter((i) => i.bad);
    const shownOnPage = page.flatMap((i) => i.notes.filter((n) => n.bad).map((n) => `"${n.value}"`));
    const logged = engine.log
      .entries()
      .filter((e) => (e.level === 'warn' || e.level === 'error') && !shownOnPage.some((v) => e.message.includes(v)))
      .reverse();
    const pages = debug.state().pages;
    const marks = (p: PageVisit | undefined) => (p?.marks ?? []).filter((m) => m.tone === 'warn' || m.tone === 'error');
    const found: Array<{ from: Tab; text: string; error: boolean }> = [
      ...marks(pages.at(-1)).map((m) => ({ from: 'journey' as Tab, text: m.text, error: m.tone === 'error' })),
      ...checkout.problems().map((p) => ({ from: 'checkout' as Tab, ...p })),
      ...flow.problems().map((p) => ({ from: 'analytics' as Tab, ...p })),
    ];
    const earlier = pages.slice(0, -1).reduce((n, p) => n + marks(p).length, 0);
    const tone = logged.some((e) => e.level === 'error') || found.some((f) => f.error) ? 'red' : 'amber';
    return {
      page,
      logged,
      found,
      earlier,
      notes: flow.notes(),
      count: page.length + logged.length + found.length,
      tone,
    };
  };

  const views: Record<Tab, () => Child[]> = {
    journey: () => journey.view(),
    issues: () => {
      const { page, logged, found, earlier, notes } = findIssues();
      const before =
        earlier > 0 &&
        h(
          'p',
          'summary',
          `Earlier pages in this tab had ${plural(earlier, 'problem')}. `,
          h('button', { type: 'button', className: 'link', onclick: () => show('journey') }, 'Open Journey'),
        );
      const setup = [
        notes.length > 0 && h('h3', {}, `Setup notes · ${notes.length}`),
        ...notes.map((text) =>
          h(
            'div',
            { className: 'ecard', onclick: () => show('analytics') },
            badge(TABS.analytics, 'outline'),
            ' ',
            text,
          ),
        ),
      ];
      if (!page.length && !logged.length && !found.length)
        return [
          empty(
            'No issues',
            'Every SDK attribute resolves, the journey, checkout and analytics found nothing, and no warnings were logged.',
            'check',
          ),
          before,
          ...setup,
        ];
      return [
        found.length > 0 && h('h3', {}, `Problems · ${found.length}`),
        ...found.map((f) =>
          h(
            'div',
            { className: `ecard${f.error ? ' bad' : ''}`, onclick: () => show(f.from) },
            badge(TABS[f.from], 'outline'),
            ' ',
            f.text,
          ),
        ),
        page.length > 0 && h('h3', {}, `Page setup · ${page.length}`),
        ...page.map((i) => card(i, box)),
        logged.length > 0 && h('h3', {}, `Warnings and errors · ${logged.length}`),
        ...logged.map(logs.row),
        before,
        ...setup,
      ];
    },
    checkout: () => checkout.view(),
    state: () => Object.entries(engine.getState()).map(([k, v]) => tree(h('span', 'key', k), v, k, open)),
    elements: () => {
      const found = inspect(engine, picked).filter((i) => matches(i, query()));
      const bad = found.filter((i) => i.bad).length;
      if (!found.length)
        return [
          query()
            ? empty('Nothing matches', 'No element with a data-next-* attribute fits the filter.')
            : empty('No SDK elements', 'No element on this page has a data-next-* attribute.'),
        ];
      const unpick = () => {
        picked = undefined;
        render();
      };
      return [
        h(
          'div',
          'summary',
          picked ? 'Picked element and its SDK parents' : `${found.length} elements`,
          bad > 0 && h('span', 'red', ` · ${bad} with problems`),
          picked && h('button', { type: 'button', className: 'link', onclick: unpick }, 'Show all'),
        ),
        ...found.slice(0, LIMIT).map((i) => card(i, box)),
        found.length > LIMIT && h('div', 'summary', `Showing ${LIMIT} of ${found.length}. Filter to narrow.`),
      ];
    },
    analytics: () => flow.view(query()),
    locale: () => locale.view(),
    events: () => events.view(query()),
    logs: () => logs.view(query()),
  };

  const render = () => {
    const { count, tone } = findIssues();
    issues.textContent = count ? plural(count, 'Issue') : '';
    issues.className = `issues ${tone}`;
    root.dataset.view = view;
    root.classList.toggle('picking', !!stopPicking);
    root.classList.toggle('right', right);
    root.classList.toggle('dev', dev);
    pickButton.hidden = !dev;
    if (!dev && DEV.includes(tab)) goTo('journey');
    dock.title = right ? 'Move to the left' : 'Move to the right';
    dock.setAttribute('aria-label', dock.title);
    dock.replaceChildren(icon(right ? 'dockLeft' : 'dockRight'));
    if (view === 'menu')
      menu.replaceChildren(
        ...nodes(
          menuView(engine, {
            info,
            dev,
            right,
            resetting,
            issues: { count, tone },
            pages: debug.state().pages.length,
            checkout: checkout.summary(),
            analytics: flow.summary(),
            locale: locale.summary(),
            settings,
            setSettings: (on) => ((settings = on), render()),
            counts: () => ({ elements: countElements(), events: events.count(), logs: engine.log.entries().length }),
            show,
            pick: togglePick,
            flip,
            theme: debug.state().panel.theme,
            setTheme: (picked) => (debug.setPanel({ theme: picked }), theme(), render()),
            toggleDev: () => (debug.setPanel({ dev: (dev = !dev) }), later()),
            reset: () => (resetting ? info.reset() : ((resetting = true), later())),
          }),
        ),
      );
    if (view !== 'panel') return;
    tabs.forEach((el) => {
      el.hidden = !dev && DEV.includes(el.dataset.tab as Tab);
      el.setAttribute('aria-selected', String(el.dataset.tab === tab));
      if (el.dataset.tab === 'issues')
        el.replaceChildren(
          TABS.issues,
          ...nodes([count > 0 && badge(String(count), tone === 'red' ? 'destructive' : 'warning')]),
        );
    });
    for (const o of tabpick.options) o.hidden = o.disabled = !dev && DEV.includes(o.value as Tab);
    tabpick.value = tab;
    tabpick.querySelector('[value="issues"]')!.textContent = count ? `${TABS.issues} · ${count}` : TABS.issues;
    search.hidden = !FILTERED.includes(tab);
    body.replaceChildren(...nodes(views[tab]()));
    if (tab === 'journey') journey.draw();
  };
  const setView = (next: typeof view) => {
    view = next;
    if (next !== 'menu') resetting = settings = false;
    if (next !== 'menu') debug.setPanel({ open: next === 'panel', tab });
    render();
  };
  const goTo = (next: Tab) => {
    if (next !== tab) {
      queries[tab] = filter.value;
      filter.value = queries[next] ?? '';
      body.scrollTop = 0;
    }
    tab = next;
  };
  const show = (next: Tab) => {
    goTo(next);
    setView('panel');
  };
  const later = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  };
  const togglePick = () => {
    if (stopPicking) return stopPicking();
    if (view === 'menu') view = 'closed';
    stopPicking = pick(host, box, (el) => {
      stopPicking = undefined;
      if (el) {
        picked = el;
        goTo('elements');
        filter.value = '';
        view = 'panel';
      }
      render();
    });
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view !== 'closed' && !cart.dialog.open) setView('closed');
  });
  const outside = (e: Event) => view === 'menu' && !e.composedPath().includes(host) && setView('closed');
  document.addEventListener('click', outside, true);
  engine.on('*', (e) => flow.record(e), { replay: true });
  engine.subscribe(later);
  engine.log.stream(
    (entry) => {
      flow.note(entry);
      later();
    },
    { replay: true },
  );
  (window as unknown as { nextDebug: unknown }).nextDebug = {
    explain: (el: Element) =>
      Object.fromEntries(explain(engine, el).map((n) => [n.attr, n.note ? `${n.value} → ${n.note}` : n.value])),
  };
  render();
}

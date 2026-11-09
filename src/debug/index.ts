import type { Line } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import type { PageConfig } from '../engine/debug-config';
import type { Send } from '../engine/types';
import { countElements, elementsView, explain, highlighter, pick } from './elements';
import { analyticsFlow } from './analytics';
import { cartView } from './cart';
import { benchmarkView } from './benchmark';
import { checkoutView } from './checkout';
import { configModal } from './config';
import { eventsView } from './events';
import { type IconName, icon } from './icons';
import { journeyView, pageKind } from './journey';
import { localeTab } from './locale';
import { issuesView } from './issues';
import { logsView } from './logs';
import { detailModal } from './stream';
import { menuView } from './menu';
import type { ProviderConfig } from './providers';
import { followTheme } from './theme';
import { createDebug } from './state';
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
import { type Child, h, iconButton, nodes, plural, priceText, tree } from './view';

const FILTERED: Tab[] = ['elements', 'analytics', 'events', 'logs'];
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
  /** The page's own nextConfig, before Page config tried one over it. */
  page: PageConfig;
  /** This page runs with the nextConfig Page config tries. */
  tried: boolean;
}

export function startDebug(engine: Engine, info: DebugInfo): void {
  const open = new Set(['cart']);
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
  let geoOpen = false;
  const queries: Partial<Record<Tab, string>> = {};

  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body scrollbar-sm');
  const menu = h('div', 'menu pop dropdown');
  const issues = h('span', 'issues');
  const filter = h('input', { type: 'search', className: 'input', placeholder: 'Filter…', oninput: () => render() });
  const search = h('div', 'search', filter);
  const button = (name: IconName, label: string, onclick: () => void) => iconButton(name, label, onclick, 'icon-sm');
  const bar = tabBar(
    (t) => show(t),
    () => togglePick(),
  );
  const flip = () => {
    right = !right;
    debug.setPanel({ right });
    render();
  };
  const dock = button('dockRight', 'Move to the right', flip);
  const globe = button('globe', 'Visitor geo', () => ((geoOpen = !geoOpen), render()));
  const switches = h('div', 'lswitch');
  const geo = h('div', 'geo pop scrollbar-sm');
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
      h('div', 'tabs', bar.strip),
      bar.select,
      globe,
      dock,
      button('close', 'Close', () => setView('closed')),
    ),
    switches,
    bar.menu,
    search,
    body,
    geo,
  );
  const hint = h('div', 'hint', 'Click an element to inspect it', h('span', 'dim', ' · Esc to cancel'));
  const root = h('div', 'root', panel, menu, fab, hint);
  const style = h(
    'style',
    {},
    ...[TSUGI_CSS, PANEL_CSS, CART_CSS, CHECKOUT_CSS, JOURNEY_CSS, LOCALE_CSS],
    ...[CONFIG_CSS, ANALYTICS_CSS, BENCH_CSS, STREAM_CSS],
  );
  let paymentIcons: Promise<void> | undefined;
  const loadPaymentIcons = () =>
    (paymentIcons ??= import('../../vendor/tsugi/payment-icons.css?raw').then((m) => style.append(m.default)));
  host.attachShadow({ mode: 'open' }).append(style, box.el, root);
  document.body.append(host);
  const theme = followTheme(host, () => debug.state().panel.theme);

  const query = () => filter.value.trim().toLowerCase();
  const detail = detailModal(open);
  const events = eventsView(engine, debug, { open, detail, render: () => render() });
  const pageConfig = configModal(engine, debug, info, () => render());
  const flow = analyticsFlow({
    config: info.analytics,
    detail,
    render: () => render(),
    price: (amount, currency) => priceText(engine, amount, currency),
  });
  const cart = cartView(engine, { open, render: () => render(), showState: () => show('state') });
  const journey = journeyView(engine, debug, {
    render: () => render(),
    show: (t) => show(t),
    detail,
    issues: () => findIssues().count + findIssues().earlier,
  });
  const checkout = checkoutView(engine, cart, { render: () => render(), paymentIcons: () => void loadPaymentIcons() });
  root.append(cart.dialog, pageConfig.dialog, detail.dialog);
  const bench = benchmarkView(engine);
  const logs = logsView(engine, detail, () => render());
  const locale = localeTab(engine, debug, info.send, () => later());

  let flash: { part: string; until: number } | undefined;
  const issueTab = issuesView(engine, debug, {
    checkout,
    flow,
    logs,
    box,
    show: (t) => show(t),
    focus: (t, part) => {
      flash = { part, until: Date.now() + 1600 };
      show(t);
      body.querySelector(`[data-focus="${part}"]`)?.scrollIntoView({ block: 'center' });
    },
    journey: () => journey.openNow(),
  });
  const findIssues = issueTab.find;

  const views: Record<Tab, () => Child[]> = {
    journey: () => journey.view(),
    issues: () => issueTab.view(),
    checkout: () => checkout.view(),
    state: () => Object.entries(engine.getState()).map(([k, v]) => tree(h('span', 'key', k), v, k, open)),
    elements: () =>
      elementsView(engine, box, picked, query(), () => {
        picked = undefined;
        render();
      }),
    analytics: () => flow.view(query()),
    events: () => events.view(query()),
    logs: () => logs.view(query()),
    benchmark: () => bench.view(),
  };

  const render = () => {
    const { count, tone } = findIssues();
    issues.textContent = count ? plural(count, 'Issue') : '';
    issues.className = `issues ${tone}`;
    root.dataset.view = view;
    root.classList.toggle('picking', !!stopPicking);
    root.classList.toggle('right', right);
    root.classList.toggle('dev', dev);
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
            events: events.count(),
            pageConfig,
            settings,
            setSettings: (on) => ((settings = on), render()),
            counts: () => ({ elements: countElements(), logs: engine.log.entries().length }),
            show,
            geo: () => ((geoOpen = true), show(tab)),
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
    switches.replaceChildren(...nodes(locale.switchers()));
    globe.setAttribute('aria-expanded', String(geoOpen));
    geo.hidden = !geoOpen;
    if (geoOpen) geo.replaceChildren(...nodes(locale.view()));
    bar.paint({
      tab,
      dev,
      issues: count,
      tone,
      setup: [
        ['API', info.apiBase.replace(/^https?:\/\//, '')],
        ['Funnel', info.funnel || '—'],
        ['Storage', info.scope],
      ],
    });
    search.hidden = !FILTERED.includes(tab);
    body.replaceChildren(...nodes(views[tab]()));
    if (flash && Date.now() < flash.until) body.querySelector(`[data-focus="${flash.part}"]`)?.classList.add('flash');
  };
  const setView = (next: typeof view) => {
    view = next;
    if (next !== 'menu') resetting = settings = false;
    if (next === 'closed') geoOpen = false;
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
    if (e.key !== 'Escape' || view === 'closed' || [cart, pageConfig, detail].some((d) => d.dialog.open)) return;
    if (bar.isOpen()) return bar.close();
    if (geoOpen) return ((geoOpen = false), render());
    setView('closed');
  });
  const outside = (e: Event) => {
    const path = e.composedPath();
    if (view === 'menu' && !path.includes(host)) setView('closed');
    if (geoOpen && !path.includes(geo) && !path.includes(globe)) ((geoOpen = false), later());
    if (bar.outside(path)) bar.close();
  };
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

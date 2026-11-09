import type { Line } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import type { PageConfig } from '../engine/debug-config';
import type { Send } from '../engine/types';
import { explain } from './elements';
import { analyticsFlow } from './analytics';
import { cartView } from './cart';
import { benchmarkView } from './benchmark';
import { checkoutView } from './checkout';
import { configModal } from './config';
import { eventsView } from './events';
import { journeyView, pageKind } from './journey';
import { localeTab } from './locale';
import { issuesView } from './issues';
import { logsView } from './logs';
import { focus, mount, paint, setView, type Shell, show, type Tabs, uiOf } from './shell';
import { detailModal } from './stream';
import type { ProviderConfig } from './providers';
import { followTheme } from './theme';
import { createDebug } from './state';
import type { Tab } from './tabs';
import { priceText } from './view';

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

/** Every tab's view, each told how to paint the panel and open another tab. */
function createTabs(s: Shell): Tabs {
  const { engine, debug, info, open } = s;
  const render = () => paint(s);
  const showTab = (t: Tab) => show(s, t);
  let paymentIcons: Promise<void> | undefined;
  const loadPaymentIcons = () =>
    (paymentIcons ??= import('../../vendor/tsugi/payment-icons.css?raw').then((m) => s.style.append(m.default)));
  const detail = detailModal(open);
  const events = eventsView(engine, debug, { open, detail, render });
  const pageConfig = configModal(engine, debug, info, render);
  const price = (amount: number, currency?: string) => priceText(engine, amount, currency);
  const flow = analyticsFlow({ config: info.analytics, detail, render, price });
  const cart = cartView(engine, { open, render, showState: () => showTab('state') });
  const journey = journeyView(engine, debug, {
    render,
    show: showTab,
    detail,
    issues: () => {
      const found = issues.find();
      return found.count + found.earlier;
    },
  });
  const checkout = checkoutView(engine, cart, { render, paymentIcons: () => void loadPaymentIcons() });
  const bench = benchmarkView(engine);
  const logs = logsView(engine, detail, render);
  const locale = localeTab(engine, debug, info.send, () => s.later());
  const issues = issuesView(engine, debug, {
    checkout,
    flow,
    logs,
    box: s.box,
    show: showTab,
    focus: (t, part) => focus(s, t, part),
    journey: () => journey.openNow(),
  });
  s.root.append(cart.dialog, pageConfig.dialog, detail.dialog);
  return { detail, events, pageConfig, flow, cart, journey, checkout, bench, logs, locale, issues };
}

/** Paints once on the next frame however often it is asked; returns what cancels a frame still to come. */
function frames(s: Shell) {
  let queued = false;
  let frame = 0;
  s.later = () => {
    if (queued) return;
    queued = true;
    frame = requestAnimationFrame(() => {
      queued = false;
      paint(s);
    });
  };
  return () => cancelAnimationFrame(frame);
}

/** Esc and outside clicks close what is open, until `signal` aborts; the engine's events, changes and log lines repaint. */
function listen(s: Shell, signal: AbortSignal): Array<() => void> {
  const { engine, ui, bar, flow } = s;
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || ui.view === 'closed') return;
    if ([s.cart, s.pageConfig, s.detail].some((d) => d.dialog.open)) return;
    if (bar.isOpen()) return bar.close();
    if (ui.geo) return ((ui.geo = false), paint(s));
    setView(s, 'closed');
  };
  const outside = (e: Event) => {
    const path = e.composedPath();
    if (ui.view === 'menu' && !path.includes(s.host)) setView(s, 'closed');
    if (ui.geo && !path.includes(s.geo) && !path.includes(s.globe)) ((ui.geo = false), s.later());
    if (bar.outside(path)) bar.close();
  };
  document.addEventListener('keydown', key, { signal });
  document.addEventListener('click', outside, { capture: true, signal });
  return [
    engine.on('*', (e) => flow.record(e), { replay: true }),
    engine.subscribe(s.later),
    engine.log.stream(
      (entry) => {
        flow.note(entry);
        s.later();
      },
      { replay: true },
    ),
  ];
}

/** Starts the debug panel; the function it returns takes it off the page and stops everything it listens to. */
export function startDebug(engine: Engine, info: DebugInfo): () => void {
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
  const s = { engine, debug, info, ui: uiOf(debug.state().panel), open: new Set(['cart']), queries: {} } as Shell;
  const done = new AbortController();
  const stopFrames = frames(s);
  Object.assign(s, mount(s));
  s.theme = followTheme(s.host, () => debug.state().panel.theme, done.signal);
  Object.assign(s, createTabs(s));
  const stops = listen(s, done.signal);
  const page = window as unknown as { nextDebug?: unknown };
  page.nextDebug = {
    explain: (el: Element) =>
      Object.fromEntries(explain(engine, el).map((n) => [n.attr, n.note ? `${n.value} → ${n.note}` : n.value])),
  };
  paint(s);
  return () => {
    done.abort();
    const { cart, events, journey, bench, locale } = s;
    for (const stop of [
      ...stops,
      stopFrames,
      debug.stop,
      cart.stop,
      events.stop,
      journey.stop,
      bench.stop,
      locale.stop,
    ])
      stop();
    s.stopPicking?.();
    s.host.remove();
    delete page.nextDebug;
  };
}

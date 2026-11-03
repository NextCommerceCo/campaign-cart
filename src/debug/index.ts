import type { ApiLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { format } from '../engine/format';
import { resolve } from '../engine/values';
import { card, countElements, explain, highlighter, inspect, matches, pick } from './elements';
import { analyticsFlow } from './analytics';
import { cartView } from './cart';
import { type IconName, icon } from './icons';
import { journeyView } from './journey';
import type { ProviderConfig } from './providers';
import { createDebug, type PageKind } from './state';
import { ANALYTICS_CSS, CART_CSS, JOURNEY_CSS, PANEL_CSS, TSUGI_CSS } from './styles';
import { badge, type Child, empty, h, nodes, time, tree, tsugi } from './view';

const TABS = {
  journey: 'Journey',
  issues: 'Issues',
  cart: 'Cart',
  analytics: 'Analytics',
  elements: 'Elements',
  state: 'State',
  logs: 'Logs',
};
const LEVELS = { debug: 'outline', info: 'info', warn: 'warning', error: 'destructive' };
type Tab = keyof typeof TABS;
const FILTERED: Tab[] = ['elements', 'analytics', 'logs'];
const LIMIT = 200;
export interface DebugInfo {
  version: string;
  apiBase: string;
  scope: string;
  funnel: string;
  arrived: { lines: ApiLine[]; reset: boolean };
  reset: () => void;
  off: () => void;
  analytics: () => ProviderConfig;
}

const PAGE_KINDS: PageKind[] = ['product', 'checkout', 'upsell', 'receipt'];

const pageKind = (): PageKind => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="next-page-type"]')?.content as PageKind;
  if (PAGE_KINDS.includes(meta)) return meta;
  if (document.querySelector('form[data-next-checkout]')) return 'checkout';
  if (document.querySelector('[data-next-upsell]')) return 'upsell';
  if (document.querySelector('[data-next-display^="order."]')) return 'receipt';
  return 'page';
};

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
  let queued = false;

  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body scrollbar-sm');
  const menu = h('div', 'menu pop');
  const issues = h('span', 'issues');
  const filter = h('input', { type: 'search', className: 'input', placeholder: 'Filter…', oninput: () => render() });
  const search = h('div', 'search', filter);
  const button = (name: IconName, label: string, onclick: () => void) => {
    const el = tsugi(h('button', { type: 'button', className: 'btn', title: label, onclick }, icon(name)), {
      variant: 'ghost',
      size: 'icon-sm',
    });
    el.setAttribute('aria-label', label);
    return el;
  };
  const tabs = (Object.keys(TABS) as Tab[]).map((t) => {
    const el = h('button', { type: 'button', onclick: () => show(t) }, TABS[t]);
    el.dataset.tab = t;
    el.setAttribute('role', 'tab');
    return el;
  });
  const tablist = tsugi(h('div', {}, ...tabs), { size: 'sm' });
  const tabpick = h(
    'select',
    { className: 'select tabpick', onchange: () => show(tabpick.value as Tab) },
    ...(Object.keys(TABS) as Tab[]).map((t) => h('option', { value: t }, TABS[t])),
  );
  tabpick.setAttribute('aria-label', 'Panel tab');
  tablist.setAttribute('role', 'tablist');
  const dock = button('dockRight', 'Move to the right', () => {
    right = !right;
    debug.setPanel({ right });
    render();
  });
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
      h('div', 'tabs', tablist),
      tabpick,
      button('pick', 'Pick an element', () => togglePick()),
      dock,
      button('close', 'Close', () => setView('closed')),
    ),
    search,
    body,
  );
  const hint = h('div', 'hint', 'Click an element to inspect it', h('span', 'dim', ' · Esc to cancel'));
  const root = h('div', 'root', panel, menu, fab, hint);
  host
    .attachShadow({ mode: 'open' })
    .append(h('style', {}, TSUGI_CSS, PANEL_CSS, ANALYTICS_CSS, CART_CSS, JOURNEY_CSS), box.el, root);
  document.body.append(host);
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => host.classList.toggle('dark', scheme.matches);
  scheme.addEventListener('change', theme);
  theme();

  const query = () => filter.value.trim().toLowerCase();
  const flow = analyticsFlow({ open, idOf, render: () => render(), config: info.analytics });
  const cart = cartView(engine, { open, render: () => render(), showState: () => show('state') });
  const journey = journeyView(engine, debug, { render: () => render() });
  root.append(cart.dialog);
  const stamp = (at: number) => h('span', 'time', time(at));
  const logRow = (e: LogEntry) => {
    const label = h('span', {}, stamp(e.at), badge(e.level, LEVELS[e.level]), ' ', e.message);
    return e.data === undefined ? h('div', 'row', label) : tree(label, e.data, `l${idOf(e)}`, open);
  };
  const cartText = () => {
    const { campaign } = engine.getState();
    const units = Number(resolve(engine, 'cart.quantity')?.value ?? 0);
    const total = resolve(engine, 'cart.total');
    if (!units) return 'Empty';
    const price = total?.value === undefined ? '' : ` · ${format(total, campaign?.currency, campaign?.language)}`;
    return `${units} item${units === 1 ? '' : 's'}${price}`;
  };
  const item = (label: string, value: Child, onclick?: () => void, className = '') => {
    const content = [h('span', {}, label), h('span', 'value', value)];
    return onclick
      ? h('button', { type: 'button', className: `item ${className}`, onclick }, ...content)
      : h('div', `item ${className}`, ...content);
  };

  const findIssues = () => {
    const page = inspect(engine).filter((i) => i.bad);
    const shownOnPage = page.flatMap((i) => i.notes.filter((n) => n.bad).map((n) => `"${n.value}"`));
    const logged = engine.log
      .entries()
      .filter((e) => (e.level === 'warn' || e.level === 'error') && !shownOnPage.some((v) => e.message.includes(v)))
      .reverse();
    const tone = logged.some((e) => e.level === 'error') ? 'red' : 'amber';
    return { page, logged, count: page.length + logged.length, tone };
  };

  const views: Record<Tab, () => Child[]> = {
    journey: () => journey.view(),
    issues: () => {
      const { page, logged } = findIssues();
      if (!page.length && !logged.length)
        return [empty('No issues', 'Every SDK attribute on this page resolves, and no warnings were logged.', 'check')];
      return [
        page.length > 0 && h('h3', {}, `Page setup · ${page.length}`),
        ...page.map((i) => card(i, box)),
        logged.length > 0 && h('h3', {}, `Warnings and errors · ${logged.length}`),
        ...logged.map(logRow),
      ];
    },
    cart: () => cart.view(),
    state: () => Object.entries(engine.getState()).map(([k, v]) => tree(h('span', 'key', k), v, k, open)),
    elements: () => {
      const found = inspect(engine, picked).filter((i) => matches(i, query()));
      const bad = found.filter((i) => i.bad).length;
      if (!found.length) return [empty('Nothing matches', 'No element with a data-next-* attribute fits the filter.')];
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
    logs: () => {
      const rows = engine.log
        .entries()
        .filter((e) => e.message.toLowerCase().includes(query()))
        .slice(-150)
        .reverse()
        .map(logRow);
      return rows.length ? rows : [empty('Nothing matches')];
    },
  };

  const menuItems = (): Child[] => {
    const { campaign } = engine.getState();
    const { count, tone } = findIssues();
    return [
      item('Issues', h('span', `count ${count ? tone : 'green'}`, count ? String(count) : 'None'), () =>
        show('issues'),
      ),
      item('Journey', `${debug.state().pages.length} pages in this tab`, () => show('journey')),
      item('Cart', cartText(), () => show('cart')),
      item('Elements', String(countElements()), () => show('elements')),
      item('Analytics', flow.summary(), () => show('analytics')),
      item('Logs', String(engine.log.entries().length), () => show('logs')),
      h('hr'),
      item('Pick an element', icon('pick'), () => togglePick()),
      h('hr'),
      item('Campaign', campaign ? `${campaign.name} · ${campaign.currency}` : 'Loading…'),
      item('SDK', `v${info.version}`),
      item('API', info.apiBase.replace(/^https?:\/\//, '')),
      item('Funnel', info.funnel || '—'),
      item('Storage', info.scope),
      h('hr'),
      item('Position', right ? 'Right' : 'Left', () => {
        right = !right;
        debug.setPanel({ right });
        render();
      }),
      item('Reset saved data', '', info.reset, 'danger'),
      item('Turn off debug', 'stays on in this tab until then', info.off, 'danger'),
    ];
  };

  const render = () => {
    const { count, tone } = findIssues();
    issues.textContent = count ? `${count} Issue${count === 1 ? '' : 's'}` : '';
    issues.className = `issues ${tone}`;
    root.dataset.view = view;
    root.classList.toggle('picking', !!stopPicking);
    root.classList.toggle('right', right);
    dock.title = right ? 'Move to the left' : 'Move to the right';
    dock.replaceChildren(icon(right ? 'dockLeft' : 'dockRight'));
    if (view === 'menu') menu.replaceChildren(...nodes(menuItems()));
    if (view !== 'panel') return;
    tabs.forEach((el) => {
      el.setAttribute('aria-selected', String(el.dataset.tab === tab));
      if (el.dataset.tab === 'issues')
        el.replaceChildren(
          TABS.issues,
          ...nodes([count > 0 && badge(String(count), tone === 'red' ? 'destructive' : 'warning')]),
        );
    });
    tabpick.value = tab;
    tabpick.querySelector('[value="issues"]')!.textContent = count ? `${TABS.issues} · ${count}` : TABS.issues;
    search.hidden = !FILTERED.includes(tab);
    body.replaceChildren(...nodes(views[tab]()));
    if (tab === 'journey') journey.draw();
  };
  const setView = (next: typeof view) => {
    view = next;
    if (next !== 'menu') debug.setPanel({ open: next === 'panel', tab });
    render();
  };
  const show = (next: Tab) => {
    tab = next;
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
        tab = 'elements';
        view = 'panel';
      }
      render();
    });
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view !== 'closed' && !cart.dialog.open) setView('closed');
  });
  document.addEventListener('click', (e) => {
    if (view === 'menu' && !e.composedPath().includes(host)) setView('closed');
  });
  engine.on(
    '*',
    (e) => {
      flow.record(e);
      engine.log.debug(`event ${e.name}`, e.data);
    },
    { replay: true },
  );
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

import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { format } from '../engine/format';
import { resolve } from '../engine/values';
import { card, countElements, explain, highlighter, inspect, matches, pick } from './elements';
import { analyticsFlow } from './analytics';
import { cartView } from './cart';
import type { ProviderConfig } from './providers';
import { ANALYTICS_CSS, CART_CSS, PANEL_CSS } from './styles';
import { type Child, empty, h, nodes, time, tree } from './view';

const LOGO =
  '<svg viewBox="0 0 148 148" fill="currentColor" stroke="currentColor" stroke-width="2.5"><path d="M100.143 81.8349L98.205 80.5596L43.8535 44.7978C43.1486 44.378 42.4606 44.1524 41.8457 44.1523C39.8673 44.1523 38.258 45.7609 38.2578 47.7392V101.117C38.2579 103.095 39.8673 104.704 41.8457 104.704H45.6807V117.046H41.8457C33.0653 117.046 26 109.98 26 101.2V47.8232C26 39.0429 33.0653 31.9775 41.8457 31.9775C44.9198 31.9776 48.002 32.8807 50.5537 34.6123L99.596 67.9736L100.143 68.3457V81.8349Z"/><path d="M106.818 31.9775C115.599 31.9775 122.664 39.0429 122.664 47.8232V101.2C122.664 109.98 115.599 117.046 106.818 117.046C103.744 117.046 100.662 116.142 98.11 114.411L49.0684 81.0498L48.5215 80.6777V67.1914L50.457 68.4629L104.802 104.136C105.51 104.56 106.201 104.788 106.818 104.788C108.797 104.788 110.406 103.178 110.406 101.2V47.8232C110.406 45.8447 108.797 44.2353 106.818 44.2353H102.983V31.9775H106.818Z"/></svg>';
const PICK =
  '<svg viewBox="0 0 16 16"><path d="M3 2l10 5-4.2 1.3L7.5 13z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const CLOSE =
  '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const TABS = {
  issues: 'Issues',
  cart: 'Cart',
  state: 'State',
  elements: 'Elements',
  analytics: 'Analytics',
  logs: 'Logs',
};
type Tab = keyof typeof TABS;
const FILTERED: Tab[] = ['elements', 'analytics', 'logs'];
const LIMIT = 200;
export interface DebugInfo {
  version: string;
  apiBase: string;
  scope: string;
  funnel: string;
  reset: () => void;
  analytics: () => ProviderConfig;
}

const svg = (markup: string, className: string) => {
  const el = h('span', className);
  el.innerHTML = markup;
  return el;
};

export function startDebug(engine: Engine, info: DebugInfo): void {
  const open = new Set(['cart']);
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  let view: 'closed' | 'menu' | 'panel' = 'closed';
  let tab: Tab = 'issues';
  let picked: Element | undefined;
  let stopPicking: (() => void) | undefined;
  let right = false;
  let queued = false;

  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body');
  const menu = h('div', 'menu pop');
  const issues = h('span', 'issues');
  const filter = h('input', { type: 'search', placeholder: 'Filter…', oninput: () => render() });
  const search = h('div', 'search', filter);
  const button = (markup: string, label: string, onclick: () => void) => {
    const el = h('button', { type: 'button', className: 'icon', title: label, onclick }, svg(markup, ''));
    el.setAttribute('aria-label', label);
    return el;
  };
  const tabs = (Object.keys(TABS) as Tab[]).map((t) => {
    const el = h('button', { type: 'button', onclick: () => show(t) }, TABS[t]);
    el.dataset.tab = t;
    return el;
  });
  const fab = h(
    'button',
    {
      type: 'button',
      className: 'fab',
      title: 'Campaign SDK debug',
      onclick: () => setView(view === 'closed' ? 'menu' : 'closed'),
    },
    svg(LOGO, 'logo'),
    issues,
  );
  const panel = h(
    'div',
    'panel pop',
    h(
      'div',
      'head',
      h('div', 'tabs', ...tabs),
      button(PICK, 'Pick an element', () => togglePick()),
      button(CLOSE, 'Close', () => setView('closed')),
    ),
    search,
    body,
  );
  const hint = h('div', 'hint', 'Click an element to inspect it', h('span', 'dim', ' · Esc to cancel'));
  const root = h('div', 'root', panel, menu, fab, hint);
  host.attachShadow({ mode: 'open' }).append(h('style', {}, PANEL_CSS, ANALYTICS_CSS, CART_CSS), box.el, root);
  document.body.append(host);

  const query = () => filter.value.trim().toLowerCase();
  const flow = analyticsFlow({ open, idOf, render: () => render(), config: info.analytics });
  const cart = cartView(engine, { open, render: () => render(), showState: () => show('state') });
  const stamp = (at: number) => h('span', 'time', time(at));
  const logRow = (e: LogEntry) => {
    const label = h('span', {}, stamp(e.at), h('span', `lv ${e.level}`, e.level), e.message);
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
    issues: () => {
      const { page, logged } = findIssues();
      if (!page.length && !logged.length)
        return [
          empty('No issues', 'Every SDK attribute on this page resolves, and no warnings were logged.', 'empty ok'),
        ];
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
      item('Cart', cartText(), () => show('cart')),
      item('Elements', String(countElements()), () => show('elements')),
      item('Analytics', flow.summary(), () => show('analytics')),
      item('Logs', String(engine.log.entries().length), () => show('logs')),
      h('hr'),
      item('Pick an element', svg(PICK, ''), () => togglePick()),
      h('hr'),
      item('Campaign', campaign ? `${campaign.name} · ${campaign.currency}` : 'Loading…'),
      item('SDK', `v${info.version}`),
      item('API', info.apiBase.replace(/^https?:\/\//, '')),
      item('Funnel', info.funnel || '—'),
      item('Storage', info.scope),
      h('hr'),
      item('Position', right ? 'Right' : 'Left', () => {
        right = !right;
        render();
      }),
      item('Reset saved data', '', info.reset, 'danger'),
    ];
  };

  const render = () => {
    const { count, tone } = findIssues();
    issues.textContent = count ? `${count} Issue${count === 1 ? '' : 's'}` : '';
    issues.className = `issues ${tone}`;
    root.dataset.view = view;
    root.classList.toggle('picking', !!stopPicking);
    root.classList.toggle('right', right);
    if (view === 'menu') menu.replaceChildren(...nodes(menuItems()));
    if (view !== 'panel') return;
    tabs.forEach((el) => el.setAttribute('aria-selected', String(el.dataset.tab === tab)));
    search.hidden = !FILTERED.includes(tab);
    body.replaceChildren(...nodes(views[tab]()));
  };
  const setView = (next: typeof view) => {
    view = next;
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
    if (e.key === 'Escape' && view !== 'closed') setView('closed');
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

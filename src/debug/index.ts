import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { format, resolve } from '../engine/values';
import { card, countElements, explain, highlighter, inspect, matches, pick } from './elements';
import { ANALYTICS_CSS, analyticsFlow, type ProviderConfig } from './analytics';
import { type Child, empty, h, nodes, time, tree } from './view';

const CSS = `:host{all:initial;color-scheme:dark;--bg:#0a0a0a;--raised:#141414;--fg:#ededed;--muted:#a1a1a1;--line:#2e2e2e;--hover:#1f1f1f;--red:#ff6166;--amber:#f2a43a;--green:#5fc36e;--blue:#52a8ff;--purple:#c27cf8;--orange:#ff8a3d;--sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:light){:host{color-scheme:light;--bg:#fff;--raised:#fafafa;--fg:#171717;--muted:#6b6b6b;--line:#e6e6e6;--hover:#f2f2f2;--red:#d93036;--amber:#a35200;--green:#297a3a;--blue:#0068d6;--purple:#8e4ec6;--orange:#c2410c}}
*{box-sizing:border-box}
[hidden]{display:none!important}
.root{font:13px/1.5 var(--sans);color:var(--fg);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.fab,.menu,.panel,.hint{position:fixed;z-index:2147483646}
.fab{left:20px;bottom:20px;display:flex;align-items:center;gap:6px;height:40px;padding:4px;border-radius:999px;background:#0a0a0a;color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .15s}
.fab:hover{transform:scale(1.04)}
.logo{display:grid;place-items:center;width:30px;height:30px}
.logo svg{width:30px;height:30px}
.issues{padding:0 10px 0 2px;font-size:12px;font-weight:600}
.issues:empty{display:none}
.issues::before{content:'';display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:currentColor}
.fab .red{color:#ff6166}.fab .amber{color:#f2a43a}
.menu,.panel{left:20px;bottom:72px;display:none;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
.right .fab,.right .menu,.right .panel{left:auto;right:20px}
[data-view=menu] .menu{display:block}
[data-view=panel] .panel{display:flex}
.picking .menu,.picking .panel{display:none!important}
.pop{animation:pop .16s ease-out;transform-origin:bottom left}
.right .pop{transform-origin:bottom right}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}}
@media (prefers-reduced-motion:reduce){.pop{animation:none}.fab{transition:none}}
.menu{width:272px;padding:6px}
.item{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:7px 10px;border-radius:8px;text-align:left}
button.item:hover{background:var(--hover)}
.value{max-width:60%;overflow:hidden;color:var(--muted);font-size:12px;white-space:nowrap;text-overflow:ellipsis}
.value svg{display:block;width:14px;height:14px}
.danger{color:var(--red)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--line)}
.count{font-weight:600}
.red{color:var(--red)}.amber{color:var(--amber)}.green{color:var(--green)}.blue{color:var(--blue)}.purple{color:var(--purple)}.dim,.time{color:var(--muted)}
.panel{flex-direction:column;width:min(600px,calc(100vw - 40px));height:min(640px,calc(100vh - 100px))}
.head{display:flex;align-items:center;gap:4px;padding:8px;border-bottom:1px solid var(--line)}
.tabs{display:flex;flex:1;gap:2px;overflow-x:auto}
.tabs button{padding:5px 10px;border-radius:6px;color:var(--muted);white-space:nowrap}
.tabs button:hover,.tabs [aria-selected=true]{color:var(--fg)}
.tabs [aria-selected=true]{background:var(--hover)}
.icon{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;color:var(--muted)}
.icon:hover{background:var(--hover);color:var(--fg)}
.icon svg{width:16px;height:16px}
.search{padding:8px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;padding:6px 10px;font:inherit;color:var(--fg);background:var(--raised);border:1px solid var(--line);border-radius:8px;outline:0}
input[type=search]:focus{border-color:var(--blue)}
.body{flex:1;overflow:auto;padding:8px 12px 12px;font:12px/1.6 var(--mono)}
h3{margin:14px 0 6px;font:600 11px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.summary{margin:2px 0 8px;font-family:var(--sans);color:var(--muted)}
.link{margin-left:8px;color:var(--blue)}
.empty{display:grid;place-items:center;gap:4px;padding:56px 16px;font-family:var(--sans);text-align:center;color:var(--muted)}
.empty b{font-size:15px;color:var(--fg)}
.ok b::before{content:'✓ ';color:var(--green)}
.row,summary{padding:3px 6px;border-radius:6px;white-space:pre-wrap;word-break:break-word}
summary{list-style:none;cursor:pointer}
summary::-webkit-details-marker{display:none}
summary::before{content:'▸';display:inline-block;width:14px;color:var(--muted);transition:transform .12s}
details[open]>summary::before{transform:rotate(90deg)}
summary:hover,.row:hover{background:var(--hover)}
details details,details>.row{margin-left:14px}
.key,.name{color:var(--purple)}.s,.note{color:var(--green)}.n{color:var(--blue)}.b{color:var(--amber)}
.time{margin-right:8px}
.lv{display:inline-block;margin-right:8px;padding:0 6px;border-radius:4px;background:var(--hover);font-size:11px}
.lv{min-width:44px;text-align:center}
.lv.debug{color:var(--muted)}.lv.info{color:var(--blue)}.lv.warn{color:var(--amber)}.lv.error{color:var(--red)}
.card{margin-bottom:6px;padding:8px 10px;background:var(--raised);border:1px solid var(--line);border-radius:8px;cursor:pointer}
.card:hover{border-color:var(--blue)}
.card.bad{border-left:3px solid var(--red)}
.tagname{font-weight:600;color:var(--blue)}
.class-tag{margin-left:6px;padding:0 6px;border-radius:999px;background:var(--hover);color:var(--muted);font-size:11px}
.attr{margin-top:2px;word-break:break-word}
.attr.bad .note{color:var(--red)}
.hint{top:16px;left:50%;display:none;padding:8px 16px;border-radius:999px;background:#0a0a0a;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:nowrap;transform:translateX(-50%)}
.picking .hint{display:block}
.hint .dim{color:#a1a1a1}
.box{position:fixed;z-index:2147483645;display:none;pointer-events:none;border:2px solid #3b82f6;border-radius:3px;background:rgba(59,130,246,.12)}
.box span{position:absolute;left:-2px;top:-24px;padding:2px 6px;border-radius:4px;background:#0a0a0a;color:#fff;white-space:nowrap;font:11px var(--mono)}`;

const LOGO =
  '<svg viewBox="0 0 148 148" fill="currentColor" stroke="currentColor" stroke-width="2.5"><path d="M100.143 81.8349L98.205 80.5596L43.8535 44.7978C43.1486 44.378 42.4606 44.1524 41.8457 44.1523C39.8673 44.1523 38.258 45.7609 38.2578 47.7392V101.117C38.2579 103.095 39.8673 104.704 41.8457 104.704H45.6807V117.046H41.8457C33.0653 117.046 26 109.98 26 101.2V47.8232C26 39.0429 33.0653 31.9775 41.8457 31.9775C44.9198 31.9776 48.002 32.8807 50.5537 34.6123L99.596 67.9736L100.143 68.3457V81.8349Z"/><path d="M106.818 31.9775C115.599 31.9775 122.664 39.0429 122.664 47.8232V101.2C122.664 109.98 115.599 117.046 106.818 117.046C103.744 117.046 100.662 116.142 98.11 114.411L49.0684 81.0498L48.5215 80.6777V67.1914L50.457 68.4629L104.802 104.136C105.51 104.56 106.201 104.788 106.818 104.788C108.797 104.788 110.406 103.178 110.406 101.2V47.8232C110.406 45.8447 108.797 44.2353 106.818 44.2353H102.983V31.9775H106.818Z"/></svg>';
const PICK =
  '<svg viewBox="0 0 16 16"><path d="M3 2l10 5-4.2 1.3L7.5 13z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const CLOSE =
  '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const TABS = { issues: 'Issues', state: 'State', elements: 'Elements', analytics: 'Analytics', logs: 'Logs' };
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
  host.attachShadow({ mode: 'open' }).append(h('style', {}, CSS, ANALYTICS_CSS), box.el, root);
  document.body.append(host);

  const query = () => filter.value.trim().toLowerCase();
  const flow = analyticsFlow({ open, idOf, render: () => render(), config: info.analytics });
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
      item('Cart', cartText(), () => show('state')),
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

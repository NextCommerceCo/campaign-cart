import type { Engine } from '../engine/engine';
import type { EngineEvent } from '../engine/events';
import { elementsView, explain, highlighter, pick } from './elements';
import { h, tree } from './view';

const CSS = `:host{all:initial}
.root{position:fixed;right:12px;bottom:12px;z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#111}
button{font:inherit;color:#111;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:2px 8px;cursor:pointer}
button[aria-pressed=true]{background:#111;color:#fff;border-color:#111}
.toggle{background:#111;color:#fff;border:0;border-radius:999px;padding:8px 12px}
.badge{margin-left:6px;padding:0 6px;border-radius:999px;background:#f5c518;color:#111}
.badge.err{background:#d33;color:#fff}
.badge:empty{display:none}
.panel{display:none;flex-direction:column;width:min(calc(100vw - 24px),480px);max-height:70vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
.open .panel{display:flex}
.bar{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-bottom:1px solid #eee}
input{font:inherit;flex:1;min-width:80px;border:1px solid #ddd;border-radius:4px;padding:2px 6px}
.body{overflow:auto;padding:6px 8px}
.row,summary{white-space:pre-wrap;word-break:break-word}
summary{cursor:pointer}
details details,details>.row{margin-left:14px}
.warn{background:#fff8db}.error{background:#fdecec}
.key{color:#871094}.s{color:#067d17}.n{color:#1750eb}.b{color:#a35a00}.dim{color:#888}.bad{color:#c00}
.el{padding:4px 0;border-bottom:1px solid #f0f0f0;cursor:pointer}.el:hover{background:#f3f7ff}
.attr{margin-left:12px;word-break:break-word}.note{color:#1750eb}.bad .note{color:#c00}
.tag{margin-left:6px;padding:0 4px;border-radius:3px;background:#eef;color:#335}
.box{position:fixed;display:none;pointer-events:none;z-index:2147483645;border:2px solid #2563eb;background:rgba(37,99,235,.1)}
.box span{position:absolute;left:-2px;top:-20px;padding:1px 4px;background:#2563eb;color:#fff;white-space:nowrap;font:11px ui-monospace,monospace}`;

const TABS = ['state', 'events', 'logs', 'elements', 'setup'] as const;
type Tab = (typeof TABS)[number];

export interface DebugInfo {
  version: string;
  apiBase: string;
  scope: string;
  funnel: string;
  reset: () => void;
}

const time = (at: number) => {
  const d = new Date(at);
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

export function startDebug(engine: Engine, info: DebugInfo): void {
  const events: EngineEvent[] = [];
  const open = new Set<string>();
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  let tab: Tab = 'state';
  let picked: Element | undefined;
  let stopPicking: (() => void) | undefined;
  let warnings = 0;
  let errors = 0;
  let queued = false;

  const host = document.createElement('next-debug');
  const box = highlighter();
  const body = h('div', 'body');
  const badge = h('span', 'badge');
  const filter = h('input', { type: 'search', placeholder: 'filter', oninput: () => render() });
  const pickButton = h(
    'button',
    { type: 'button', title: 'Pick an element on the page', onclick: () => togglePick() },
    'pick',
  );
  const tabs = TABS.map((t) => {
    const button = h('button', { type: 'button', onclick: () => select(t) }, t);
    button.dataset.tab = t;
    return button;
  });
  const root = h(
    'div',
    'root',
    h('div', 'panel', h('div', 'bar', ...tabs, filter, pickButton), body),
    h('button', { type: 'button', className: 'toggle', onclick: () => toggle() }, 'next', badge),
  );
  host.attachShadow({ mode: 'open' }).append(h('style', {}, CSS), box.el, root);
  document.body.append(host);

  const query = () => filter.value.trim().toLowerCase();
  const label = (at: number, text: string) => h('span', {}, h('span', 'dim', time(at)), ` ${text}`);
  const views: Record<Tab, () => Node[]> = {
    state: () => Object.entries(engine.getState()).map(([k, v]) => tree(h('span', 'key', k), v, k, open)),
    events: () =>
      events
        .filter((e) => !query() || `${e.name} ${JSON.stringify(e.data)}`.toLowerCase().includes(query()))
        .slice(-100)
        .reverse()
        .map((e) => tree(label(e.at, e.name), e.data, `e${idOf(e)}`, open)),
    logs: () =>
      engine.log
        .entries()
        .filter((e) => e.message.toLowerCase().includes(query()))
        .slice(-150)
        .reverse()
        .map((e) => {
          const text = label(e.at, `${e.level.padEnd(5)} ${e.message}`);
          const row = e.data === undefined ? h('div', 'row', text) : tree(text, e.data, `l${idOf(e)}`, open);
          row.classList.add(e.level);
          return row;
        }),
    elements: () => elementsView(engine, box, query(), picked, () => showPicked(undefined)),
    setup: () => {
      const { campaign } = engine.getState();
      const rows = {
        version: info.version,
        api: info.apiBase,
        campaign: campaign ? `${campaign.name} (${campaign.currency})` : 'loading',
        scope: info.scope,
        funnel: info.funnel || '(none)',
      };
      return [
        ...Object.entries(rows).map(([k, v]) => h('div', 'row', h('span', 'key', k.padEnd(9)), v)),
        h('p', 'dim', "Reset clears this funnel's saved cart, form and order, then reloads."),
        h('button', { type: 'button', onclick: info.reset }, 'reset'),
      ];
    },
  };

  const render = () => {
    badge.textContent = warnings + errors ? String(warnings + errors) : '';
    badge.classList.toggle('err', errors > 0);
    if (!root.classList.contains('open')) return;
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    filter.hidden = tab === 'state' || tab === 'setup';
    body.replaceChildren(...views[tab]());
  };
  const select = (next: Tab) => {
    tab = next;
    render();
  };
  const toggle = () => {
    root.classList.toggle('open');
    render();
  };
  const showPicked = (el: Element | undefined) => {
    picked = el;
    root.classList.add('open');
    select('elements');
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
    pickButton.setAttribute('aria-pressed', 'true');
    stopPicking = pick(host, box, (el) => {
      stopPicking = undefined;
      pickButton.setAttribute('aria-pressed', 'false');
      if (el) showPicked(el);
    });
  };

  engine.on(
    '*',
    (e) => {
      events.push(e);
      if (events.length > 200) events.shift();
      engine.log.debug(`event ${e.name}`, e.data);
    },
    { replay: true },
  );
  engine.subscribe(later);
  engine.log.stream(
    (entry) => {
      if (entry.level === 'warn') warnings++;
      if (entry.level === 'error') errors++;
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

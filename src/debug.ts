import type { Engine } from './engine/engine';
import type { EngineEvent } from './engine/events';

const CSS = `.next-debug{position:fixed;right:12px;bottom:12px;z-index:2147483646;font:12px/1.4 ui-monospace,Menlo,monospace;color:#111}
.next-debug__toggle{background:#111;color:#fff;border:0;border-radius:999px;padding:8px 12px;cursor:pointer}
.next-debug__panel{display:none;width:min(92vw,420px);max-height:70vh;overflow:auto;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.15);margin-bottom:8px}
.next-debug--open .next-debug__panel{display:block}
.next-debug__bar{display:flex;gap:4px;padding:6px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff}
.next-debug__bar button{border:1px solid #ddd;background:#f7f7f7;border-radius:4px;padding:2px 8px;cursor:pointer}
.next-debug__bar button[aria-pressed=true]{background:#111;color:#fff}
.next-debug pre{margin:0;padding:8px;white-space:pre-wrap;word-break:break-word}`;

const TABS = ['state', 'events', 'logs', 'storage'] as const;
type Tab = (typeof TABS)[number];

export function startDebug(engine: Engine, info: { scope: string; funnel: string; reset: () => void }): void {
  const events: EngineEvent[] = [];
  let tab: Tab = 'state';
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const root = Object.assign(document.createElement('div'), { className: 'next-debug' });
  const tabs = TABS.map((t) => `<button type="button" data-tab="${t}">${t}</button>`).join('');
  const bar = `<div class="next-debug__bar">${tabs}<button type="button" data-reset>reset</button></div>`;
  root.innerHTML = `<div class="next-debug__panel">${bar}<pre></pre></div><button type="button" class="next-debug__toggle">next</button>`;
  document.body.append(root);
  const pre = root.querySelector('pre')!;

  const time = (at: number) => new Date(at).toLocaleTimeString();
  const views: Record<Tab, () => string> = {
    state: () => {
      const { campaign, ...state } = engine.getState();
      return JSON.stringify(
        { campaign: campaign && { name: campaign.name, currency: campaign.currency }, ...state },
        null,
        2,
      );
    },
    events: () =>
      events
        .slice(-50)
        .reverse()
        .map((e) => `${time(e.at)} ${e.name} ${JSON.stringify(e.data).slice(0, 200)}`)
        .join('\n'),
    logs: () =>
      engine.log
        .entries()
        .slice(-100)
        .reverse()
        .map((e) => `${time(e.at)} ${e.level.padEnd(5)} ${e.message}`)
        .join('\n'),
    storage: () =>
      `scope   ${info.scope}\nfunnel  ${info.funnel || '(none)'}\n\nreset clears this funnel's saved cart, form and order.`,
  };

  const render = () => {
    if (!root.classList.contains('next-debug--open')) return;
    root
      .querySelectorAll<HTMLElement>('[data-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    pre.textContent = views[tab]();
  };

  root.querySelector('.next-debug__toggle')!.addEventListener('click', () => {
    root.classList.toggle('next-debug--open');
    render();
  });
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      render();
    }),
  );
  root.querySelector('[data-reset]')!.addEventListener('click', info.reset);
  engine.on(
    '*',
    (e) => {
      events.push(e);
      if (events.length > 200) events.shift();
      engine.log.debug(`event ${e.name}`, e.data);
    },
    { replay: true },
  );
  engine.subscribe(render);
  engine.log.stream(() => tab === 'logs' && render());
}

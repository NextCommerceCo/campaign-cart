import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { icon } from './icons';
import type { DebugActions, Mark, PageKind, PageVisit } from './state';
import { badge, type Child, clock, empty, h, plural, tsugi, tsugiCard } from './view';

const KINDS: Record<PageKind, string> = {
  product: 'Landing',
  checkout: 'Checkout',
  upsell: 'Upsell',
  receipt: 'Receipt',
  page: 'Page',
};
const SVG = 'http://www.w3.org/2000/svg';
const GUTTER = 12;
const RADIUS = 6;

const stayed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const problems = (p: PageVisit) => p.marks.filter((m) => m.tone === 'warn' || m.tone === 'error').length;

export function drawLines(journey: HTMLElement) {
  const list = journey.querySelector<HTMLElement>(':scope > ol');
  if (!list) return;
  const box = list.getBoundingClientRect();
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(list.offsetWidth));
  svg.setAttribute('height', String(list.offsetHeight));
  Object.assign(svg.style, { left: `${list.offsetLeft}px`, top: `${list.offsetTop}px` });
  const rows = [...list.querySelectorAll(':scope > li button')].map((b) => b.getBoundingClientRect());
  rows.slice(0, -1).forEach((a, i) => {
    const b = rows[i + 1]!;
    const [x1, x2] = [a.left - box.left, b.left - box.left];
    const [y1, y2] = [a.top + a.height / 2 - box.top, b.top + b.height / 2 - box.top];
    const gutter = x1 - GUTTER;
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute(
      'd',
      `M ${x1} ${y1} H ${gutter + RADIUS} Q ${gutter} ${y1} ${gutter} ${y1 + RADIUS} V ${y2 - RADIUS} Q ${gutter} ${y2} ${gutter + RADIUS} ${y2} H ${x2}`,
    );
    svg.append(path);
  });
  journey.querySelector(':scope > svg')?.remove();
  journey.append(svg);
}

export function journeyView(engine: Engine, debug: DebugActions, ui: { render: () => void }) {
  let picked: number | undefined;
  let drawn: HTMLElement | undefined;

  const money = (p: PageVisit) => {
    const { campaign } = engine.getState();
    if (p.total === undefined) return '—';
    return format({ type: 'money', value: Number(p.total) }, p.currency ?? campaign?.currency, campaign?.language);
  };

  const step = (p: PageVisit, i: number, pages: PageVisit[], selected: number) => {
    const next = pages[i + 1];
    const issues = problems(p);
    const row = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          picked = i;
          ui.render();
        },
      },
      h(
        'span',
        {},
        p.title || p.path,
        !next && badge('Now', 'outline'),
        p.reloads > 0 && badge(p.reloads > 1 ? `Reloaded ×${p.reloads}` : 'Reloaded', 'secondary'),
        p.upsell &&
          badge(p.upsell === 'accepted' ? 'Accepted' : 'Declined', p.upsell === 'accepted' ? 'success' : 'outline'),
        issues > 0 && badge(plural(issues, 'problem'), 'destructive'),
      ),
      h('small', {}, p.path),
      h('data', {}, p.order || p.units ? money(p) : 'Empty cart'),
      h('data', {}, p.order ? `order ${p.order}` : plural(p.units, 'item')),
    );
    row.setAttribute('aria-pressed', String(i === selected));
    return h(
      'li',
      {},
      h(
        'header',
        {},
        h('span', {}, `Step ${i + 1}`),
        h('strong', {}, KINDS[p.kind]),
        h('small', {}, `${clock(p.at)} · ${next ? stayed(next.at - p.at) : 'now'}`),
      ),
      h('ul', {}, h('li', {}, row)),
    );
  };

  const mark = (m: Mark) => {
    const item = h(
      'li',
      m.tone === 'done' ? 'jdone' : m.tone === 'warn' ? 'jwarn' : '',
      m.text,
      h('time', {}, clock(m.at)),
    );
    if (m.tone === 'done') item.prepend(icon('check'));
    if (m.tone === 'error') item.dataset.variant = 'destructive';
    return item;
  };

  const details = (p: PageVisit, i: number, pages: PageVisit[]) => {
    const before = pages[i - 1];
    const next = pages[i + 1];
    const referrer = engine.getState().visit.landing?.referrer;
    const issues = problems(p);
    const stat = (label: string, value: string, variant?: string) => {
      const el = h('div', 'stat', h('span', {}, label), h('strong', {}, value));
      return variant ? tsugi(el, { variant }) : el;
    };
    const sent = Object.entries(
      p.sent.reduce<Record<string, number>>((n, name) => ({ ...n, [name]: (n[name] ?? 0) + 1 }), {}),
    );
    const arrived = before
      ? `Arrived from ${before.path}`
      : `Arrived from ${referrer ? new URL(referrer).hostname : 'a direct visit'}`;
    return tsugiCard(
      'jpage',
      h(
        'div',
        {},
        h('h3', {}, p.title || p.path),
        h('p', 'jmeta', `${KINDS[p.kind]} · ${p.path}`, h('span', 'devonly', ` · storage ${p.scope}`)),
      ),
      h(
        'div',
        'stat-group',
        stat('Cart', p.units ? `${plural(p.units, 'item')} · ${money(p)}` : 'Empty'),
        stat('Order', p.order ?? '—'),
        stat('Analytics', `${p.sent.length} sent`),
        stat('Problems', String(issues), issues ? 'destructive' : undefined),
      ),
      sent.length > 0 &&
        h('div', 'jsent', ...sent.map(([name, n]) => badge(n > 1 ? `${name} ×${n}` : name, 'outline'))),
      h(
        'ol',
        'timeline',
        h('li', {}, arrived, h('time', {}, clock(p.at))),
        ...p.marks.map(mark),
        next
          ? h('li', {}, `Left for ${next.path}`, h('time', {}, clock(next.at)))
          : tsugi(h('li', {}, 'Still on this page'), { variant: 'pending' }),
      ),
    );
  };

  const attribution = () => {
    const kept = Object.entries(engine.attribution()).filter(
      ([key, value]) => value && key !== 'funnel' && typeof value === 'string',
    );
    return kept.length ? kept.map(([key, value]) => `${key} ${value}`).join(' · ') : 'none: no utm or affiliate params';
  };

  const view = (): Child[] => {
    const { pages } = debug.state();
    drawn = undefined;
    if (!pages.length) return [empty('No pages yet', '', 'route')];
    const selected = Math.min(picked ?? pages.length - 1, pages.length - 1);
    const journey = h('div', 'journey', h('ol', {}, ...pages.map((p, i) => step(p, i, pages, selected))));
    tsugi(journey, { orientation: 'vertical' });
    journey.setAttribute('aria-label', 'Pages in this tab');
    drawn = journey;
    return [
      h(
        'div',
        'jhead',
        h('span', {}, h('b', {}, plural(pages.length, 'page')), ' in this tab · attribution ', attribution()),
        pages.length > 1 &&
          h(
            'button',
            {
              type: 'button',
              className: 'link',
              onclick: () => {
                picked = undefined;
                debug.clear();
                ui.render();
              },
            },
            'Clear',
          ),
      ),
      journey,
      details(pages[selected]!, selected, pages),
    ];
  };

  return { view, draw: () => drawn?.isConnected && drawLines(drawn) };
}

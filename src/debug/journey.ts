import type { Engine } from '../engine/engine';
import { format, localeOf } from '../engine/format';
import { icon } from './icons';
import { sourceOf, sourceView } from './source-card';
import type { DebugActions, Mark, PageKind, PageVisit } from './state';
import type { DetailModal } from './stream';
import { badge, type Child, clock, empty, h, plural } from './view';

const PAGE_KINDS: PageKind[] = ['product', 'checkout', 'upsell', 'receipt'];

export const pageKind = (): PageKind => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="next-page-type"]')?.content as PageKind;
  if (PAGE_KINDS.includes(meta)) return meta;
  if (document.querySelector('form[data-next-checkout]')) return 'checkout';
  if (document.querySelector('[data-next-upsell]')) return 'upsell';
  if (document.querySelector('[data-next-display^="order."]')) return 'receipt';
  return 'page';
};

const KINDS: Record<PageKind, string> = {
  product: 'Landing',
  checkout: 'Checkout',
  upsell: 'Upsell',
  receipt: 'Receipt',
  page: 'Page',
};
const CARRY = /^The cart \(|^Storage scope changed/;

const stayed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const bad = (m: Mark) => m.tone === 'warn' || m.tone === 'error';
const SVG = 'http://www.w3.org/2000/svg';
// tsugi's journey.js, vertical: out of a picked page's start edge, down 12px before it, into the next one's.
const GUTTER = 12;
const RADIUS = 6;

const lines = (root: HTMLElement, svg: SVGSVGElement) => {
  const list = root.querySelector<HTMLElement>(':scope > ol');
  if (!list) return;
  const box = list.getBoundingClientRect();
  svg.style.left = `${list.offsetLeft}px`;
  svg.style.top = `${list.offsetTop}px`;
  svg.setAttribute('width', String(list.offsetWidth));
  svg.setAttribute('height', String(list.offsetHeight));
  const end = (b: Element) => {
    const own = b.getBoundingClientRect();
    return {
      x: (b.closest('[data-outcomes]') ?? b).getBoundingClientRect().left - box.left,
      y: own.top + own.height / 2 - box.top,
    };
  };
  const picked = [...list.children].flatMap((step) =>
    [...step.querySelectorAll('button[aria-pressed="true"]')].slice(0, 1),
  );
  svg.replaceChildren(
    ...picked.slice(1).map((to, i) => {
      const [a, b] = [end(picked[i]!), end(to)];
      const g = a.x - GUTTER;
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute(
        'd',
        `M ${a.x} ${a.y} H ${g + RADIUS} Q ${g} ${a.y} ${g} ${a.y + RADIUS} V ${b.y - RADIUS} Q ${g} ${b.y} ${g + RADIUS} ${b.y} H ${b.x}`,
      );
      return path;
    }),
  );
};

export function journeyView(
  engine: Engine,
  debug: DebugActions,
  ui: {
    render: () => void;
    show: (tab: 'analytics' | 'issues') => void;
    detail: DetailModal;
    /** What the Issues tab counts: this page's and the earlier pages' issues. */
    issues: () => number;
  },
) {
  let resized: ResizeObserver | undefined;

  const money = (p: PageVisit) =>
    p.total === undefined
      ? ''
      : format(
          { type: 'money', value: Number(p.total) },
          p.currency ?? engine.getState().campaign?.currency,
          localeOf(engine.getState()),
        );
  const holding = (p: PageVisit) =>
    p.order ? `Order ${p.order}` : p.units ? `${plural(p.units, 'item')} · ${money(p)}` : 'Empty cart';
  const link = (text: string, onclick: () => void) => h('button', { type: 'button', className: 'link', onclick }, text);

  const moment = (m: Mark) => {
    const el = h(
      'div',
      'jmom',
      h('span', 'time', clock(m.at)),
      h('span', {}, m.tone === 'done' && icon('check'), m.text),
    );
    if (m.tone) el.dataset.tone = m.tone;
    return el;
  };

  /** A tsugi journey step: its pill, a name and one muted line, then its page. */
  const step = (pill: string, name: string, note: string, row: HTMLElement) =>
    h('li', {}, h('header', {}, h('span', {}, pill), h('strong', {}, name), h('small', {}, note)), h('ul', {}, row));

  /** A picked page row: name and badges, path, then what it held and when. */
  const row = (name: Child[], path: string, figure: string, when: string, onclick: () => void) => {
    const el = h(
      'button',
      { type: 'button', onclick },
      h('span', {}, ...name),
      h('small', {}, path),
      h('data', {}, figure),
      h('data', {}, when),
    );
    el.setAttribute('aria-pressed', 'true');
    return el;
  };

  const source = (first: PageVisit) => {
    const s = sourceOf(engine);
    const warn = s.steps.find((st) => st.tone === 'warn');
    const open = () =>
      ui.detail.show({
        title: 'Source',
        subtitle: `${s.headline} · where this tab came from`,
        sections: [['Parameters', [sourceView(engine)]]],
        payloads: [],
      });
    return step(
      'Entry',
      s.platforms.length || !s.headline.startsWith('direct') ? 'Ad click' : 'Direct',
      warn ? `⚠ ${warn.label}: ${warn.detail}` : (s.steps[0]?.detail ?? ''),
      h(
        'li',
        {},
        row(
          [s.headline, ...s.platforms.map((name) => badge(name, 'outline'))],
          'Where this tab came from',
          'Details',
          clock(first.at),
          open,
        ),
      ),
    );
  };

  const carry = (before: PageVisit | undefined, p: PageVisit): Child => {
    const lost = p.marks.find((m) => CARRY.test(m.text));
    const text =
      lost?.text ?? (before?.order ? `Order ${before.order} carried over` : before?.units ? 'Cart carried over' : '');
    if (!before || !text) return null;
    const el = h('p', 'jcarry', `${lost ? '⚠' : '↓'} ${text}`);
    el.dataset.tone = lost?.tone ?? 'done';
    return el;
  };

  const open = (p: PageVisit, i: number, pages: PageVisit[]) => {
    const next = pages[i + 1];
    const issues = p.marks.filter(bad).length;
    const moments = p.marks.filter((m) => !CARRY.test(m.text));
    ui.detail.show({
      title: p.title || p.path,
      badge: issues ? [plural(issues, 'issue'), 'destructive'] : next ? undefined : ['Now', 'outline'],
      subtitle: `Step ${i + 1} · ${KINDS[p.kind]} · ${clock(p.at)} · ${next ? stayed(next.at - p.at) : 'open now'}`,
      sections: [
        ['Page', [h('p', 'jmeta', p.path, h('span', 'devonly', ` · storage ${p.scope}`)), carry(pages[i - 1], p)]],
        [
          'What happened',
          moments.length
            ? [h('div', 'jmoms', ...moments.map(moment))]
            : [h('p', 'jnote', 'Nothing happened to the cart here.')],
        ],
        [
          'Tracking',
          [
            h(
              'p',
              'jnote',
              `${plural(p.sent.length, 'tracking event')} sent`,
              !next &&
                p.sent.length > 0 &&
                link('See Analytics', () => {
                  ui.detail.dialog.close();
                  ui.show('analytics');
                }),
            ),
          ],
        ],
      ],
      payloads: [],
    });
  };

  const page = (p: PageVisit, i: number, pages: PageVisit[]) => {
    const next = pages[i + 1];
    const issues = p.marks.filter(bad).length;
    const name = [
      p.title || p.path,
      !next && badge('Now', 'outline'),
      issues > 0 && badge(`⚠ ${plural(issues, 'issue')}`, 'secondary'),
    ];
    const show = () => open(p, i, pages);
    const note = [
      next ? stayed(next.at - p.at) : 'open now',
      p.reloads > 0 && (p.reloads > 1 ? `reloaded ×${p.reloads}` : 'reloaded'),
    ]
      .filter(Boolean)
      .join(' · ');
    if (!p.upsell)
      return step(`Step ${i + 1}`, KINDS[p.kind], note, h('li', {}, row(name, p.path, holding(p), clock(p.at), show)));
    const outcome = (label: string, picked: boolean) => {
      const el = h(
        'button',
        { type: 'button', onclick: show },
        h('span', {}, label),
        h('data', {}, picked ? holding(p) : ''),
      );
      el.setAttribute('aria-pressed', String(picked));
      return el;
    };
    const el = h(
      'li',
      {},
      h('span', {}, ...name),
      h('small', {}, p.path),
      h('div', {}, outcome('Declined', p.upsell === 'declined'), outcome('Accepted', p.upsell === 'accepted')),
    );
    el.dataset.outcomes = '';
    return step(`Step ${i + 1}`, KINDS[p.kind], note, el);
  };

  const summary = (pages: PageVisit[]) => {
    const now = pages.at(-1)!;
    const issues = ui.issues();
    return h(
      'div',
      'jsum',
      h(
        'span',
        'jchain',
        ...[sourceOf(engine).headline, ...pages.map((p) => KINDS[p.kind])].flatMap((name, i, all) => [
          i === all.length - 1 ? h('b', {}, name) : name,
          i < all.length - 1 && h('span', 'dim', ' → '),
        ]),
      ),
      h('span', 'jstate', holding(now), now.order ? '' : ' · no order yet'),
      issues > 0 && link(`⚠ ${plural(issues, 'issue')}`, () => ui.show('issues')),
      pages.length > 1 &&
        link('Clear', () => {
          debug.clear();
          ui.render();
        }),
    );
  };

  const view = (): Child[] => {
    const { pages } = debug.state();
    if (!pages.length) return [empty('No pages yet', '', 'route')];
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const map = h('div', 'journey', h('ol', {}, source(pages[0]!), ...pages.map((p, i) => page(p, i, pages))));
    map.dataset.orientation = 'vertical';
    map.setAttribute('aria-label', 'This visit');
    map.append(svg);
    resized?.disconnect();
    if (typeof ResizeObserver === 'function') {
      resized = new ResizeObserver(() => lines(map, svg));
      resized.observe(map);
    }
    return [summary(pages), h('div', 'jmap', map)];
  };

  return { view };
}

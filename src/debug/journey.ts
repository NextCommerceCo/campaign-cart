import type { Engine } from '../engine/engine';
import { addDollars } from '../engine/format';
import { type IconName, icon } from './icons';
import { sourceOf, sourceView } from './source-card';
import type { DebugActions, Mark, PageKind, PageVisit } from './state';
import type { DetailModal } from './stream';
import { badge, type Child, clock, empty, h, link, plural, priceText, toned } from './view';

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

interface Journey {
  engine: Engine;
  debug: DebugActions;
  ui: {
    render: () => void;
    show: (tab: 'analytics' | 'issues') => void;
    detail: DetailModal;
    /** What the Issues tab counts: this page's and the earlier pages' issues. */
    issues: () => number;
  };
}

const money = (engine: Engine, p: PageVisit, value = p.total) => priceText(engine, value, p.currency);

const holding = (engine: Engine, p: PageVisit) =>
  p.order
    ? [`Order ${p.order}`, money(engine, p)].filter(Boolean).join(' · ')
    : p.units
      ? `${plural(p.units, 'item')} · ${money(engine, p)}`
      : 'Empty cart';

const moment = (m: Mark) =>
  toned(
    h('div', 'jmom', h('span', 'time', clock(m.at)), h('span', {}, m.tone === 'done' && icon('check'), m.text)),
    m.tone,
  );

/** A tsugi journey step: its pill and name, a muted note and its status badges, then its page. */
const step = (pill: string, name: string, note: string, badges: Child[], row: HTMLElement) =>
  h(
    'li',
    {},
    h(
      'header',
      {},
      h('span', {}, pill),
      h('strong', {}, name),
      note && h('small', {}, note),
      h('div', 'jtags', ...badges),
    ),
    h('ul', {}, h('li', {}, row)),
  );

const marked = (name: IconName, variant: string, text: string) => badge(icon(name), variant, text);

/** A picked page row: name and badges, path, then what it held and when. */
const row = (name: string, path: string, figure: string, when: string, onclick: () => void) => {
  return h(
    'button',
    { type: 'button', onclick, ariaPressed: 'true' },
    h('span', {}, name),
    h('small', {}, path),
    h('data', {}, figure),
    h('data', {}, when),
  );
};

function sourceStep({ engine, ui }: Journey, first: PageVisit) {
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
    s.entry,
    s.steps[0]?.tone === 'done' ? s.steps[0].detail : '',
    [
      ...s.platforms.map((name) => badge(name, 'outline')),
      warn && marked('warn', 'warning', `${warn.label}: ${warn.detail}`),
    ],
    row(s.headline, 'Where this tab came from', 'Details', clock(first.at), open),
  );
}

function carry(before: PageVisit | undefined, p: PageVisit): Child {
  const lost = p.marks.find((m) => CARRY.test(m.text));
  const text =
    lost?.text ?? (before?.order ? `Order ${before.order} carried over` : before?.units ? 'Cart carried over' : '');
  if (!before || !text) return null;
  return toned(h('p', 'jcarry', `${lost ? '⚠' : '↓'} ${text}`), lost?.tone ?? 'done');
}

const issueVariant = (p: PageVisit) => (p.marks.some((m) => m.tone === 'error') ? 'destructive' : 'warning');

/** A page's detail: where it is, what happened there, and what it sent. */
function openPage({ ui }: Journey, p: PageVisit, i: number, pages: PageVisit[]) {
  const next = pages[i + 1];
  const issues = p.marks.filter(bad).length;
  const moments = p.marks.filter((m) => !CARRY.test(m.text));
  const analytics = () => {
    ui.detail.dialog.close();
    ui.show('analytics');
  };
  ui.detail.show({
    title: p.title || p.path,
    badge: issues ? [plural(issues, 'issue'), issueVariant(p)] : next ? undefined : ['Now', 'outline'],
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
            !next && p.sent.length > 0 && link('See Analytics', analytics),
          ),
        ],
      ],
    ],
    payloads: [],
  });
}

function pageStep(j: Journey, p: PageVisit, i: number, pages: PageVisit[]) {
  const next = pages[i + 1];
  const issues = p.marks.filter(bad).length;
  const earned = p.earned ? `+${money(j.engine, p, p.earned)}` : '';
  const badges = [
    p.upsell === 'accepted' && marked('check', 'success', ['Accepted', earned].filter(Boolean).join(' ')),
    p.upsell === 'declined' && badge('Declined', 'outline'),
    !p.upsell && earned && badge(earned, 'success'),
    !next && badge('Now', 'info'),
    p.reloads > 0 && marked('reset', 'outline', p.reloads > 1 ? `Reloaded ×${p.reloads}` : 'Reloaded'),
    issues > 0 && marked('warn', issueVariant(p), plural(issues, 'issue')),
  ];
  return step(
    `Step ${i + 1}`,
    KINDS[p.kind],
    next ? stayed(next.at - p.at) : '',
    badges,
    row(p.title || p.path, p.path, holding(j.engine, p), clock(p.at), () => openPage(j, p, i, pages)),
  );
}

function summary({ engine, debug, ui }: Journey, pages: PageVisit[]) {
  const now = pages.at(-1)!;
  const issues = ui.issues();
  const upsold = addDollars(pages.map((p) => (p.kind === 'upsell' ? (p.earned ?? 0) : 0)));
  const notes = [now.order ? '' : 'no order yet', upsold > 0 && `upsells +${money(engine, now, upsold)}`];
  return h(
    'div',
    'jsum',
    h(
      'span',
      'jstate',
      h('b', {}, holding(engine, now)),
      h(
        'span',
        'dim',
        [...notes, plural(pages.length, 'page')]
          .filter(Boolean)
          .map((part) => ` · ${part}`)
          .join(''),
      ),
    ),
    issues > 0 && link(`⚠ ${plural(issues, 'issue')}`, () => ui.show('issues')),
    pages.length > 1 &&
      link('Clear', () => {
        debug.clear();
        ui.render();
      }),
  );
}

export function journeyView(engine: Engine, debug: DebugActions, ui: Journey['ui']) {
  const j: Journey = { engine, debug, ui };
  let resized: ResizeObserver | undefined;

  const view = (): Child[] => {
    const { pages } = debug.state();
    if (!pages.length) return [empty('No pages yet', '', 'route')];
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const steps = [sourceStep(j, pages[0]!), ...pages.map((p, i) => pageStep(j, p, i, pages))];
    const map = h('div', { className: 'journey', ariaLabel: 'This visit' }, h('ol', {}, ...steps));
    map.dataset.orientation = 'vertical';
    map.append(svg);
    resized?.disconnect();
    if (typeof ResizeObserver === 'function') {
      resized = new ResizeObserver(() => lines(map, svg));
      resized.observe(map);
    }
    return [summary(j, pages), h('div', 'jmap', map)];
  };

  /** Opens this page's detail: what happened here, its problems marked. */
  const openNow = () => {
    const { pages } = debug.state();
    if (pages.length) openPage(j, pages.at(-1)!, pages.length - 1, pages);
  };

  return { view, openNow, stop: () => resized?.disconnect() };
}

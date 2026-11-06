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
  const toggled = new Map<string, boolean>();

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

  const kind = (label: string, value: string) => {
    const el = h('span', 'jkind', label);
    el.dataset.kind = value;
    return el;
  };
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

  const block = (key: string, state: string, open: boolean, header: Child[], body: Child[]) => {
    const el = h('details', 'jpg', h('summary', 'jhd', h('span', 'jdot'), ...header), ...body);
    el.dataset.state = state;
    el.open = toggled.get(key) ?? open;
    el.addEventListener('toggle', () => toggled.set(key, el.open));
    return el;
  };

  const source = (first: PageVisit) => {
    const s = sourceOf(engine);
    const label = s.platforms.length || !s.headline.startsWith('direct') ? 'Ad click' : 'Direct';
    const warn = s.steps.some((step) => step.tone === 'warn');
    return block(
      'source',
      warn ? 'bad' : 'done',
      warn,
      [
        h('span', 'jtitle', kind(label, 'source'), s.headline, ...s.platforms.map((name) => badge(name, 'outline'))),
        h('span', 'jright', h('small', {}, clock(first.at))),
      ],
      [
        h(
          'p',
          'jchecks',
          ...s.steps.map((step) => {
            const el = h(
              'span',
              {},
              `${step.tone === 'done' ? '✓' : step.tone === 'warn' ? '⚠' : '–'} ${step.label}: ${step.detail}`,
            );
            el.dataset.tone = step.tone;
            return el;
          }),
          link('Details', () =>
            ui.detail.show({
              title: 'Source',
              subtitle: `${s.headline} · where this tab came from`,
              sections: [['Parameters', [sourceView(engine)]]],
              payloads: [],
            }),
          ),
        ),
      ],
    );
  };

  const page = (p: PageVisit, i: number, pages: PageVisit[]) => {
    const next = pages[i + 1];
    const issues = p.marks.filter(bad).length;
    const moments = p.marks.filter((m) => !CARRY.test(m.text));
    return block(
      `p${p.at}`,
      !next ? 'now' : issues ? 'bad' : 'done',
      !next || issues > 0 || pages.length <= 3,
      [
        h(
          'span',
          'jtitle',
          kind(KINDS[p.kind], p.kind),
          h('span', 'jname', p.title || p.path),
          !next && badge('Now', 'outline'),
          p.reloads > 0 && badge(p.reloads > 1 ? `Reloaded ×${p.reloads}` : 'Reloaded', 'secondary'),
          p.upsell &&
            badge(p.upsell === 'accepted' ? 'Accepted' : 'Declined', p.upsell === 'accepted' ? 'success' : 'outline'),
          issues > 0 && badge(plural(issues, 'issue'), 'destructive'),
        ),
        h(
          'span',
          'jright',
          h('b', {}, holding(p)),
          h('small', {}, `${clock(p.at)} · ${next ? stayed(next.at - p.at) : 'now'}`),
        ),
      ],
      [
        h('p', 'jpath', p.path, h('span', 'devonly', ` · storage ${p.scope}`)),
        h(
          'div',
          'jmoms',
          ...(moments.length ? moments.map(moment) : [h('p', 'jnote', 'Nothing happened to the cart here.')]),
        ),
        h(
          'p',
          'jnote',
          `${plural(p.sent.length, 'tracking event')} sent`,
          !next && p.sent.length > 0 && link('See Analytics', () => ui.show('analytics')),
        ),
      ],
    );
  };

  const carry = (before: PageVisit, p: PageVisit): Child => {
    const lost = p.marks.find((m) => CARRY.test(m.text));
    const text =
      lost?.text ?? (before.order ? `Order ${before.order} carried over` : before.units ? 'Cart carried over' : '');
    if (!text) return null;
    const el = h('p', 'jcarry', `${lost ? '⚠' : '↓'} ${text}`);
    el.dataset.tone = lost?.tone ?? 'done';
    return el;
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
    return [
      summary(pages),
      h(
        'div',
        'jline',
        source(pages[0]!),
        ...pages.flatMap((p, i) => [i > 0 && carry(pages[i - 1]!, p), page(p, i, pages)]),
      ),
    ];
  };

  return { view };
}

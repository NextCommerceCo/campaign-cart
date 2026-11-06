import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { type EngineEvent, envelope, PUBLIC, type SdkEvent } from '../engine/events/bus';
import type { DebugActions } from './state';
import { button, type Child, empty, expandable, h, plural, stamp, tree } from './view';

const KEEP = 300;
const BURST_GAP = 1000;

type Line = { package_id: number; quantity: number; product_title?: string };
type Data = {
  selector_id?: string;
  lines?: Line[];
  changes?: Array<{ package_id: number; from: number; to: number }>;
  total?: number;
  currency?: string;
  code?: string;
  method?: string;
  ref_id?: string;
  step?: number;
  reason?: string;
  error?: { code?: string };
};

const at = (e: SdkEvent) => Date.parse(e.created_at);

const bursts = (events: SdkEvent[]) =>
  events.reduce<SdkEvent[][]>((all, e) => {
    const last = all.at(-1);
    if (last && at(e) - at(last.at(-1)!) < BURST_GAP) last.push(e);
    else all.push([e]);
    return all;
  }, []);

export function eventsView(engine: Engine, debug: DebugActions, open: Set<string>, render: () => void) {
  const seen: SdkEvent[] = [];
  const kinds = new Set<string>();
  let newest = '';
  let total = 0;

  const record = (e: EngineEvent) => {
    if (!PUBLIC.has(e.name)) return;
    total++;
    seen.push(envelope(e, engine.sessionId()));
    if (seen.length > KEEP) seen.shift();
  };

  const title = (d: Data, id: number) =>
    d.lines?.find((l) => l.package_id === id)?.product_title ?? engine.getPackage(id)?.name ?? `#${id}`;

  const summary = (e: SdkEvent) => {
    const d = e.data as Data;
    const items =
      d.changes?.map((c) => `${title(d, c.package_id)} ${c.from}→${c.to}`) ??
      d.lines?.map((l) => `${l.product_title ?? `#${l.package_id}`} ×${l.quantity}`);
    return [
      d.selector_id,
      items && `${items.slice(0, 2).join(', ')}${items.length > 2 ? ` +${items.length - 2}` : ''}`,
      typeof d.total === 'number' && `total ${format({ type: 'money', value: d.total }, d.currency)}`,
      d.code,
      d.method,
      d.ref_id,
      d.step && `step ${d.step}`,
      d.reason,
      d.error?.code,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const dot = (kind: string) => {
    const el = h('span', 'edot');
    el.dataset.kind = kind;
    return el;
  };

  const chip = (label: string, n: number, on: boolean, pick: () => void, kind = '') => {
    const el = button(`${label} ${n}`, () => (pick(), render()), { variant: 'outline', size: 'xs' });
    if (kind) el.prepend(dot(kind));
    el.setAttribute('aria-pressed', String(on));
    return el;
  };

  const chips = () => {
    const counts = seen.reduce<Record<string, number>>((n, e) => ({ ...n, [e.object]: (n[e.object] ?? 0) + 1 }), {});
    return h(
      'div',
      'echips',
      chip('All', seen.length, !kinds.size, () => kinds.clear()),
      ...Object.entries(counts).map(([kind, n]) =>
        chip(kind, n, kinds.has(kind), () => (kinds.has(kind) ? kinds.delete(kind) : kinds.add(kind)), kind),
      ),
      grouping(),
    );
  };

  const row = (e: SdkEvent, start: number) =>
    expandable(
      [
        start < 0 ? stamp(at(e)) : h('span', 'time', `+${at(e) - start} ms`),
        h('b', {}, dot(e.object), e.event_type),
        ' ',
        h('span', 'dim', summary(e)),
      ],
      `e${e.event_id}`,
      open,
      () => Object.entries(e).map(([k, v]) => tree(h('span', 'key', k), v, `e${e.event_id}.${k}`, open)),
    );

  const group = (events: SdkEvent[], top: boolean) => {
    const [first] = events as [SdkEvent];
    const last = events.at(-1)!;
    if (events.length < 2) return row(first, -1);
    const path = `g${first.event_id}`;
    if (top && newest !== path) {
      open.delete(newest);
      open.add((newest = path));
    }
    return expandable(
      [
        stamp(at(first)),
        h('b', {}, dot(first.object), first.event_type),
        h('span', 'dim', ` → ${last.event_type}`),
        h('span', 'dim eburst', `${plural(events.length, 'event')} · ${at(last) - at(first)} ms`),
      ],
      path,
      open,
      () => events.map((e) => row(e, at(first))),
      'egroup',
    );
  };

  const grouped = () => debug.state().panel.grouped === true;

  const grouping = () => {
    const el = button('Group bursts', () => (debug.setPanel({ grouped: !grouped() }), render()), {
      variant: 'outline',
      size: 'xs',
    });
    el.classList.add('egroups');
    el.title = 'Group the events one action set off, a second or less apart';
    el.setAttribute('aria-pressed', String(grouped()));
    return el;
  };

  const view = (query: string): Child[] => {
    if (!seen.length) return [empty('No events yet', 'Each SDK event shows here as next.on gets it.')];
    const shown = seen.filter(
      (e) =>
        (!kinds.size || kinds.has(e.object)) &&
        (e.event_type.includes(query) || summary(e).toLowerCase().includes(query)),
    );
    if (!shown.length) return [chips(), empty('Nothing matches', 'No event fits the filter.')];
    const groups = grouped() ? bursts(shown).reverse() : [];
    return [
      chips(),
      h(
        'div',
        'summary',
        `${plural(total, 'event')} on this page`,
        grouped() && ` in ${plural(groups.length, 'burst')}`,
        ', newest first',
        total > seen.length && ` · the last ${KEEP} kept`,
      ),
      ...(grouped() ? groups.map((events, i) => group(events, i === 0)) : shown.reverse().map((e) => row(e, -1))),
    ];
  };

  engine.on('*', record, { replay: true });
  return { view, count: () => total };
}

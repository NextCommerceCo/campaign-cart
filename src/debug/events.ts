import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { type EngineEvent, envelope, PUBLIC, type SdkEvent } from '../engine/events/bus';
import type { DebugActions } from './state';
import { eventDetail } from './event-detail';
import { chips, type DetailModal, line } from './stream';
import { button, type Child, empty, expandable, h, plural, stamp, time } from './view';

const KEEP = 300;
const ACTION_GAP = 1000;

type Item = { package_id: number; quantity: number; product_title?: string; price?: number; total?: number };
type Data = {
  selector_id?: string;
  lines?: Item[];
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

const byAction = (events: SdkEvent[]) =>
  events.reduce<SdkEvent[][]>((all, e) => {
    const last = all.at(-1);
    if (last && at(e) - at(last.at(-1)!) < ACTION_GAP) last.push(e);
    else all.push([e]);
    return all;
  }, []);

export function eventsView(
  engine: Engine,
  debug: DebugActions,
  ui: { open: Set<string>; detail: DetailModal; render: () => void },
) {
  const { open, detail, render } = ui;
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

  const show = (e: SdkEvent) => {
    const d = e.data as Data & { cart?: { currency?: string } };
    const currency = d.currency ?? d.cart?.currency;
    detail.show({
      title: e.event_type,
      subtitle: [time(at(e)), e.object, currency].filter(Boolean).join(' · '),
      ...eventDetail(
        e.event_type,
        d,
        (value) => format({ type: 'money', value }, currency),
        (id) => title(d, id),
      ),
      payloads: [['Event', e]],
    });
  };

  const row = (e: SdkEvent, start?: number) =>
    line({
      at: start === undefined ? at(e) : `+${at(e) - start} ms`,
      tag: e.object,
      name: e.event_type,
      detail: [h('span', 'dim', summary(e))],
      open: () => show(e),
    });

  const group = (events: SdkEvent[], top: boolean) => {
    const [first] = events as [SdkEvent];
    const last = events.at(-1)!;
    if (events.length < 2) return row(first);
    const path = `g${first.event_id}`;
    if (top && newest !== path) {
      open.delete(newest);
      open.add((newest = path));
    }
    return expandable(
      [
        stamp(at(first)),
        h('code', 'sname', first.event_type),
        h('span', 'dim', ` → ${last.event_type}`),
        h('span', 'dim sgcount', `${plural(events.length, 'event')} · ${at(last) - at(first)} ms`),
      ],
      path,
      open,
      () => events.map((e) => row(e, at(first))),
      'sgroup',
    );
  };

  const grouped = () => debug.state().panel.grouped === true;

  const grouping = () => {
    const el = button('Group by action', () => (debug.setPanel({ grouped: !grouped() }), render()), {
      variant: 'outline',
      size: 'xs',
    });
    el.title = 'Group the events one action set off, a second or less apart';
    el.setAttribute('aria-pressed', String(grouped()));
    return el;
  };

  const view = (query: string): Child[] => {
    if (!seen.length) return [empty('No events yet', 'Each SDK event shows here as next.on gets it.')];
    const counts = seen.reduce<Record<string, number>>((n, e) => ({ ...n, [e.object]: (n[e.object] ?? 0) + 1 }), {});
    const shown = seen.filter(
      (e) =>
        (!kinds.size || kinds.has(e.object)) &&
        (e.event_type.includes(query) || summary(e).toLowerCase().includes(query)),
    );
    return [
      chips(Object.entries(counts), kinds, render, grouping()),
      ...(!shown.length
        ? [empty('Nothing matches', 'No event fits the filter.')]
        : grouped()
          ? byAction(shown)
              .reverse()
              .map((events, i) => group(events, i === 0))
          : shown.reverse().map((e) => row(e))),
    ];
  };

  engine.on('*', record, { replay: true });
  return { view, count: () => total };
}

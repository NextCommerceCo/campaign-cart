import { icon } from './icons';
import { badge, button, type Child, h, iconButton, nodes, stamp, tab, tablist, tree, tsugi } from './view';

/** One line of the Events, Analytics and Logs tabs: the same columns in all three. */
export interface Line {
  /** When it happened, or a time relative to its group (`+12 ms`). */
  at: number | string;
  /** Where it belongs: `cart`, `api`, `GA4`; the same value has the same colour in every tab. */
  tag: string;
  name?: string;
  detail?: Child[];
  /** The outcome on the right: a status, a time, a warning. */
  meta?: Child[];
  level?: string;
  title?: string;
  open?: () => void;
}

const tagged = (className: string, value: string, text?: string) => {
  const el = h('span', className, text ?? '');
  el.dataset.tag = value;
  return el;
};

export const pill = (text: string, tone: 'ok' | 'bad' | 'off' | 'warn') => {
  const el = h('span', 'spill', text);
  el.dataset.tone = tone;
  return el;
};

export function line(l: Line): HTMLElement {
  const cells = [
    typeof l.at === 'number' ? stamp(l.at) : h('span', 'time', l.at),
    tagged('stag', l.tag, l.tag),
    h('span', 'sdesc', l.name && h('code', 'sname', l.name), ...(l.detail ?? [])),
    h('span', 'smeta', ...(l.meta ?? [])),
    h('span', 'sgo', l.open && icon('chevron')),
  ];
  const el = l.open
    ? h('button', { type: 'button', className: 'srow', onclick: l.open }, ...cells)
    : h('div', 'srow', ...cells);
  if (l.level) el.dataset.level = l.level;
  if (l.title) el.title = l.title;
  return el;
}

/** `All N` and one chip per tag, several at once; `extra` (a mode switch) sits at the end. */
export function chips(counts: Array<[string, number]>, picked: Set<string>, render: () => void, ...extra: Child[]) {
  const chip = (label: string, n: number, tag?: string) => {
    const el = button(
      `${label} ${n}`,
      () => {
        if (!tag) picked.clear();
        else if (!picked.delete(tag)) picked.add(tag);
        render();
      },
      { variant: 'outline', size: 'xs' },
    );
    if (tag) el.prepend(tagged('sdot', tag));
    el.setAttribute('aria-pressed', String(tag ? picked.has(tag) : !picked.size));
    return el;
  };
  const total = counts.reduce((n, [, c]) => n + c, 0);
  return h(
    'div',
    'schips',
    chip('All', total),
    ...counts.map(([tag, n]) => chip(tag, n, tag)),
    ...extra.map((x) => x && h('span', 'sextra', x)),
  );
}

/** What a line's modal shows: a header, its own sections, the plain fields, and the payloads on request. */
export interface Detail {
  title: string;
  badge?: [string, string];
  subtitle: string;
  sections?: Array<[heading: string, body: Child[]]>;
  /** Scalar fields, shown as a list. */
  fields?: object;
  payloads: Array<[string, unknown]>;
}

const scalar = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

export function items(lines: Array<[item: string, quantity: string, price: string]>, totals: Array<[string, string]>) {
  return [
    lines.length > 0 &&
      h(
        'table',
        'sitems',
        h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Qty'), h('th', {}, 'Price')),
        ...lines.map((cells) => h('tr', {}, ...cells.map((c) => h('td', {}, c)))),
      ),
    totals.length > 0 && h('dl', 'stotals', ...totals.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
  ];
}

export function detailModal(open: Set<string>) {
  const head = h('header', {});
  const body = h('div', 'smbody');
  const dialog = tsugi(
    h(
      'dialog',
      'dialog smodal',
      h(
        'div',
        {},
        head,
        body,
        iconButton('close', 'Close dialog', () => dialog.close(), 'icon-sm'),
      ),
    ),
    { size: 'lg' },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const payloads = (sources: Detail['payloads']) => {
    const pane = h('div', 'spane');
    const tabs = tablist({ size: 'sm' }, 'Payload');
    const pick = (i: number) => {
      const [label, value] = sources[i]!;
      tabs.replaceChildren(...sources.map(([l], j) => tab(i === j, () => pick(j), l)));
      const copy = button(icon('copy'), () => void navigator.clipboard?.writeText(JSON.stringify(value, null, 2)), {
        variant: 'outline',
        size: 'xs',
      });
      copy.append('Copy JSON');
      const entries: Array<[string, unknown]> =
        value && typeof value === 'object' ? Object.entries(value) : [['value', value]];
      pane.replaceChildren(copy, ...entries.map(([k, v]) => tree(h('span', 'key', k), v, `sp.${label}.${k}`, open)));
    };
    pick(0);
    return [h('div', 'tabs', tabs), pane];
  };

  const show = (d: Detail) => {
    head.replaceChildren(h('h2', {}, d.title, d.badge && badge(...d.badge)), h('p', {}, d.subtitle));
    const fields = Object.entries(d.fields ?? {}).filter(([, v]) => scalar(v));
    const shown = h('div', {});
    const reveal = button(
      icon('code'),
      () => {
        shown.replaceChildren(...payloads(d.payloads));
        reveal.remove();
      },
      { variant: 'outline', size: 'sm' },
    );
    reveal.append(d.payloads.length > 1 ? 'Show payloads' : 'Show payload');
    body.replaceChildren(
      ...nodes([
        ...(d.sections ?? []).flatMap(([heading, children]) => [h('h3', 'shead', heading), ...nodes(children)]),
        fields.length > 0 && h('h3', 'shead', 'Details'),
        fields.length > 0 &&
          h('dl', 'sfields', ...fields.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])),
        d.payloads.length > 0 && shown,
        d.payloads.length > 0 && reveal,
      ]),
    );
    if (!dialog.open) dialog.showModal();
  };

  return { dialog, show };
}

export type DetailModal = ReturnType<typeof detailModal>;

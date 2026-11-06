import { type IconName, icon } from './icons';
import { badge, button, h, iconButton, nodes, tab, tablist, time, tree, tsugi } from './view';

/** One tracking event as the Analytics tab's modal shows it. */
export interface EventDetail {
  name: string;
  sent: boolean;
  at: number;
  reason: string;
  problems: string[];
  /** A line under the places, when none of them got it. */
  note?: string;
  /** Where it could go: received, off, or why not. */
  places: Array<{
    label: string;
    icon: IconName;
    vendor?: string;
    tone: 'ok' | 'warn' | 'bad' | 'off';
    text: string;
    title?: string;
  }>;
  lines: Array<[item: string, quantity: string, price: string]>;
  totals: Array<[string, string]>;
  /** What each place got, `next.analytics.on` first. */
  payloads: Array<[string, unknown]>;
}

export function eventModal(open: Set<string>) {
  const head = h('header', {});
  const body = h('div', 'abody');
  const dialog = tsugi(
    h(
      'dialog',
      'dialog amodal',
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

  const payloads = (sources: EventDetail['payloads']) => {
    const pane = h('div', 'apane');
    const tabs = tablist({ size: 'sm' }, 'Payload');
    const pick = (i: number) => {
      const [label, value] = sources[i]!;
      tabs.replaceChildren(...sources.map(([l], j) => tab(i === j, () => pick(j), l)));
      const copy = button(icon('copy'), () => void navigator.clipboard?.writeText(JSON.stringify(value, null, 2)), {
        variant: 'outline',
        size: 'xs',
      });
      copy.append('Copy JSON');
      pane.replaceChildren(
        copy,
        ...Object.entries((value ?? {}) as object).map(([k, v]) =>
          tree(h('span', 'key', k), v, `ap.${label}.${k}`, open),
        ),
      );
    };
    pick(0);
    return [h('div', 'tabs', tabs), pane];
  };

  const show = (d: EventDetail) => {
    head.replaceChildren(
      h('h2', {}, d.name, badge(d.sent ? 'Sent' : 'Not sent', d.sent ? 'success' : 'secondary')),
      h('p', {}, `${time(d.at)} · ${location.pathname} · ${d.reason}`),
    );
    const shown = h('div', {});
    const reveal = button(
      icon('code'),
      () => {
        shown.replaceChildren(...payloads(d.payloads));
        reveal.remove();
      },
      { variant: 'outline', size: 'sm' },
    );
    reveal.append('Show payloads');
    body.replaceChildren(
      ...nodes([
        d.problems.length > 0 && h('ul', 'aprobs', ...d.problems.map((p) => h('li', {}, p))),
        h('h3', 'ahead', 'Sent to'),
        d.note && h('p', 'anoted', d.note),
        h(
          'ul',
          'aplaces',
          ...d.places.map((p) => {
            const el = h(
              'li',
              {},
              icon(p.icon),
              h('b', {}, p.label),
              p.vendor && h('code', {}, p.vendor),
              h('span', 'astate', p.text),
            );
            el.dataset.tone = p.tone;
            if (p.title) el.title = p.title;
            return el;
          }),
        ),
        (d.lines.length > 0 || d.totals.length > 0) && h('h3', 'ahead', 'What it carried'),
        d.lines.length > 0 &&
          h(
            'table',
            'aitems',
            h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Qty'), h('th', {}, 'Price')),
            ...d.lines.map((cells) => h('tr', {}, ...cells.map((c) => h('td', {}, c)))),
          ),
        d.totals.length > 0 && h('dl', 'atotals', ...d.totals.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
        d.payloads.length > 0 && shown,
        d.payloads.length > 0 && reveal,
      ]),
    );
    if (!dialog.open) dialog.showModal();
  };

  return { dialog, show };
}

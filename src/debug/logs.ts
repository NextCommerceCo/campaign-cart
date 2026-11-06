import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { button, type Child, empty, expandable, h, plural, stamp, tree } from './view';

const KEEP = 150;
const API = /^api (\S+) (\S+) (?:→ (\d+) in (\d+) ms|(failed))$/;
const ANALYTICS = /^analytics (\S+) (sent|not sent): (.*)$/s;
const DESTINATION = /^destination (ga4|meta|rudderstack) (.+) sent$/;
const PLATFORM: Record<string, string> = { ga4: 'GA4', meta: 'Meta', rudderstack: 'RudderStack' };
const WARN = 'Warnings';

type Line = { source: string; body: Child[]; meta: Child[] };

const pill = (text: string, tone: string) => {
  const el = h('span', 'lpill', text);
  el.dataset.tone = tone;
  return el;
};

/** A log line in columns: where it comes from, what it says, and its outcome. */
const parse = (e: LogEntry): Line => {
  const api = API.exec(e.message);
  if (api) {
    const [, method, path, status, ms, failed] = api;
    return {
      source: 'api',
      body: [h('code', {}, `${method} ${path}`)],
      meta: failed
        ? [pill('failed', 'bad')]
        : [pill(status!, Number(status) < 400 ? 'ok' : 'bad'), h('span', 'lms', `${ms} ms`)],
    };
  }
  const analytics = ANALYTICS.exec(e.message);
  if (analytics) {
    const [, name, sent, reason] = analytics;
    return {
      source: 'analytics',
      body: [h('code', {}, name), pill(sent!, sent === 'sent' ? 'ok' : 'off'), h('span', 'dim', reason)],
      meta: [],
    };
  }
  const destination = DESTINATION.exec(e.message);
  if (destination)
    return { source: PLATFORM[destination[1]!]!, body: [h('code', {}, destination[2]), pill('sent', 'ok')], meta: [] };
  return { source: 'sdk', body: [h('span', {}, e.message)], meta: [] };
};

export function logsView(engine: Engine, open: Set<string>, idOf: (o: object) => number, render: () => void) {
  const picked = new Set<string>();

  const row = (e: LogEntry) => {
    const line = parse(e);
    const tag = h('span', 'lsrc', line.source);
    tag.dataset.source = line.source;
    const cells = [stamp(e.at), tag, h('span', 'lbody', ...line.body), h('span', 'lmeta', ...line.meta)];
    const path = `l${idOf(e)}`;
    const el =
      e.data === undefined
        ? h('div', 'lrow', ...cells)
        : expandable(
            cells,
            path,
            open,
            () => [
              h('p', 'lfull', e.message),
              ...(e.data && typeof e.data === 'object' && !Array.isArray(e.data)
                ? Object.entries(e.data).map(([k, v]) => tree(h('span', 'key', k), v, `${path}.${k}`, open))
                : [tree(h('span', 'key', 'data'), e.data, `${path}.data`, open)]),
            ],
            'lrow',
          );
    el.dataset.level = e.level;
    el.title = e.message;
    return el;
  };

  const chip = (label: string, n: number, source?: string) => {
    const el = button(
      `${label} ${n}`,
      () => {
        if (label === 'All') picked.clear();
        else if (!picked.delete(label)) picked.add(label);
        render();
      },
      { variant: 'outline', size: 'xs' },
    );
    if (source) {
      const dot = h('span', 'ldot');
      dot.dataset.source = source;
      el.prepend(dot);
    }
    el.setAttribute('aria-pressed', String(label === 'All' ? !picked.size : picked.has(label)));
    return el;
  };

  const view = (query: string): Child[] => {
    const entries = engine.log.entries();
    if (!entries.length) return [empty('Nothing logged yet', 'Each SDK log line shows here as it is written.')];
    const lines = entries.map((e) => ({ e, source: parse(e).source, warn: e.level === 'warn' || e.level === 'error' }));
    const counts = lines.reduce<Record<string, number>>(
      (n, { source }) => ({ ...n, [source]: (n[source] ?? 0) + 1 }),
      {},
    );
    const warnings = lines.filter((l) => l.warn).length;
    const shown = lines
      .filter(
        ({ e, source, warn }) =>
          (!picked.size || picked.has(source) || (warn && picked.has(WARN))) && e.message.toLowerCase().includes(query),
      )
      .slice(-KEEP)
      .reverse();
    return [
      h(
        'div',
        'echips',
        chip('All', entries.length),
        ...Object.entries(counts).map(([source, n]) => chip(source, n, source)),
        warnings > 0 && chip(WARN, warnings, 'warn'),
      ),
      shown.length
        ? h('div', 'summary', `${plural(entries.length, 'line')} logged on this page, newest first`)
        : empty('Nothing matches', 'No log line fits the filter.'),
      ...shown.map(({ e }) => row(e)),
    ];
  };

  return { row, view };
}

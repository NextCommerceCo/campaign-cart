import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { chips, type DetailModal, type Line, line, pill } from './stream';
import { type Child, empty, h, time } from './view';

const KEEP = 150;
const API = /^api (\S+) (\S+) (?:→ (\d+) in (\d+) ms|(failed))$/;
const ANALYTICS = /^analytics (\S+) (sent|not sent): (.*)$/s;
const DESTINATION = /^destination (ga4|meta|rudderstack) (.+) sent$/;
const PLATFORM: Record<string, string> = { ga4: 'GA4', meta: 'Meta', rudderstack: 'RudderStack' };
const WARN = 'warnings';

/** A log line in the shared columns: where it comes from, what it says, and its outcome. */
const parse = (e: LogEntry): Omit<Line, 'at'> => {
  const api = API.exec(e.message);
  if (api) {
    const [, method, path, status, ms, failed] = api;
    return {
      tag: 'api',
      name: `${method} ${path}`,
      meta: failed
        ? [pill('failed', 'bad')]
        : [pill(status!, Number(status) < 400 ? 'ok' : 'bad'), h('span', 'sms', `${ms} ms`)],
    };
  }
  const analytics = ANALYTICS.exec(e.message);
  if (analytics) {
    const [, name, sent, reason] = analytics;
    return { tag: 'analytics', name, detail: [pill(sent!, sent === 'sent' ? 'ok' : 'off'), h('span', 'dim', reason)] };
  }
  const destination = DESTINATION.exec(e.message);
  if (destination) return { tag: PLATFORM[destination[1]!]!, name: destination[2], detail: [pill('sent', 'ok')] };
  return { tag: 'sdk', detail: [h('span', {}, e.message)] };
};

export function logsView(engine: Engine, detail: DetailModal, render: () => void) {
  const picked = new Set<string>();

  const open = (e: LogEntry, tag: string) =>
    detail.show({
      title: parse(e).name ?? tag,
      badge:
        e.level === 'warn' || e.level === 'error'
          ? [e.level, e.level === 'error' ? 'destructive' : 'warning']
          : undefined,
      subtitle: `${time(e.at)} · ${tag} · ${e.level}`,
      sections: [['Message', [h('p', 'sfull', e.message)]]],
      fields: e.data && typeof e.data === 'object' && !Array.isArray(e.data) ? e.data : undefined,
      payloads: e.data === undefined ? [] : [['Data', e.data]],
    });

  const row = (e: LogEntry) => {
    const parsed = parse(e);
    return line({ ...parsed, at: e.at, level: e.level, title: e.message, open: () => open(e, parsed.tag) });
  };

  const view = (query: string): Child[] => {
    const entries = engine.log.entries();
    if (!entries.length) return [empty('Nothing logged yet', 'Each SDK log line shows here as it is written.')];
    const tagged = entries.map((e) => ({ e, tag: parse(e).tag, warn: e.level === 'warn' || e.level === 'error' }));
    const counts = tagged.reduce<Record<string, number>>((n, { tag }) => ({ ...n, [tag]: (n[tag] ?? 0) + 1 }), {});
    const warnings = tagged.filter((t) => t.warn).length;
    const shown = tagged
      .filter(
        ({ e, tag, warn }) =>
          (!picked.size || picked.has(tag) || (warn && picked.has(WARN))) && e.message.toLowerCase().includes(query),
      )
      .slice(-KEEP)
      .reverse();
    return [
      chips([...Object.entries(counts), ...(warnings ? [[WARN, warnings] as [string, number]] : [])], picked, render),
      ...(shown.length ? shown.map(({ e }) => row(e)) : [empty('Nothing matches', 'No log line fits the filter.')]),
    ];
  };

  return { row, view };
}

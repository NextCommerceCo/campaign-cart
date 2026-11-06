import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { button, type Child, empty, expandable, h, plural, stamp, tree } from './view';

type Level = LogEntry['level'];

const LEVELS: Array<[Level, string]> = [
  ['error', 'Errors'],
  ['warn', 'Warnings'],
  ['info', 'Info'],
  ['debug', 'Debug'],
];
const KEEP = 150;

const dot = (level: Level) => {
  const el = h('span', { className: 'ldot', title: level });
  el.dataset.level = level;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', level);
  return el;
};

export function logsView(engine: Engine, open: Set<string>, idOf: (o: object) => number, render: () => void) {
  const levels = new Set<Level>();

  const row = (e: LogEntry) => {
    const label = [stamp(e.at), dot(e.level), h('span', e.level === 'debug' ? 'dim' : '', e.message)];
    if (e.data === undefined) return h('div', 'row lrow', ...label);
    const path = `l${idOf(e)}`;
    return expandable(
      label,
      path,
      open,
      () =>
        e.data && typeof e.data === 'object' && !Array.isArray(e.data)
          ? Object.entries(e.data).map(([k, v]) => tree(h('span', 'key', k), v, `${path}.${k}`, open))
          : [tree(h('span', 'key', 'data'), e.data, `${path}.data`, open)],
      'lrow',
    );
  };

  const chip = (label: string, n: number, on: boolean, pick: () => void, level?: Level) => {
    const el = button(`${label} ${n}`, () => (pick(), render()), { variant: 'outline', size: 'xs' });
    if (level) el.prepend(dot(level));
    el.setAttribute('aria-pressed', String(on));
    return el;
  };

  const view = (query: string): Child[] => {
    const entries = engine.log.entries();
    if (!entries.length) return [empty('Nothing logged yet', 'Each SDK log line shows here as it is written.')];
    const count = (level: Level) => entries.filter((e) => e.level === level).length;
    const shown = entries
      .filter((e) => (!levels.size || levels.has(e.level)) && e.message.toLowerCase().includes(query))
      .slice(-KEEP)
      .reverse();
    return [
      h(
        'div',
        'echips',
        chip('All', entries.length, !levels.size, () => levels.clear()),
        ...LEVELS.filter(([level]) => count(level)).map(([level, label]) =>
          chip(label, count(level), levels.has(level), () => void (levels.delete(level) || levels.add(level)), level),
        ),
      ),
      shown.length
        ? h('div', 'summary', `${plural(entries.length, 'line')} logged on this page, newest first`)
        : empty('Nothing matches', 'No log line fits the filter.'),
      ...shown.map(row),
    ];
  };

  return { row, view };
}

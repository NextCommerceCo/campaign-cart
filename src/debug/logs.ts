import type { Engine } from '../engine/engine';
import type { LogEntry } from '../engine/log';
import { badge, type Child, empty, h, stamp, tree } from './view';

const LEVELS = { debug: 'outline', info: 'info', warn: 'warning', error: 'destructive' };

export function logsView(engine: Engine, open: Set<string>, idOf: (o: object) => number) {
  const row = (e: LogEntry) => {
    const label = h('span', {}, stamp(e.at), badge(e.level, LEVELS[e.level]), ' ', e.message);
    return e.data === undefined ? h('div', 'row', label) : tree(label, e.data, `l${idOf(e)}`, open);
  };

  const view = (query: string): Child[] => {
    const rows = engine.log
      .entries()
      .filter((e) => e.message.toLowerCase().includes(query))
      .slice(-150)
      .reverse()
      .map(row);
    return rows.length ? rows : [empty('Nothing matches')];
  };

  return { row, view };
}

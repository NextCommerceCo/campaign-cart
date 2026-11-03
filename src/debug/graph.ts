import { s } from './view';

export const GRAPH_CSS = `.graph{display:block;width:100%;height:auto;margin:2px 0 6px;font:11px var(--sans)}
.gn{cursor:pointer;outline:0;transition:opacity .12s}
.gn rect{fill:var(--raised);stroke:var(--line)}
.gn text{fill:var(--muted)}
.gn .gs{font-size:10px}
.gn .gc{fill:var(--fg);font-weight:600}
.gn .gf{fill:var(--amber)}
.gn.engine rect{stroke:var(--blue)}.gn.engine .gl{fill:var(--fg)}
.gn.ga rect{stroke:var(--orange)}.gn.ga .gl{fill:var(--orange);font:600 11px var(--mono)}
.gn.idle.ga-node .gl{font-family:var(--mono)}
.gn.ok rect{stroke:var(--green)}.gn.ok .gl,.gn.warn .gl,.gn.info .gl{fill:var(--fg);font-weight:600}
.gn.ok .gs{fill:var(--green)}
.gn.warn rect{stroke:var(--amber)}.gn.warn .gs{fill:var(--amber)}
.gn.info rect{stroke:var(--blue)}
.gn.off rect{stroke-dasharray:4 3}
.gn.sel rect,.gn:focus-visible rect{stroke-width:2.5}
.ge{fill:none;stroke:var(--line);stroke-width:1;transition:opacity .12s}
.ge.lit{stroke:var(--orange);stroke-width:1.6}
.ge.lit.from-engine{stroke:var(--blue)}
.ge.bus{stroke-width:3;stroke-linecap:round}
.ge.dash{stroke-dasharray:4 3}
.graph.tracing .gn:not(.on),.graph.tracing .ge:not(.on){opacity:.12}`;

export type Tone = 'idle' | 'engine' | 'ga' | 'ok' | 'off' | 'warn' | 'info';

export interface GraphNode {
  id: string;
  col: 0 | 1 | 2 | 'bus';
  label: string;
  tone: Tone;
  title: string;
  keys?: string;
  count?: number;
  sub?: string;
  flag?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  lit?: boolean;
  off?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const X = [0, 172, 402];
const W = [132, 150, 138];
const BUS = X[1]! + W[1]! + 22;
const TOP = 16;
const PITCH = 32;
const ROW = 24;
const DEST = 38;
const LANE = 5;

function layout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, Box> {
  const at = new Map<string, Box>();
  const col = (c: GraphNode['col']) => nodes.filter((n) => n.col === c);
  col(1).forEach((n, i) => at.set(n.id, { x: X[1]!, y: TOP + i * PITCH, w: W[1]!, h: ROW }));
  const below = TOP + col(1).length * PITCH;
  let next = TOP;
  for (const n of col(0)) {
    const targets = edges.filter((e) => e.from === n.id && at.has(e.to)).map((e) => at.get(e.to)!.y);
    const y = Math.max(next, targets.length ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : below);
    at.set(n.id, { x: X[0]!, y, w: W[0]!, h: ROW });
    next = y + PITCH;
  }
  const middle = col(1).map((n) => at.get(n.id)!.y + ROW / 2);
  for (const n of col('bus')) {
    const top = Math.min(...middle);
    at.set(n.id, { x: BUS, y: top, w: 0, h: Math.max(...middle) - top });
  }
  const dests = col(2);
  const bottom = Math.max(TOP + ROW, ...[...at.values()].map((b) => b.y + b.h));
  const gap = dests.length > 1 ? Math.max(DEST + 8, (bottom - TOP - DEST) / (dests.length - 1)) : 0;
  dests.forEach((n, i) => at.set(n.id, { x: X[2]!, y: TOP + Math.round(i * gap), w: W[2]!, h: DEST }));
  return at;
}

function route(a: Box, b: Box, from: GraphNode['col'], to: GraphNode['col'], middleBottom: number): string {
  const [x1, y1, x2, y2] = [a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2];
  if (to === 'bus') return `M${x1} ${y1}H${BUS}`;
  if (from === 'bus') {
    const yb = Math.min(Math.max(y2, a.y), a.y + a.h);
    return `M${BUS} ${yb}C${BUS + 20} ${yb} ${x2 - 20} ${y2} ${x2} ${y2}`;
  }
  if (!(from === 0 && to === 2)) {
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  }
  const gx = BUS + 14;
  const lane = y1 > middleBottom ? y1 : LANE;
  const into = `L${gx} ${lane}C${gx + 14} ${lane} ${x2 - 14} ${y2} ${x2} ${y2}`;
  return lane === y1
    ? `M${x1} ${y1}${into}`
    : `M${x1} ${y1}C${x1 + 14} ${y1} ${x1 + 2} ${lane} ${x1 + 16} ${lane}${into}`;
}

export function drawGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  ui: { selected?: string; query: string; select: (id: string | undefined) => void },
): SVGSVGElement {
  const at = layout(nodes, edges);
  const colOf = new Map(nodes.map((n) => [n.id, n.col]));
  const middleBottom = Math.max(0, ...nodes.filter((n) => n.col === 1).map((n) => at.get(n.id)!.y + ROW));
  const height = Math.max(...[...at.values()].map((b) => b.y + b.h)) + 4;
  const svg = s('svg', { class: 'graph', viewBox: `0 0 ${X[2]! + W[2]!} ${height}`, role: 'group' });

  const lines = edges.map((e) => {
    const [from, to] = [colOf.get(e.from)!, colOf.get(e.to)!];
    const className = ['ge', e.lit && 'lit', e.off && 'dash', from === 0 && 'from-engine'];
    return s('path', {
      class: className.filter(Boolean).join(' '),
      d: route(at.get(e.from)!, at.get(e.to)!, from, to, middleBottom),
      'data-from': e.from,
      'data-to': e.to,
    });
  });

  const trace = (id: string) => {
    const on = new Set([id]);
    const lit = new Set<number>();
    const walk = (current: string, down: boolean) =>
      edges.forEach((e, i) => {
        const next = down ? e.from === current && e.to : e.to === current && e.from;
        if (!next) return;
        lit.add(i);
        if (on.has(next)) return;
        on.add(next);
        walk(next, down);
      });
    walk(id, true);
    walk(id, false);
    return { on, lit };
  };

  const shapes = nodes.map((n) => {
    const b = at.get(n.id)!;
    if (n.col === 'bus')
      return s('path', {
        class: `ge bus${n.tone === 'idle' ? '' : ' lit'}`,
        d: `M${b.x} ${b.y - 1}V${b.y + b.h + 1}`,
        'data-id': n.id,
      });
    const mid = n.sub ? b.y + 13 : b.y + b.h / 2;
    const choose = () => ui.select(ui.selected === n.id ? undefined : n.id);
    const g = s(
      'g',
      {
        class: `gn ${n.tone}${n.col === 1 ? ' ga-node' : ''}${ui.selected === n.id ? ' sel' : ''}`,
        'data-id': n.id,
        tabindex: 0,
        role: 'button',
        'aria-label': `${n.label}: ${n.title}`,
      },
      s('title', {}, n.title),
      s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 6 }),
      s('text', { class: 'gl', x: b.x + 8, y: mid, 'dominant-baseline': 'central' }, n.label),
      n.sub && s('text', { class: 'gs', x: b.x + 8, y: b.y + 27, 'dominant-baseline': 'central' }, n.sub),
      (n.flag || !!n.count) &&
        s(
          'text',
          { class: 'gc', x: b.x + b.w - 8, y: mid, 'text-anchor': 'end', 'dominant-baseline': 'central' },
          n.flag && s('tspan', { class: 'gf' }, n.count ? '⚠ ' : '⚠'),
          n.count ? `×${n.count}` : '',
        ),
    );
    g.addEventListener('mouseenter', () => apply(n.id));
    g.addEventListener('mouseleave', () => apply(ui.selected));
    g.addEventListener('click', choose);
    g.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      choose();
    });
    return g;
  });

  const apply = (id?: string) => {
    const query = ui.query;
    const matches = (n: GraphNode) => `${n.label} ${n.keys ?? ''}`.toLowerCase().includes(query);
    const match = id
      ? trace(id)
      : query
        ? { on: new Set(nodes.filter(matches).map((n) => n.id)), lit: new Set() }
        : undefined;
    svg.classList.toggle('tracing', !!match);
    shapes.forEach((el, i) => el.classList.toggle('on', !!match?.on.has(nodes[i]!.id)));
    lines.forEach((p, i) => p.classList.toggle('on', !!match?.lit.has(i)));
  };

  svg.append(...lines, ...shapes);
  apply(ui.selected);
  return svg;
}

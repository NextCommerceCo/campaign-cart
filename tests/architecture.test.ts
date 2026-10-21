import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAZY = ['analytics', 'exit-intent', 'checkout', 'order', 'debug'];
const LAZY_ENGINE = ['engine/checkout', 'engine/order', 'engine/rules'];
const BROWSER_GLOBALS =
  /\b(document|window|location|navigator|history|localStorage|sessionStorage|fetch|matchMedia|CustomEvent|requestIdleCallback)\b/;

const ALLOWED: Record<string, string[]> = {
  engine: ['engine'],
  bindings: ['engine', 'bindings', 'legacy'],
  checkout: ['engine', 'checkout', 'bindings/context', 'bindings/dom'],
  order: ['engine', 'order', 'bindings/context', 'bindings/dom'],
  analytics: ['engine'],
  'exit-intent': ['engine'],
  debug: ['engine'],
  core: ['engine', 'bindings', 'legacy'],
  legacy: ['engine'],
  loader: ['config'],
  config: [],
};

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)],
  );

const area = (file: string) => {
  const path = relative('src', file).replace(/\.ts$/, '');
  const [top] = path.split('/');
  return { path, top: top! };
};

const sources = files('src').map((file) => ({ file, ...area(file), code: readFileSync(file, 'utf8') }));

function imports(code: string, from: string) {
  const resolve = (spec: string) => relative('src', join(dirname(from), spec)).replace(/\/index$/, '');
  const statics = [...code.matchAll(/^import (?!type )[^;]*? from '(\.[^']+)'/gm)].map((m) => resolve(m[1]!));
  const dynamics = [...code.matchAll(/import\('(\.[^']+)'\)/g)].map((m) => resolve(m[1]!));
  return { statics, dynamics };
}

describe('architecture', () => {
  it('every file belongs to a known area', () => {
    expect(sources.map((s) => s.top).filter((top) => !(top in ALLOWED))).toEqual([]);
  });

  it('imports go one way', () => {
    const allowed = (top: string, target: string) =>
      target.split('/')[0] === top || ALLOWED[top]!.some((ok) => target === ok || target.startsWith(`${ok}/`));
    const wrong = sources.flatMap(({ file, top, code }) =>
      imports(code, file)
        .statics.filter((target) => !allowed(top, target))
        .map((target) => `${top} → ${target}`),
    );
    expect(wrong).toEqual([]);
  });

  it('lazy chunks are only loaded with import()', () => {
    const eager = sources.flatMap(({ file, top, code }) =>
      imports(code, file)
        .statics.filter((target) => LAZY.includes(target.split('/')[0]!) && target.split('/')[0] !== top)
        .map((target) => `${top} → ${target}`),
    );
    expect(eager).toEqual([]);
  });

  it('landing pages never load checkout or order engine code', () => {
    const reach = (path: string, seen = new Set<string>()): Set<string> => {
      if (seen.has(path)) return seen;
      seen.add(path);
      const source = sources.find((s) => s.path === path || s.path === `${path}/index`);
      if (source) imports(source.code, source.file).statics.forEach((next) => reach(next, seen));
      return seen;
    };
    expect([...reach('core')].filter((path) => LAZY_ENGINE.includes(path))).toEqual([]);
  });

  it('the Engine never touches the DOM or browser globals', () => {
    const dom = sources
      .filter((s) => s.top === 'engine')
      .filter((s) => BROWSER_GLOBALS.test(s.code.replace(/'[^']*'|`[^`]*`/g, '')))
      .map((s) => s.path);
    expect(dom).toEqual([]);
  });

  it('folders are at most two levels deep', () => {
    expect(sources.filter((s) => s.path.split('/').length > 2).map((s) => s.path)).toEqual([]);
  });

  it('no default exports and no re-export barrels', () => {
    const bad = sources
      .filter((s) => /^export default|^export \* from|^export \{[^}]*\} from/m.test(s.code))
      .map((s) => s.path);
    expect(bad).toEqual([]);
  });
});

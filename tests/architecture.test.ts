import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAZY: Record<string, string[]> = {
  analytics: ['compat/analytics'],
  checkout: [],
  order: [],
  debug: [],
  'bindings/slots': [],
  'bindings/widgets': [],
  'compat/exit-intent': [],
  'compat/checkout': ['checkout'],
  'compat/order': ['order'],
  'compat/analytics': ['analytics'],
};
const LAZY_STATE = ['checkout/state', 'order/state'];
const headless = (path: string) => path.startsWith('engine/') || /^[^/]+\/state(\/|$)/.test(path);
const within = (path: string, area: string) => path === area || path.startsWith(`${area}/`);
const BROWSER_GLOBALS =
  /\b(document|window|location|navigator|history|localStorage|sessionStorage|fetch|matchMedia|CustomEvent|requestIdleCallback)\b/;

const ALLOWED: Record<string, string[]> = {
  engine: ['engine'],
  bindings: ['engine', 'bindings', 'compat/legacy'],
  checkout: ['engine', 'checkout', 'bindings/context', 'bindings/dom', 'compat/checkout'],
  order: ['engine', 'order', 'bindings/context', 'bindings/dom', 'compat/order'],
  analytics: ['engine', 'compat/analytics'],
  debug: ['engine'],
  compat: ['engine', 'analytics/context', 'analytics/ecommerce'],
  boot: ['engine', 'bindings', 'compat/legacy'],
  loader: ['config', 'compat/config'],
  config: ['compat/config'],
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
    const unit = (path: string) => Object.keys(LAZY).find((lazy) => path === lazy || path.startsWith(`${lazy}/`));
    const eager = sources.flatMap(({ file, path, code }) => {
      const own = unit(path);
      return imports(code, file)
        .statics.filter((target) => {
          const lazy = unit(target);
          return lazy && lazy !== own && !LAZY[lazy]!.some((owner) => own === owner);
        })
        .map((target) => `${path} → ${target}`);
    });
    expect(eager).toEqual([]);
  });

  it("headless code imports only the engine and its own feature's state", () => {
    const wrong = sources
      .filter((s) => headless(s.path))
      .flatMap(({ file, path, top, code }) =>
        imports(code, file)
          .statics.filter((target) => !within(target, 'engine') && !within(target, `${top}/state`))
          .map((target) => `${path} → ${target}`),
      );
    expect(wrong).toEqual([]);
  });

  it('landing pages never load checkout or order state', () => {
    const reach = (path: string, seen = new Set<string>()): Set<string> => {
      if (seen.has(path)) return seen;
      seen.add(path);
      const source = sources.find((s) => s.path === path || s.path === `${path}/index`);
      if (source) imports(source.code, source.file).statics.forEach((next) => reach(next, seen));
      return seen;
    };
    expect([...reach('boot')].filter((path) => LAZY_STATE.some((area) => within(path, area)))).toEqual([]);
  });

  it('the engine and every feature state never touch the DOM or browser globals', () => {
    const dom = sources
      .filter((s) => headless(s.path))
      .filter((s) => BROWSER_GLOBALS.test(s.code.replace(/'[^']*'|`[^`]*`/g, '')))
      .map((s) => s.path);
    expect(dom).toEqual([]);
  });

  it('folders are at most three levels deep', () => {
    expect(sources.filter((s) => s.path.split('/').length > 3).map((s) => s.path)).toEqual([]);
  });

  it('only the logger writes to the console', () => {
    const direct = sources
      .filter((s) => !['engine/log', 'loader'].includes(s.path) && /\bconsole\./.test(s.code))
      .map((s) => s.path);
    expect(direct).toEqual([]);
  });

  it('no default exports and no re-export barrels', () => {
    const bad = sources
      .filter((s) => /^export default|^export \* from|^export \{[^}]*\} from/m.test(s.code))
      .map((s) => s.path);
    expect(bad).toEqual([]);
  });
});

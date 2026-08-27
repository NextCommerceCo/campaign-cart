import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

/**
 * ES-bundle initialisation contract.
 *
 * `dist/index.js` plus the chunks beside it are what `public/loader.js` fetches for
 * every browser that supports modules — almost every visitor. If evaluating that
 * module graph throws, the loader's `catch` quietly loads `dist/index.umd.js`
 * instead, so the page still works and nothing fails loudly: every visitor just
 * downloads both bundles and gets a console error. That shipped in v0.4.31 and was
 * only found by a human reading the console
 * ([#77](https://github.com/NextCommerceCo/campaign-cart/issues/77)).
 *
 * The cause is always the same shape. `manualChunks` splits `src/` into chunks that
 * import each other in cycles; ES modules evaluate one side of a cycle first, so a
 * module-scope call across the boundary — and `const logger = createLogger('X')` at
 * module scope is that, in dozens of files — can land in a `class` the other chunk
 * has not evaluated yet. The result is `ReferenceError: Cannot access 'l' before
 * initialization`, in minified code, on a line no source map explains. Nothing else
 * in the suite sees it: every unit test imports `src/`, where the chunk boundaries
 * do not exist.
 *
 * So this test evaluates the built graph the only way that proves anything — by
 * running it. A child `node` process gives the real ES-module semantics of a
 * browser (the same evaluation order, the same temporal dead zone), with happy-dom
 * supplying the browser globals the SDK touches while its modules initialise.
 *
 * ## Why it evaluates the graph more than once
 *
 * Module-init work is often behind a flag, so one evaluation only proves the graph
 * is safe on the boot it happened to take. `?debugger=true` is the flag that
 * matters: the `debug` chunk holds nine statically-imported modules, and what its
 * module bodies *do* changes with the flag. v0.4.35 through v0.4.37 threw
 * `Cannot access 'o' before initialization` on every debug page load and this test
 * was green throughout, because it only ever loaded `https://campaign.test/`
 * ([#93](https://github.com/NextCommerceCo/campaign-cart/issues/93)).
 *
 * So `BOOTS` below lists every input that changes what runs at module-init time,
 * and each one gets its own child process. Add a row whenever a module body starts
 * branching on something new.
 *
 * ## What it cannot prove
 *
 * Two limits, both worth knowing before trusting a pass:
 *
 * - **It reads the committed `dist/`, not a build of the working tree.** `dist/` is
 *   committed and `.github/workflows/build.yml` tests before it builds, so a source
 *   or `manualChunks` change that reopens this goes green until someone rebuilds and
 *   commits `dist/`. Unlike the docs-marker
 *   gate next door, that is only half a weakness here: the committed `dist/` *is*
 *   the artifact jsDelivr serves from the tag, so a pass is a true statement about
 *   what customers load today. Rebuild `dist/` before trusting it about your edit.
 * - **Module init is not the whole boot.** The SDK's own initialisation is async and
 *   needs an API key and a campaign; it fails here, by design, with
 *   `[SDKInitializer] SDK initialization failed`. That is expected output, not a
 *   failure — this test only asserts that evaluating the graph does not throw.
 *   `e2e/es-bundle.spec.ts` covers the real boot in five real engines.
 */

const DIST = resolve(__dirname, '../../../dist');
const ENTRY = join(DIST, 'index.js');
const CHUNKS = join(DIST, 'chunks');

/**
 * Evaluates `dist/index.js` under happy-dom globals and prints one line:
 * `EVALUATED <n>` with the entry's export count, or `THREW <message>`.
 *
 * Runs as a child process on purpose. Importing the bundle from inside Vitest would
 * put it through Vite's transform and module runner, which resolves cycles its own
 * way — the one thing this test exists to observe would be the thing it stopped
 * measuring.
 */
const RUNNER = `
import { pathToFileURL } from 'node:url';
const { Window } = await import('happy-dom');

const win = new Window({ url: process.argv[2] });

// Browser globals the bundle reaches for while its modules initialise. Every key
// happy-dom defines is copied unless Node already has it; these are forced, because
// Node has its own \`location\`, \`navigator\` and \`screen\` that are not a page's.
const FORCE = new Set([
  'window', 'self', 'document', 'navigator', 'location', 'screen', 'history',
  'sessionStorage', 'localStorage', 'getComputedStyle', 'matchMedia',
  'requestAnimationFrame', 'cancelAnimationFrame',
]);

const keys = new Set();
for (let o = win; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
  for (const k of Object.getOwnPropertyNames(o)) keys.add(k);
}
for (const key of keys) {
  if (key === 'globalThis' || key === 'undefined') continue;
  if (key in globalThis && !FORCE.has(key)) continue;
  let value;
  try { value = win[key]; } catch { continue; }
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true, writable: true,
    value: typeof value === 'function' ? value.bind(win) : value,
  });
}
globalThis.window = win;
globalThis.self = win;
win.nextConfig = JSON.parse(process.argv[3]);

try {
  const ns = await import(pathToFileURL(process.argv[1]).href);
  console.log('EVALUATED ' + Object.keys(ns).length);
} catch (err) {
  console.log('THREW ' + (err && err.message));
  if (err && err.stack) console.log(err.stack.split('\\n').slice(1, 4).join('\\n'));
}
// The SDK leaves timers and observers behind; without this the child never exits.
process.exit(0);
`;

/**
 * Every input a module body in `src/` branches on at init time. One child process
 * each — a flag that changes what runs changes what can throw.
 */
const BOOTS = [
  { name: 'a shopper visit', url: 'https://campaign.test/', config: {} },
  {
    name: '?debugger=true',
    url: 'https://campaign.test/?debugger=true',
    config: {},
  },
  { name: '?debug=true', url: 'https://campaign.test/?debug=true', config: {} },
  {
    name: 'window.nextConfig.debugger',
    url: 'https://campaign.test/',
    config: { debugger: true },
  },
] as const;

function evaluateBundle(boot: (typeof BOOTS)[number]): string {
  return execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      RUNNER,
      ENTRY,
      boot.url,
      JSON.stringify(boot.config),
    ],
    {
      cwd: resolve(__dirname, '../../..'), // so `happy-dom` resolves
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    }
  );
}

/**
 * The chunks `manualChunks` names by hand. Everything else in `dist/chunks/` is a
 * per-feature chunk Rollup named after its entry module, and those come and go with
 * the feature set — these seven are the fixed frame the SDK is split into.
 */
const NAMED_CHUNKS = new Set([
  'state',
  'debug',
  'analytics',
  'utils',
  'api',
  'core-services',
  'vendor',
]);

/** `debug-CqP2tos2.js` → `debug`. The hash is 8 chars of `[A-Za-z0-9_-]`. */
function chunkName(file: string): string {
  return basename(file)
    .replace(/-[A-Za-z0-9_-]{8}\.js$/, '')
    .replace(/\.js$/, '');
}

function importsOf(file: string): string[] {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /(?:^|[;}])\s*import\s*(?:[^'"]*?from\s*)?["']([^"']+)["']/g
    ),
  ].map(m => basename(m[1]));
}

/**
 * Which named chunk imports which, read out of the built files. Sorted, so it is
 * comparable to the frozen map below.
 */
function namedChunkGraph(chunks: string[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const file of chunks) {
    const name = chunkName(file);
    if (!NAMED_CHUNKS.has(name)) continue;
    const deps = new Set<string>();
    for (const imported of importsOf(join(CHUNKS, file))) {
      const dep = chunkName(imported);
      if (NAMED_CHUNKS.has(dep) && dep !== name) deps.add(dep);
    }
    graph[name] = [...deps].sort();
  }
  return graph;
}

/**
 * Every edge between the named chunks as of #93, frozen.
 *
 * A cycle here is what makes a module-scope call across a chunk boundary able to
 * throw, and four of these seven chunks are already in one — `analytics`, `debug`,
 * `state` and `utils` all reach each other. That is the standing hazard the `BOOTS`
 * matrix above exists to detect, and it is why `.claude/rules/bundling.md` says
 * module scope in `src/` does no work.
 *
 * So this map is a tripwire, not a target. If it fails, a `manualChunks` rule or an
 * import moved and the hazard surface changed shape. Read the diff before updating
 * it: a **new** edge into `analytics`/`debug`/`state`/`utils` widens an existing
 * cycle, and an edge out of `core-services` or `vendor` (both leaves today) is a new
 * cycle outright. An edge that disappears is progress and the map should shrink.
 */
const FROZEN_CHUNK_GRAPH: Record<string, string[]> = {
  analytics: ['core-services', 'debug', 'state', 'utils'],
  api: ['core-services'],
  'core-services': [],
  debug: ['analytics', 'core-services', 'state', 'vendor'],
  state: ['core-services', 'debug', 'utils', 'vendor'],
  utils: ['core-services', 'state'],
  vendor: [],
};

describe('ES bundle initialisation contract', () => {
  // Skips on a clean checkout, or on `npm run test` before any build.
  const built = existsSync(ENTRY);

  it.skipIf(!built).each(BOOTS)(
    'evaluates the built module graph without throwing on $name',
    boot => {
      const output = evaluateBundle(boot);
      const threw = output.includes('THREW');

      expect(
        threw ? output.trim() : 'no error',
        'evaluating dist/index.js threw — the loader will fall back to the UMD bundle on every page. A `ReferenceError: Cannot access … before initialization` means a chunk calls across a `manualChunks` cycle at module-init time; see vite.config.ts › manualChunks'
      ).toBe('no error');

      // Without this the assertion above would also pass on a bundle that
      // evaluated to nothing at all.
      const exported = Number(/EVALUATED (\d+)/.exec(output)?.[1] ?? 0);
      expect(
        exported,
        'dist/index.js evaluated but exported nothing, so the graph under test was empty'
      ).toBeGreaterThan(5);
    },
    60_000
  );

  it.skipIf(!built)('holds the chunk graph the entry actually loads', () => {
    // The evaluation above only reaches chunks the entry imports statically. If
    // `manualChunks` ever stops splitting, it would pass by testing one file — so
    // assert the split is still there and still reaches the chunk this contract
    // was written for.
    const chunks = existsSync(CHUNKS)
      ? readdirSync(CHUNKS).filter(f => f.endsWith('.js'))
      : [];
    expect(chunks.length, 'dist/chunks/ holds no .js files').toBeGreaterThan(
      10
    );

    // `core-services` holds `core/{logger,storage,events}.ts` and must stay a leaf:
    // it is the chunk every other one calls at module-init time, and it is safe to
    // call only while it imports nothing back. See vite.config.ts › manualChunks.
    const leaf = chunks.find(f => f.startsWith('core-services-'));
    expect(
      leaf,
      'no core-services-*.js chunk — the leaf that holds createLogger/EventBus/sessionStorageManager was reassigned'
    ).toBeDefined();

    expect(
      importsOf(join(CHUNKS, leaf as string)),
      'the core-services chunk imports another chunk, so it can now be the half-evaluated side of a cycle'
    ).toEqual([]);
  });

  it.skipIf(!built)('holds the frozen graph of the named chunks', () => {
    const chunks = readdirSync(CHUNKS).filter(f => f.endsWith('.js'));

    expect(
      namedChunkGraph(chunks),
      'the import graph between the named chunks changed — see FROZEN_CHUNK_GRAPH above for how to read the diff, and .claude/rules/bundling.md before updating it'
    ).toEqual(FROZEN_CHUNK_GRAPH);
  });
});

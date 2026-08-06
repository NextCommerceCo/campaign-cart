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
 * ## What it cannot prove
 *
 * Two limits, both worth knowing before trusting a pass:
 *
 * - **It reads the committed `dist/`, not a build of the working tree.** `dist/` is
 *   committed and `.github/workflows/build.yml` tests before it builds, so a source
 *   or `manualChunks` change that reopens this goes green until someone rebuilds and
 *   commits `dist/` (finding 111 in `docs/code-findings.md`). Unlike the docs-marker
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

const win = new Window({ url: 'https://campaign.test/' });

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

function evaluateBundle(): string {
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', RUNNER, ENTRY],
    {
      cwd: resolve(__dirname, '../../..'), // so `happy-dom` resolves
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    }
  );
}

describe('ES bundle initialisation contract', () => {
  // Skips on a clean checkout, or on `npm run test` before any build.
  const built = existsSync(ENTRY);

  it.skipIf(!built)(
    'evaluates the built module graph without throwing',
    () => {
      const output = evaluateBundle();
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

    const imports = [
      ...readFileSync(join(CHUNKS, leaf as string), 'utf8').matchAll(
        /(?:^|[;}])\s*import\s*(?:[^'"]*?from\s*)?["']([^"']+)["']/g
      ),
    ].map(m => basename(m[1]));

    expect(
      imports,
      'the core-services chunk imports another chunk, so it can now be the half-evaluated side of a cycle'
    ).toEqual([]);
  });
});

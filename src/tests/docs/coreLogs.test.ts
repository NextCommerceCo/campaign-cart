import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import {
  CORE_CONSOLE_LOGS,
  CORE_HEALTHY_BOOT,
  CORE_LOG_NOTES,
  CORE_LOG_SOURCES,
  CORE_UNREADABLE_LOGS,
} from '@/core/docs/core-logs';
import { CORE_ERRORS } from '@/core/docs/core-errors';
import {
  renderCoreLogs,
  type CoreLogGroup,
  type CoreLogRow,
} from '@/core/docs/render-core-logs';
import { renderCoreErrors } from '@/core/docs/render-core-errors';
import { extractLogs, extractThrows, type LogMessage } from './extract-logs';

/**
 * Generates `src/core/guide/reference/logs.md` and `errors.md`, and fails when the
 * committed markdown drifts from what the source plus the notes produce.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * The `src/core` equivalent of `featureReference.test.ts` (per-feature) and
 * `stateReference.test.ts` (per-store), and a test rather than a script for the same
 * reason: the declarations load through Vite, so TypeScript and `@/` resolve with no
 * extra build step.
 *
 * What it enforces, beyond "the file matches":
 *
 * - Every `error` and `warn` in `src/core` has a hand-written Meaning and Action, and
 *   every note still matches a message that exists. A new failure path cannot ship
 *   undocumented, and a deleted one cannot linger.
 * - Every logging file is declared with a prefix, and the declared prefix agrees with
 *   what `createLogger` is actually given.
 * - Every `throw` is declared with a kind, a cause, and a fix; every declared error is
 *   still thrown.
 * - Every bare `console.error` / `console.warn` outside `core/debug/` is explained too.
 *   Those bypass `Logger` entirely, so an extractor keyed on a `logger` receiver cannot
 *   see them — and nine of them are attribution failures that lose data.
 * - The production-behaviour section's claims still hold: `drop_console` in the build
 *   config, the loader's module entry point, `Logger.error` having no production guard
 *   while the other three levels do, and the two halves of debug mode (`Logger` reading
 *   the URL and `window.nextConfig`; the log level raised from the config store).
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../..');
const ROOT = join(SRC, '..');
const CORE = join(SRC, 'core');
const OUT_DIR = join(CORE, 'guide', 'reference');

const raw = import.meta.glob<string>('../../core/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Core's own source, keyed by path relative to `src/core` — `analytics/index.ts` rather
 * than `index.ts`, since a bare basename is ambiguous across 68 files.
 *
 * `docs/` is excluded: it is the build-time documentation layer, not shipped code, and
 * its prose would otherwise be scanned for log calls.
 */
const coreFiles: Array<[string, string]> = Object.entries(raw)
  .map(([p, text]) => [relative(CORE, join(HERE, p)), text] as [string, string])
  .filter(
    ([name]) =>
      !name.startsWith('docs/') &&
      !name.includes('tests/') &&
      !name.endsWith('.test.ts')
  )
  .sort((a, b) => a[0].localeCompare(b[0]));

const sourceOf = new Map(coreFiles);

/** `createLogger('AttributeScanner')` / `new Logger('NextCommerce')`. */
const PREFIX = /(?:createLogger|new Logger)\(\s*'([^']+)'\s*\)/;

const LEVELS = new Set(['error', 'warn', 'info', 'debug']);

/**
 * `logger.*` call sites whose first argument is neither a string nor a template literal,
 * so {@link extractLogs} cannot report the wording. Two shapes produce them: a message
 * concatenated from several literals, and one forwarded through a private helper. Both
 * are declared by hand in `CORE_UNREADABLE_LOGS`, and this list is what proves the
 * declarations are complete.
 */
interface OpaqueCall {
  file: string;
  level: string;
  line: number;
  /** The argument's source text, for matching a declared anchor against it. */
  argument: string;
}

function opaqueCalls(files: Array<[string, string]>): OpaqueCall[] {
  const found: OpaqueCall[] = [];

  for (const [file, text] of files) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        LEVELS.has(node.expression.name.text) &&
        /(^|\.)logger$/.test(node.expression.expression.getText())
      ) {
        const arg = node.arguments[0];
        const readable =
          arg &&
          (ts.isStringLiteral(arg) ||
            ts.isNoSubstitutionTemplateLiteral(arg) ||
            ts.isTemplateExpression(arg));
        if (!readable) {
          found.push({
            file,
            level: node.expression.name.text,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            argument: arg?.getText() ?? '',
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return found;
}

/**
 * Bare `console.error` / `console.warn` call sites — output that never passes through
 * `Logger`, so it carries no prefix and no level gate. `logger.ts` is excluded (that is
 * where `Logger` legitimately calls `console`), and so is `core/debug/`, whose console
 * output is the debug tooling talking to whoever opened it.
 */
function rawConsoleCalls(files: Array<[string, string]>): OpaqueCall[] {
  const found: OpaqueCall[] = [];

  for (const [file, text] of files) {
    if (file === 'logger.ts' || file.startsWith('debug/')) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText() === 'console' &&
        (node.expression.name.text === 'error' ||
          node.expression.name.text === 'warn')
      ) {
        found.push({
          file,
          level: node.expression.name.text,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          argument: node.arguments[0]?.getText() ?? '',
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return found;
}

/** 1-based line of the first occurrence of `text` in `file`. */
function lineOf(file: string, text: string): number {
  const source = sourceOf.get(file) ?? '';
  const at = source.indexOf(text);
  if (at === -1) return 0;
  return source.slice(0, at).split('\n').length;
}

// ── The inventory, read from the source ──────────────────────────────────────

/** Extracted per file, so a message repeated in two subsystems is documented in both. */
const logsByFile = new Map<string, LogMessage[]>(
  coreFiles.map(([file, text]) => [file, extractLogs([[file, text]])])
);

const thrown = extractThrows(coreFiles);

const noteFor = new Map(
  CORE_LOG_NOTES.map(n => [`${n.level} ${n.message}`, n] as const)
);

/** Declared prefix sections, joined to the messages they cover. */
const groups: CoreLogGroup[] = CORE_LOG_SOURCES.map(source => {
  const extracted: CoreLogRow[] = (logsByFile.get(source.file) ?? []).map(
    log => {
      const note = noteFor.get(`${log.level} ${log.message}`);
      return {
        ...log,
        ...(note ? { meaning: note.meaning, action: note.action } : {}),
      };
    }
  );

  const declared: CoreLogRow[] = CORE_UNREADABLE_LOGS.filter(
    u => u.file === source.file
  ).map(u => ({
    level: u.level,
    message: u.message,
    where: `${u.file}:${lineOf(u.file, u.anchor)}`,
    hasContext: u.hasContext ?? false,
    meaning: u.meaning,
    action: u.action,
    unreadable: u.forwarded
      ? ('forwarded' as const)
      : ('concatenated' as const),
  }));

  // Errors and warns first within a section, since that is what a reader arrives for.
  const order = { error: 0, warn: 1, info: 2, debug: 3 } as const;
  const rows = [...extracted, ...declared].sort(
    (a, b) => order[a.level] - order[b.level]
  );

  return { source, rows };
});

describe('core logs and errors reference', () => {
  it('reads the core source it is documenting', () => {
    expect(coreFiles.length).toBeGreaterThan(20);
    expect([...logsByFile.values()].flat().length).toBeGreaterThan(100);
  });

  // ── Prefixes ───────────────────────────────────────────────────────────────

  /**
   * Every file that logs must be declared, or its messages are on no page at all — the
   * failure this whole exercise exists to prevent. A file with only opaque calls counts
   * too: `FacebookAdapter` logs exactly one warn, and it is a concatenated one.
   */
  it('declares a source for every file in core that logs', () => {
    const declared = new Set(CORE_LOG_SOURCES.map(s => s.file));
    const logging = new Set([
      ...[...logsByFile.entries()]
        .filter(([, logs]) => logs.length > 0)
        .map(([file]) => file),
      ...opaqueCalls(coreFiles).map(c => c.file),
    ]);
    const missing = [...logging].filter(f => !declared.has(f)).sort();
    expect(
      missing,
      'these files log but are not in CORE_LOG_SOURCES — add them with a prefix and a description'
    ).toEqual([]);
  });

  it('declares no source that logs nothing', () => {
    const idle = CORE_LOG_SOURCES.filter(
      s =>
        (logsByFile.get(s.file) ?? []).length === 0 &&
        !CORE_UNREADABLE_LOGS.some(u => u.file === s.file)
    ).map(s => s.file);
    expect(
      idle,
      'declared in CORE_LOG_SOURCES but nothing there logs — remove it, or fix the path'
    ).toEqual([]);
  });

  it('points every source at a file that exists', () => {
    const unknown = CORE_LOG_SOURCES.filter(s => !sourceOf.has(s.file)).map(
      s => s.file
    );
    expect(unknown, 'no such file under src/core').toEqual([]);
  });

  /**
   * The declared prefix has to be the one the console actually shows. Where the file
   * creates its logger with a literal, that literal is the answer. Where it does not —
   * a provider name passed to `super()`, or the subclass name in the shared base — the
   * source must say so with `dynamicPrefix`, so a reader is told why the string is not
   * in the file.
   */
  it('declares the prefix each file really logs under', () => {
    const wrong: string[] = [];

    for (const source of CORE_LOG_SOURCES) {
      const text = sourceOf.get(source.file) ?? '';
      const literal = text.match(PREFIX)?.[1];

      if (literal) {
        if (source.dynamicPrefix) {
          wrong.push(
            `${source.file}: marked dynamicPrefix but creates its logger with '${literal}'`
          );
        } else if (literal !== source.prefix) {
          wrong.push(
            `${source.file}: declared '${source.prefix}' but the code uses '${literal}'`
          );
        }
        continue;
      }

      if (!source.dynamicPrefix) {
        wrong.push(
          `${source.file}: no createLogger('…') literal, so the prefix is decided at runtime — set dynamicPrefix and explain it in prefixNote`
        );
        continue;
      }
      if (!source.prefixNote?.trim()) {
        wrong.push(`${source.file}: dynamicPrefix with no prefixNote`);
      }
      // A runtime prefix that is not a `{placeholder}` comes from a literal elsewhere in
      // the file — `super('Facebook')` — and that literal is checkable.
      if (
        !source.prefix.includes('{') &&
        !text.includes(`'${source.prefix}'`)
      ) {
        wrong.push(
          `${source.file}: declared prefix '${source.prefix}' appears nowhere in the file`
        );
      }
    }

    expect(wrong, 'prefix declarations disagree with the source').toEqual([]);
  });

  // ── Notes on error and warn ────────────────────────────────────────────────

  /**
   * The forward direction, and the point of the file: an `error` or `warn` with no
   * Meaning and Action is a line a reader finds in their console and learns nothing
   * from. `info` and `debug` are exempt — they are read in the context of the lines
   * around them.
   */
  it('explains every error and warn core can print', () => {
    const unexplained = [...logsByFile.values()]
      .flat()
      .filter(l => l.level === 'error' || l.level === 'warn')
      .filter(l => !noteFor.has(`${l.level} ${l.message}`))
      .map(l => `${l.level}: ${l.message}  (${l.where})`)
      .sort();

    expect(
      unexplained,
      'core can print these but CORE_LOG_NOTES does not explain them — add a meaning and an action'
    ).toEqual([]);
  });

  /** The reverse: a note for a message that no longer exists misleads. */
  it('keeps no note for a message that is gone', () => {
    const real = new Set(
      [...logsByFile.values()].flat().map(l => `${l.level} ${l.message}`)
    );
    const phantom = CORE_LOG_NOTES.filter(
      n => !real.has(`${n.level} ${n.message}`)
    ).map(n => `${n.level}: ${n.message}`);

    expect(
      phantom,
      'declared in CORE_LOG_NOTES but nothing in core logs it — the wording changed, or the line was removed'
    ).toEqual([]);
  });

  it('gives every note a meaning and an action', () => {
    const thin = [...CORE_LOG_NOTES, ...CORE_UNREADABLE_LOGS]
      .filter(n => !n.meaning?.trim() || !n.action?.trim())
      .map(n => n.message);
    expect(thin, 'a warning with no fix is noise').toEqual([]);
  });

  /**
   * The messages `extract-logs.ts` cannot read. Its rule — first argument must be a
   * literal or a template — is right for the 28 features and is not this page's to
   * change, so the gap is filled by hand and pinned from both ends: each declaration
   * must still be findable in its file, and each unreadable `error`/`warn` call site
   * must be claimed by a declaration.
   */
  it('anchors every declared message in its file', () => {
    const lost = CORE_UNREADABLE_LOGS.filter(
      u => !(sourceOf.get(u.file) ?? '').includes(u.anchor)
    ).map(u => `${u.file}: "${u.anchor}"`);
    expect(
      lost,
      'anchor no longer appears in the file — update it, or drop the entry'
    ).toEqual([]);
  });

  /**
   * The `console.*` calls that never reach `Logger`. Nine of them are attribution
   * failures that lose a UTM tag or a funnel name — real product behaviour, invisible to
   * an extractor that keys on a `logger` receiver, and therefore easy to leave
   * undocumented forever. This check makes that impossible.
   */
  it('explains every console.error and console.warn outside the debug tooling', () => {
    const unclaimed = rawConsoleCalls(coreFiles)
      .filter(
        c =>
          !CORE_CONSOLE_LOGS.some(
            d => d.file === c.file && c.argument.includes(d.anchor)
          )
      )
      .map(
        c => `${c.level} at ${c.file}:${c.line} — ${c.argument.slice(0, 80)}`
      );

    expect(
      unclaimed,
      'these print straight to the console and nothing in CORE_CONSOLE_LOGS explains them — add an entry, or better, route the call through this.logger'
    ).toEqual([]);
  });

  it('anchors every console entry in its file, with a meaning and an action', () => {
    const broken = CORE_CONSOLE_LOGS.filter(
      c =>
        !(sourceOf.get(c.file) ?? '').includes(c.anchor) ||
        !c.meaning.trim() ||
        !c.action.trim()
    ).map(c => `${c.file}: "${c.anchor}"`);
    expect(
      broken,
      'anchor missing from the file, or no meaning/action'
    ).toEqual([]);
  });

  it('claims every error and warn the extractor cannot read', () => {
    const unclaimed = opaqueCalls(coreFiles)
      .filter(c => c.level === 'error' || c.level === 'warn')
      .filter(c => {
        const forFile = CORE_UNREADABLE_LOGS.filter(u => u.file === c.file);
        return !forFile.some(
          u => c.argument.includes(u.anchor) || u.forwarded === true
        );
      })
      .map(
        c => `${c.level} at ${c.file}:${c.line} — ${c.argument.slice(0, 80)}`
      );

    expect(
      unclaimed,
      'these call sites print something the extractor cannot read, and nothing in CORE_UNREADABLE_LOGS covers them'
    ).toEqual([]);
  });

  // ── Healthy boot sample ───────────────────────────────────────────────────

  it('samples healthy boot from messages that exist', () => {
    const byPrefix = new Map(
      CORE_LOG_SOURCES.map(s => [
        s.prefix,
        new Set((logsByFile.get(s.file) ?? []).map(l => l.message)),
      ])
    );
    const invented = CORE_HEALTHY_BOOT.filter(
      line => !byPrefix.get(line.prefix)?.has(line.message)
    ).map(line => `[${line.prefix}] ${line.message}`);

    expect(
      invented,
      'CORE_HEALTHY_BOOT shows output core does not produce under that prefix'
    ).toEqual([]);
  });

  // ── Errors ────────────────────────────────────────────────────────────────

  it('declares every error core throws', () => {
    // `extracted` is the string the source check works on; see its TSDoc.
    const declared = new Set(CORE_ERRORS.map(e => e.extracted ?? e.message));
    const missing = thrown
      .filter(e => !declared.has(e.message))
      .map(e => `${e.message}  (${e.where})`);
    expect(
      missing,
      'core throws these but core-errors.ts does not declare them — add them with a kind, a cause, and a fix'
    ).toEqual([]);
  });

  it('declares no error that is not thrown', () => {
    const inSource = new Set(thrown.map(e => e.message));
    const phantom = CORE_ERRORS.filter(
      e => !e.fromApi && !inSource.has(e.extracted ?? e.message)
    ).map(e => e.message);
    expect(
      phantom,
      'declared in core-errors.ts but nothing in core throws it — remove it, or set fromApi'
    ).toEqual([]);
  });

  it('attributes every error to the file that throws it', () => {
    const whereThrown = new Map(
      thrown.map(e => [e.message, e.where.split(':')[0]] as const)
    );
    const wrong = CORE_ERRORS.filter(e => {
      const file = whereThrown.get(e.extracted ?? e.message);
      return file !== undefined && file !== e.file;
    }).map(
      e =>
        `${e.message}: declared ${e.file}, thrown in ${whereThrown.get(e.extracted ?? e.message)}`
    );
    expect(wrong, 'the throw moved to another file').toEqual([]);
  });

  it('gives every error a cause and a fix', () => {
    const thin = CORE_ERRORS.filter(e => !e.cause.trim() || !e.fix.trim()).map(
      e => e.message
    );
    expect(thin, '.claude/rules/guide.md forbids an error with no fix').toEqual(
      []
    );
  });

  // ── The claims the pages make about production ────────────────────────────

  /**
   * `logs.md` tells a reader that the UMD bundle prints nothing and the module bundle
   * prints errors always and the rest under debug mode. That is a statement about the
   * build configuration and about `Logger`, and both can change without anyone
   * remembering this page — so it is checked rather than trusted.
   */
  it('still describes production the way the build is configured', () => {
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(vite, 'the UMD claim depends on drop_console').toContain(
      'drop_console: true'
    );
    for (const fn of [
      'console.log',
      'console.info',
      'console.warn',
      'console.debug',
    ]) {
      expect(vite, `pure_funcs no longer lists ${fn}`).toContain(`'${fn}'`);
    }

    const loader = readFileSync(join(ROOT, 'public', 'loader.js'), 'utf8');
    expect(
      loader,
      'the module bundle is no longer the primary entry point'
    ).toContain("PROD_ENTRY_PATH = '/index.js'");
    expect(loader, 'the UMD fallback path changed').toContain('index.umd.js');
  });

  it('still describes the levels the way Logger gates them', () => {
    const logger = readFileSync(join(CORE, 'logger.ts'), 'utf8');
    const guard = 'isProduction && !isDebugModeEnabled()';

    // error is deliberately ungated: the claim "error always prints" rests on it.
    const errorBody = logger.slice(
      logger.indexOf('public error('),
      logger.indexOf('public warn(')
    );
    expect(errorBody, 'Logger.error gained a production guard').not.toContain(
      'isProduction'
    );
    expect(errorBody).toContain('console.error');

    for (const level of ['warn', 'info', 'debug']) {
      const from = logger.indexOf(`public ${level}(`);
      expect(
        logger.slice(from, from + 400),
        `Logger.${level} no longer gates on production plus debug mode`
      ).toContain(guard);
    }

    for (const param of ['debug', 'debugger']) {
      expect(
        logger,
        `debug mode no longer reads the ${param} URL parameter`
      ).toContain(`params.get('${param}')`);
    }
  });

  /**
   * The page's debug-mode table says `?debug=true` gets you `warn` and `info` but not
   * `debug` lines, and that a `next-debug` meta tag gets you nothing beyond errors. Both
   * rest on two facts in two different files: `Logger` reads only the URL and
   * `window.nextConfig`, while the log **level** is raised only from the config store,
   * which is what the meta tag feeds.
   */
  it('still describes debug mode the way the two halves of it work', () => {
    const logger = readFileSync(join(CORE, 'logger.ts'), 'utf8');
    expect(
      logger,
      'Logger now reads something other than the URL and window.nextConfig — the debug-mode table needs a new row'
    ).not.toMatch(/useConfigStore|querySelector/);

    const boot = readFileSync(join(CORE, 'sdk-initializer.ts'), 'utf8');
    const raise = boot.indexOf('Logger.setLogLevel(LogLevel.DEBUG)');
    expect(raise, 'nothing raises the level to DEBUG any more').toBeGreaterThan(
      -1
    );
    expect(
      boot.slice(Math.max(0, raise - 400), raise),
      'the level is no longer raised from configStore.debug'
    ).toContain('configStore.debug');

    const config = readFileSync(
      join(SRC, 'state/config/config.state.ts'),
      'utf8'
    );
    expect(
      config,
      'the next-debug meta tag row describes a tag the config store no longer reads'
    ).toContain('meta[name="next-debug"]');
  });

  // ── The pages ─────────────────────────────────────────────────────────────

  it('logs.md matches the source and the notes', () => {
    const expected = renderCoreLogs(
      groups,
      CORE_HEALTHY_BOOT.map(l => `[${l.prefix}] ${l.message}`),
      CORE_CONSOLE_LOGS,
      c => `${c.file}:${lineOf(c.file, c.anchor)}`
    );
    const out = join(OUT_DIR, 'logs.md');
    if (UPDATE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(out, expected);
    }
    expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('errors.md matches the declarations', () => {
    const expected = renderCoreErrors(CORE_ERRORS, CORE_LOG_SOURCES);
    const out = join(OUT_DIR, 'errors.md');
    if (UPDATE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(out, expected);
    }
    expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });
});

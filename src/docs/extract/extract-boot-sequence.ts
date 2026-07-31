/**
 * Reads the SDK's boot sequence out of `core/sdk-initializer.ts`.
 *
 * `SDKInitializer.initialize()` is a flat list of `await this.x()` calls, so the order
 * an author needs — what runs, when, and what has to finish before `window.next`
 * exists — is already written down in the source. Transcribing it into markdown by
 * hand produces a page that is correct on the day it is written and wrong after the
 * next reorder, which is the failure mode that matters most here: a reader who trusts
 * a stale order calls `next.getCartData()` too early and sees an empty cart.
 *
 * Four things come out:
 *
 * 1. **The ordered steps** — name, awaited or not, the `if` guarding it, and whether an
 *    error inside it escapes to `initialize()`'s `catch` (see {@link BootStep.errorsEscape}).
 * 2. **What the page can observe** — the `data-next-sdk-loading` writes and the
 *    `next-display-ready` class, each tagged with the phase it belongs to.
 * 3. **The events** — `next:ready` from the loader, `next:initialized` from the end of
 *    boot, `next:display-ready` from the DOM scan. The loader is read too, because the
 *    single most expensive misunderstanding about boot is that `next:ready` means ready.
 * 4. **The failure path** — retry count, the delay before each retry, and whether the
 *    error is re-thrown once the retries are spent.
 *
 * @internal
 */

import ts from 'typescript';

import { MODULE_SCOPE, anchor, enclosingFunction } from './source-anchor';
import { readFileSync } from 'node:fs';

/** A file to read, plus the short name used in every anchor this module reports. */
export interface BootSource {
  /** Absolute path. */
  path: string;
  /** How it is cited in the docs, e.g. `core/sdk-initializer.ts`. */
  name: string;
}

/** One `throw new Error('…')` inside a boot step. */
export interface BootThrow {
  message: string;
  where: string;
}

/** One statement of `initialize()` that calls something. */
export interface BootStep {
  /** 1-based position in `initialize()`. */
  index: number;
  /** As written at the call site: `waitForDOM`, `cartOperations.clear`. */
  name: string;
  /** `this` for `SDKInitializer`'s own methods, otherwise the receiver as written. */
  receiver: string;
  /** False means boot moves on without waiting for this step to finish. */
  awaited: boolean;
  /** The `if` condition wrapping the call, when the step is conditional. */
  guardedBy?: string;
  where: string;
  /**
   * True when an error inside this step reaches `initialize()`'s `catch` — the method
   * has an `await` or a `throw` that is not inside a `try`/`catch` of its own. False
   * means the step handles its own failures and boot continues past it.
   *
   * `undefined` when the method is not declared on `SDKInitializer`, so nothing can be
   * said without following the call out of the file.
   */
  errorsEscape?: boolean;
  /**
   * True when the method has a `try`/`catch` of its own. Together with
   * {@link BootStep.errorsEscape} this separates "handles its own failures" from "has
   * nothing that can fail" — two very different rows for a reader, and both of them
   * come out as `errorsEscape: false`.
   */
  catchesOwnErrors?: boolean;
  /** Literal throws inside the method — how this step can abort the boot. */
  throws: BootThrow[];
}

/** Something the boot writes onto the document that CSS or a script can watch. */
export interface BootSignal {
  kind: 'attribute' | 'class';
  /** `body` or `html`. */
  target: string;
  name: string;
  /** For an attribute, the value written. */
  value?: string;
  phase: 'boot-start' | 'display-ready' | 'boot-complete' | 'boot-failed';
  where: string;
}

/** One event the boot path dispatches. */
export interface BootEvent {
  name: string;
  /** Where a listener has to be attached. */
  target: 'window' | 'document' | 'event-bus';
  /** Keys of the `detail` object literal, in source order. */
  detail: string[];
  /** First dispatch site. */
  where: string;
  /** How many places dispatch it — the loader fires `next:ready` from three. */
  sites: number;
}

/** What `initialize()` does when a step throws. */
export interface RetryPolicy {
  maxRetries: number;
  /** Milliseconds before each retry, in order. Empty when it is not a literal. */
  delays: number[];
  /** The delay expression as written, for when it stops reducing to numbers. */
  delayExpression: string;
  /** True when the `catch` re-runs `initialize()` itself. */
  recursive: boolean;
  /** True when the error is re-thrown after the retries are spent. */
  rethrows: boolean;
  where: string;
}

export interface BootSequence {
  steps: BootStep[];
  signals: BootSignal[];
  events: BootEvent[];
  retry: RetryPolicy;
  /** True when a second `initialize()` returns early instead of booting twice. */
  reentryGuarded: boolean;
  /** Every method name declared on `SDKInitializer`, for the drift check. */
  methods: string[];
}

// ── shared helpers ──────────────────────────────────────────────────────────

function parse(source: BootSource): ts.SourceFile {
  return ts.createSourceFile(
    source.name,
    readFileSync(source.path, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

/**
 * Where a boot fact lives, as `file › Symbol`.
 *
 * @param fallbackSymbol Used when the node sits at the top level of its scope — the
 *   loader's inline `<script>` has no enclosing function, and citing the bare file
 *   would not say which of the loader's two bodies of code it came from.
 */
function at(
  sf: ts.SourceFile,
  node: ts.Node,
  name: string,
  fallbackSymbol?: string
): string {
  const { name: symbol } = enclosingFunction(node, sf);
  return anchor(
    name,
    symbol === MODULE_SCOPE ? (fallbackSymbol ?? '') : symbol
  );
}

/** One parseable body of code: a file, or a script the loader builds as a string. */
interface Scope {
  sf: ts.SourceFile;
  /** File this scope is cited as. */
  name: string;
  /**
   * Symbol to cite when a fact sits at this scope's top level. Set for a nested
   * script, whose statements have no enclosing function of their own.
   */
  fallbackSymbol?: string;
  /** Method names whose dispatches count; every method counts when absent. */
  allowFrom?: Set<string>;
}

/**
 * Scripts the file assigns as text — `moduleScript.innerHTML = \`…\`` in the loader.
 *
 * The loader's `next:ready` dispatch lives inside such a template, so it is a string
 * to the parser and an AST walk over the file alone finds nothing. That would quietly
 * drop the one fact this page exists to correct. Each template is re-parsed as its own
 * script with `${…}` spans swapped for a placeholder identifier — `${isDebug} ? 'a' :
 * 'b'` is not parseable, `__EXPR__ ? 'a' : 'b'` is. Each fact the template yields is
 * cited against the symbol that *builds* the script, since the template's own
 * statements sit at top level and have no enclosing function to name.
 */
function nestedScripts(scope: Scope): Scope[] {
  const out: Scope[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /\.innerHTML$/.test(node.left.getText(scope.sf)) &&
      ts.isTemplateExpression(node.right)
    ) {
      const template = node.right;
      const text =
        template.head.text +
        template.templateSpans.map(s => `__EXPR__${s.literal.text}`).join('');
      // Statements inside the template have no enclosing function of their own, so
      // they inherit the symbol that *builds* the script — `loader.js › loadModule`
      // reads better than the bare file, and says which of the loader's bodies of
      // code the dispatch came from.
      const builder = enclosingFunction(node, scope.sf).name;
      out.push({
        sf: ts.createSourceFile(
          scope.name,
          text,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.JS
        ),
        name: scope.name,
        // At top level there is no builder to name, so cite the element the script is
        // assigned to (`moduleScript.innerHTML` → `moduleScript`). That is a real
        // identifier in the file, so a reader can still grep straight to it.
        fallbackSymbol:
          builder === MODULE_SCOPE
            ? node.left.getText(scope.sf).replace(/\.innerHTML$/, '')
            : builder,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(scope.sf);

  return out;
}

/** The method a node sits in, for keeping debug-only dispatches off the boot page. */
function enclosingMethod(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

/** `'next:ready'` → `next:ready`; anything not a literal → undefined. */
function literal(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function findClass(sf: ts.SourceFile, name: string): ts.ClassDeclaration {
  let found: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found) throw new Error(`class ${name} not found in ${sf.fileName}`);
  return found;
}

function methodsOf(
  cls: ts.ClassDeclaration
): Map<string, ts.MethodDeclaration> {
  const out = new Map<string, ts.MethodDeclaration>();
  for (const member of cls.members) {
    if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
      out.set(member.name.text, member);
    }
  }
  return out;
}

/** The initializer of a static property, as written: `maxRetries = 3` → `3`. */
function staticValue(
  cls: ts.ClassDeclaration,
  name: string
): string | undefined {
  for (const member of cls.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === name
    ) {
      return member.initializer?.getText();
    }
  }
  return undefined;
}

// ── per-step analysis ───────────────────────────────────────────────────────

/**
 * Walks a method looking for an `await` or a `throw` that no `catch` covers.
 *
 * This is the question a reader actually has about each step — "does this failing kill
 * the page, or does boot carry on?" — and it is answerable from the shape of the code.
 *
 * Only `await` and `throw` count. Counting every call expression instead would report
 * `checkAndLoadOrder` as unprotected because it reads `urlParams.get(…)` before its
 * `try`, which is not the kind of failure anyone is asking about. Bodies of nested
 * functions are skipped: a throw inside a `.then()` callback or an event listener has
 * its own error path and never reaches `initialize()`.
 */
function errorsEscape(method: ts.MethodDeclaration): boolean {
  if (!method.body) return false;
  let escapes = false;

  const visit = (node: ts.Node, guarded: boolean): void => {
    if (escapes) return;

    if (ts.isTryStatement(node)) {
      const covered = guarded || node.catchClause !== undefined;
      ts.forEachChild(node.tryBlock, child => visit(child, covered));
      // The catch and finally blocks are only as protected as the try statement was.
      if (node.catchClause) {
        ts.forEachChild(node.catchClause, child => visit(child, guarded));
      }
      if (node.finallyBlock) {
        ts.forEachChild(node.finallyBlock, child => visit(child, guarded));
      }
      return;
    }

    if (ts.isFunctionLike(node)) return;

    if (!guarded && (ts.isAwaitExpression(node) || ts.isThrowStatement(node))) {
      escapes = true;
      return;
    }

    ts.forEachChild(node, child => visit(child, guarded));
  };

  ts.forEachChild(method.body, child => visit(child, false));
  return escapes;
}

/** Whether the method installs a `catch` of its own anywhere in its body. */
function catchesOwnErrors(method: ts.MethodDeclaration): boolean {
  if (!method.body) return false;
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node) && node.catchClause) found = true;
    if (!found) ts.forEachChild(node, visit);
  };
  ts.forEachChild(method.body, visit);
  return found;
}

/**
 * Literal `throw new Error('…')` sites in a method.
 *
 * `extractThrows()` in `extract-logs.ts` answers this per *file*; a boot step needs it
 * per *method*, and per-method line numbers are the point — so the walk is repeated
 * here rather than reshaping the shared helper around a second caller.
 */
function throwsIn(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile,
  name: string
): BootThrow[] {
  const out: BootThrow[] = [];
  if (!method.body) return out;

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return; // a throw inside a callback is not this step's
    if (ts.isThrowStatement(node) && node.expression) {
      const expr = node.expression;
      const message = ts.isNewExpression(expr)
        ? literal(expr.arguments?.[0])
        : undefined;
      if (message) out.push({ message, where: at(sf, node, name) });
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(method.body, visit);
  return out;
}

// ── the sequence itself ─────────────────────────────────────────────────────

/** Statements that are documented in their own section rather than as a step. */
function isNotAStep(receiver: string): boolean {
  return /(^|\.)logger$/.test(receiver) || receiver.startsWith('document');
}

function collectSteps(
  tryBlock: ts.Block,
  sf: ts.SourceFile,
  source: BootSource,
  methods: Map<string, ts.MethodDeclaration>
): BootStep[] {
  const steps: BootStep[] = [];

  const takeCall = (statement: ts.Statement, guardedBy?: string): void => {
    if (!ts.isExpressionStatement(statement)) return;

    let expr: ts.Expression = statement.expression;
    const awaited = ts.isAwaitExpression(expr);
    if (ts.isAwaitExpression(expr)) expr = expr.expression;
    if (!ts.isCallExpression(expr)) return;
    if (!ts.isPropertyAccessExpression(expr.expression)) return;

    const receiver = expr.expression.expression.getText(sf);
    const member = expr.expression.name.text;
    if (isNotAStep(receiver)) return;

    const method = receiver === 'this' ? methods.get(member) : undefined;
    steps.push({
      index: steps.length + 1,
      name: receiver === 'this' ? member : `${receiver}.${member}`,
      receiver,
      awaited,
      ...(guardedBy ? { guardedBy } : {}),
      where: at(sf, statement, source.name),
      ...(method
        ? {
            errorsEscape: errorsEscape(method),
            catchesOwnErrors: catchesOwnErrors(method),
          }
        : {}),
      throws: method ? throwsIn(method, sf, source.name) : [],
    });
  };

  for (const statement of tryBlock.statements) {
    if (ts.isIfStatement(statement)) {
      const condition = statement.expression.getText(sf);
      const body = statement.thenStatement;
      const inner = ts.isBlock(body) ? body.statements : [body];
      for (const child of inner) takeCall(child, condition);
      continue;
    }
    takeCall(statement);
  }

  return steps;
}

function collectSignals(
  initialize: ts.MethodDeclaration,
  tryStatement: ts.TryStatement,
  sf: ts.SourceFile,
  source: BootSource
): BootSignal[] {
  const out: BootSignal[] = [];

  // Everything written after `this.initialized = true` belongs to the ready phase.
  let readyFrom = Number.MAX_SAFE_INTEGER;
  const findReady = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(sf) === 'this.initialized' &&
      node.right.kind === ts.SyntaxKind.TrueKeyword
    ) {
      readyFrom = Math.min(readyFrom, node.getStart(sf));
    }
    ts.forEachChild(node, findReady);
  };
  if (initialize.body) findReady(initialize.body);

  const catchStart =
    tryStatement.catchClause?.getStart(sf) ?? Number.MAX_SAFE_INTEGER;

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'setAttribute' &&
      node.expression.expression.getText(sf) === 'document.body'
    ) {
      const name = literal(node.arguments[0]);
      const value = literal(node.arguments[1]);
      const start = node.getStart(sf);
      if (name) {
        out.push({
          kind: 'attribute',
          target: 'body',
          name,
          ...(value ? { value } : {}),
          phase:
            start > catchStart
              ? 'boot-failed'
              : start > readyFrom
                ? 'boot-complete'
                : 'boot-start',
          where: at(sf, node, source.name),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  if (initialize.body) visit(initialize.body);

  return out;
}

/** `document.documentElement.classList.add('next-display-ready')`, wherever it lives. */
function collectClassSignals(source: BootSource): BootSignal[] {
  const sf = parse(source);
  const out: BootSignal[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'add' &&
      node.expression.expression.getText(sf) ===
        'document.documentElement.classList'
    ) {
      const name = literal(node.arguments[0]);
      if (name) {
        out.push({
          kind: 'class',
          target: 'html',
          name,
          phase: 'display-ready',
          where: at(sf, node, source.name),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return out;
}

/** The `new CustomEvent('…', { detail: { … } })` behind a dispatch, if there is one. */
function customEventFor(
  argument: ts.Expression,
  sf: ts.SourceFile
): ts.NewExpression | undefined {
  const isCustomEvent = (node: ts.Node): node is ts.NewExpression =>
    ts.isNewExpression(node) && node.expression.getText(sf) === 'CustomEvent';

  if (isCustomEvent(argument)) return argument;
  if (!ts.isIdentifier(argument)) return undefined;

  // `const event = new CustomEvent(…); window.dispatchEvent(event);` — the common
  // shape at the end of boot. Look for the declaration in the enclosing function.
  const name = argument.text;
  let scope: ts.Node | undefined = argument;
  while (scope && !ts.isFunctionLike(scope)) scope = scope.parent;
  if (!scope) return undefined;

  let found: ts.NewExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      isCustomEvent(node.initializer)
    ) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

function detailKeys(event: ts.NewExpression, sf: ts.SourceFile): string[] {
  const options = event.arguments?.[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return [];
  for (const property of options.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      property.name.getText(sf) === 'detail' &&
      ts.isObjectLiteralExpression(property.initializer)
    ) {
      return property.initializer.properties
        .map(p => (p.name ? p.name.getText(sf) : ''))
        .filter(Boolean);
    }
  }
  return [];
}

function collectEvents(scopes: Scope[]): BootEvent[] {
  const byName = new Map<string, BootEvent>();

  const add = (event: BootEvent): void => {
    const existing = byName.get(event.name);
    if (existing) {
      existing.sites += 1;
      return;
    }
    byName.set(event.name, event);
  };

  for (const scope of [...scopes, ...scopes.flatMap(nestedScripts)]) {
    const { sf, name } = scope;

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const member = node.expression.name.text;
        const receiver = node.expression.expression.getText(sf);
        const first = node.arguments[0];
        // `nextDebug.accordion.open()` dispatches events too, and they have nothing to
        // do with booting. Restricting to the boot-path methods keeps them off the page.
        const onBootPath =
          !scope.allowFrom || scope.allowFrom.has(enclosingMethod(node) ?? '');

        if (member === 'dispatchEvent' && first && onBootPath) {
          const event = customEventFor(first, sf);
          const eventName = event && literal(event.arguments?.[0]);
          if (event && eventName) {
            add({
              name: eventName,
              target: receiver === 'document' ? 'document' : 'window',
              detail: detailKeys(event, sf),
              where: at(sf, node, name, scope.fallbackSymbol),
              sites: 1,
            });
          }
        }

        // The internal bus, so a page author can tell the two channels apart.
        if (
          member === 'emit' &&
          /(^|\.)eventBus$/i.test(receiver) &&
          onBootPath
        ) {
          const eventName = literal(first);
          if (eventName) {
            add({
              name: eventName,
              target: 'event-bus',
              detail: [],
              where: at(sf, node, name, scope.fallbackSymbol),
              sites: 1,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return [...byName.values()];
}

function readRetryPolicy(
  cls: ts.ClassDeclaration,
  tryStatement: ts.TryStatement,
  sf: ts.SourceFile,
  source: BootSource
): RetryPolicy {
  const maxRetries = Number(staticValue(cls, 'maxRetries') ?? '0');
  const clause = tryStatement.catchClause;

  let delayExpression = '';
  let recursive = false;
  let rethrows = false;

  if (clause) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(sf) === 'setTimeout' &&
        node.arguments[1]
      ) {
        delayExpression = node.arguments[1].getText(sf);
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(sf) === 'this.initialize'
      ) {
        recursive = true;
      }
      if (ts.isThrowStatement(node)) rethrows = true;
      ts.forEachChild(node, visit);
    };
    visit(clause);
  }

  // `1000 * this.retryAttempts`, with the counter already incremented, is 1s then 2s
  // then 3s. Only this shape is reduced to numbers; anything else stays as source text
  // so the page cannot invent a schedule the code does not implement.
  const linear = /^(\d+)\s*\*\s*this\.retryAttempts$/.exec(delayExpression);
  const delays = linear
    ? Array.from({ length: maxRetries }, (_, i) => Number(linear[1]) * (i + 1))
    : [];

  return {
    maxRetries,
    delays,
    delayExpression,
    recursive,
    rethrows,
    where: clause
      ? at(sf, clause, source.name)
      : at(sf, tryStatement, source.name),
  };
}

/**
 * @param initializer `core/sdk-initializer.ts`
 * @param observers other files on the boot path that write to the document or dispatch
 *   an event the author can listen for — `core/attribute-scanner.ts` and
 *   `public/loader.js`. The loader is plain JavaScript; `createSourceFile` parses it
 *   the same way, and leaving it out would hide the `next:ready` trap.
 */
export function extractBootSequence(
  initializer: BootSource,
  observers: BootSource[] = []
): BootSequence {
  const sf = parse(initializer);
  const cls = findClass(sf, 'SDKInitializer');
  const methods = methodsOf(cls);

  const initialize = methods.get('initialize');
  if (!initialize?.body) {
    throw new Error(
      `SDKInitializer.initialize() not found in ${initializer.name}`
    );
  }

  const tryStatement = initialize.body.statements.find(ts.isTryStatement);
  if (!tryStatement) {
    throw new Error(
      `initialize() no longer wraps the boot in try/catch (${initializer.name}) — ` +
        'the retry and abort sections of the page describe a path that is gone'
    );
  }

  const reentryGuarded = initialize.body.statements.some(
    statement =>
      ts.isIfStatement(statement) &&
      statement.expression.getText(sf).includes('this.initialized')
  );

  const steps = collectSteps(tryStatement.tryBlock, sf, initializer, methods);

  return {
    steps,
    signals: [
      ...collectSignals(initialize, tryStatement, sf, initializer),
      ...observers.flatMap(collectClassSignals),
    ],
    events: collectEvents([
      {
        sf,
        name: initializer.name,
        allowFrom: new Set(['initialize', ...steps.map(step => step.name)]),
      },
      ...observers.map(source => ({
        sf: parse(source),
        name: source.name,
      })),
    ]),
    retry: readRetryPolicy(cls, tryStatement, sf, initializer),
    reentryGuarded,
    methods: [...methods.keys()],
  };
}

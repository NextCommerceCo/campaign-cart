/**
 * The walk itself: turns `initialize()`'s `try` block into {@link BootStep}s, finds the
 * DOM signals and dispatched events the boot path produces, and reads the retry
 * policy out of its `catch`. Called once, from
 * `./extract-boot-sequence-sequence`'s {@link extractBootSequence}.
 */

import ts from 'typescript';

import {
  at,
  enclosingMethod,
  literal,
  parse,
  staticValue,
} from './extract-boot-sequence-ast-helpers';
import { resolveImportedCall } from './extract-boot-sequence-imports';
import { nestedScripts, type Scope } from './extract-boot-sequence-scripts';
import {
  catchesOwnErrors,
  errorsEscape,
  throwsIn,
} from './extract-boot-sequence-step-analysis';
import type {
  BootEvent,
  BootSignal,
  BootSource,
  BootStep,
  RetryPolicy,
} from './extract-boot-sequence-types';

// ── per-step analysis ───────────────────────────────────────────────────────

/** Statements that are documented in their own section rather than as a step. */
function isNotAStep(receiver: string): boolean {
  return /(^|\.)logger$/.test(receiver) || receiver.startsWith('document');
}

export function collectSteps(
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

    const callee = expr.expression;
    let receiver: string;
    let member: string;
    if (ts.isPropertyAccessExpression(callee)) {
      receiver = callee.expression.getText(sf);
      member = callee.name.text;
    } else if (ts.isIdentifier(callee)) {
      // A bare `importedFn(…)` call — no receiver "as written".
      receiver = '';
      member = callee.text;
    } else {
      return;
    }
    if (isNotAStep(receiver)) return;

    const method = receiver === 'this' ? methods.get(member) : undefined;
    // A call that stays on `this` resolves through `methods`. One that leaves
    // `SDKInitializer` — a boot step split into its own file — resolves through the
    // import it was reached by instead. At most one of the two can apply.
    const imported = method
      ? undefined
      : resolveImportedCall(callee, sf, source);

    steps.push({
      index: steps.length + 1,
      name: method
        ? member
        : (imported?.name ?? (receiver ? `${receiver}.${member}` : member)),
      receiver,
      awaited,
      ...(guardedBy ? { guardedBy } : {}),
      where: at(sf, statement, source.name),
      ...(method
        ? {
            errorsEscape: errorsEscape(method),
            catchesOwnErrors: catchesOwnErrors(method),
          }
        : imported
          ? {
              errorsEscape: errorsEscape(imported.fn),
              catchesOwnErrors: catchesOwnErrors(imported.fn),
            }
          : {}),
      throws: method
        ? throwsIn(method, sf, source.name)
        : imported
          ? throwsIn(imported.fn, imported.sf, imported.fileName)
          : [],
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

export function collectSignals(
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
export function collectClassSignals(source: BootSource): BootSignal[] {
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

export function collectEvents(scopes: Scope[]): BootEvent[] {
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

export function readRetryPolicy(
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

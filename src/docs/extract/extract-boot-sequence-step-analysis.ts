/**
 * Answers, for one boot step's function body, the question a reader actually has:
 * "does this failing kill the page, or does boot carry on?" — plus the literal
 * throws inside it. Applies the same way whether the step is a method on
 * `SDKInitializer` or a free function reached through
 * `./extract-boot-sequence-imports`, because both are a {@link StepFunction}.
 */

import ts from 'typescript';

import { at, literal } from './extract-boot-sequence-ast-helpers';
import type { BootThrow } from './extract-boot-sequence-types';

/** A method or a free function — both have a body {@link errorsEscape} can walk. */
export type StepFunction = ts.MethodDeclaration | ts.FunctionDeclaration;

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
export function errorsEscape(method: StepFunction): boolean {
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
export function catchesOwnErrors(method: StepFunction): boolean {
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
export function throwsIn(
  method: StepFunction,
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

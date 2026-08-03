/**
 * The public entry point: finds `SDKInitializer.initialize()`, confirms it still
 * wraps the boot in `try`/`catch`, then hands its pieces to
 * `./extract-boot-sequence-collect` and assembles the result.
 */

import ts from 'typescript';

import {
  findClass,
  methodsOf,
  parse,
} from './extract-boot-sequence-ast-helpers';
import {
  collectClassSignals,
  collectEvents,
  collectSignals,
  collectSteps,
  readRetryPolicy,
} from './extract-boot-sequence-collect';
import type { BootSequence, BootSource } from './extract-boot-sequence-types';

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

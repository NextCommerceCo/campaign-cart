/**
 * Finds where each `dl_*` event is actually built, across the analytics source and
 * any extra boot-path files that construct one directly.
 */

import ts from 'typescript';

import { MODULE_SCOPE, enclosingFunction } from './source-anchor';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  parse,
  propertyName,
  stringOf,
} from './extract-analytics-events-ast-helpers';
import type { EmitSite } from './extract-analytics-events-types';

/**
 * Calls that construct a dataLayer event from a literal event name. A provider's
 * mapping table also mentions event names, which is why the scan is by call
 * shape rather than by text: a name that only appears as a mapping key is a name
 * the SDK never fires.
 */
const EMIT_CALLEES = [
  'createEvent',
  'createUserDataEvent',
  'formatEcommerceEvent',
  'formatUserDataEvent',
];

/** Folders whose files consume the vocabulary instead of producing it. */
const NON_EMIT_DIRS = ['providers', 'schemas', 'validation', 'debug'];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (NON_EMIT_DIRS.includes(entry.name)) continue;
      out.push(...collectSourceFiles(full));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'config.ts' &&
      entry.name !== 'types.ts'
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Finds where each `dl_*` event is built, across the analytics source and the
 * SDK boot file.
 *
 * @param analyticsDir absolute path to `src/core/analytics`
 * @param srcRoot absolute path to `src`, used to make the reported paths relative
 * @param extraFiles other files that construct events (e.g. `core/sdk-initializer.ts`)
 */
export function extractEmitSites(
  analyticsDir: string,
  srcRoot: string,
  extraFiles: string[] = []
): Record<string, EmitSite[]> {
  const sites: Record<string, EmitSite[]> = {};
  const add = (
    name: string,
    file: string,
    node: ts.Node,
    how: string
  ): void => {
    const sf = node.getSourceFile();
    const { name: enclosing } = enclosingFunction(node, sf);
    const symbol = enclosing === MODULE_SCOPE ? '' : enclosing;
    const rel = relative(srcRoot, file).split(sep).join('/');
    const list = (sites[name] ??= []);
    // Two builds of the same event in one method were two rows when a row was a
    // line; anchored to the symbol they are the same row, so drop the repeat
    // rather than printing an identical citation twice.
    if (
      list.some(s => s.file === rel && s.symbol === symbol && s.how === how)
    ) {
      return;
    }
    list.push({ file: rel, symbol, how });
  };

  for (const file of [...collectSourceFiles(analyticsDir), ...extraFiles]) {
    const sf = parse(file);
    const visit = (node: ts.Node): void => {
      // EventBuilder.createEvent('dl_x', { … })
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(sf);
        const method = callee.split('.').pop() ?? callee;
        const name = stringOf(node.arguments[0]);
        if (EMIT_CALLEES.includes(method) && name?.startsWith('dl_')) {
          add(name, file, node, `${method}()`);
        }
      }
      // dataLayer.push({ event: 'dl_x', … })
      if (ts.isPropertyAssignment(node) && propertyName(node) === 'event') {
        const name = stringOf(node.initializer);
        if (name?.startsWith('dl_')) add(name, file, node, 'event: literal');
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  for (const list of Object.values(sites)) {
    // By symbol, not by position: a stable order that does not shift when the file
    // is reformatted or a sibling function moves above this one.
    list.sort(
      (a, b) => a.file.localeCompare(b.file) || a.symbol.localeCompare(b.symbol)
    );
  }
  return sites;
}

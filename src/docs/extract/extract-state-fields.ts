/**
 * Reads a store's state interface and returns its fields with their declared types.
 *
 * This is what stops the state docs from drifting in the two ways that matter: a field
 * added to the interface and never documented, and a documented field whose type has
 * since changed. Types are read here rather than written into the manifest, because a
 * type copied by hand is a second copy that goes stale.
 *
 * Methods are skipped — a store interface mixes state and actions, and the schema table
 * is about state. Actions are documented as operations instead.
 *
 * @internal
 */

import ts from 'typescript';
import { readFileSync } from 'node:fs';

export interface ExtractedField {
  name: string;
  /** The type as written, collapsed to one line. */
  type: string;
  /** True when the declared type includes `null` or `undefined`, or is optional. */
  nullable: boolean;
}

/**
 * `Array<{ a: string }>` spread over lines → one line, for a table cell.
 *
 * Comments have to go first. A line comment inside an inline object type —
 * `Array<{ // Track the journey\n packageId?: string ... }>` — swallows everything
 * after it once the newlines collapse, so the published type read as one long comment.
 */
function oneLine(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .trim();
}

/** Every interface declaration found across the given files, by name. */
function indexInterfaces(
  files: string[]
): Map<string, { node: ts.InterfaceDeclaration; sf: ts.SourceFile }> {
  const found = new Map<
    string,
    { node: ts.InterfaceDeclaration; sf: ts.SourceFile }
  >();
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node) && !found.has(node.name.text)) {
        found.set(node.name.text, { node, sf });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

/**
 * @param file absolute path to the file declaring the interface
 * @param interfaceName e.g. `CartState`
 * @param alsoSearch other files that may declare a base interface. `AttributionState
 *   extends Attribution`, and `Attribution` lives in `src/types/api.ts` — without
 *   these, the whole inherited half of the schema (every `utm_*` tag) is invisible,
 *   which is most of what that store is for.
 */
export function extractStateFields(
  file: string,
  interfaceName: string,
  alsoSearch: string[] = []
): ExtractedField[] {
  const index = indexInterfaces([file, ...alsoSearch]);
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  /** Walks `extends` chains breadth-first so a subclass override wins. */
  const collect = (name: string, depth = 0): void => {
    if (depth > 8) return; // a cycle in the type graph should not hang the test
    const entry = index.get(name);
    if (!entry) return;
    const { node, sf } = entry;

    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !member.name) continue;
      const type = member.type;
      // A method written as a property (`reset: () => void`) is an action, not state.
      if (type && ts.isFunctionTypeNode(type)) continue;

      const fieldName = member.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (seen.has(fieldName)) continue;
      seen.add(fieldName);

      const typeText = type ? oneLine(type.getText(sf)) : 'unknown';
      fields.push({
        name: fieldName,
        type: typeText,
        nullable:
          member.questionToken !== undefined ||
          /\bnull\b|\bundefined\b/.test(typeText),
      });
    }

    for (const clause of node.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const t of clause.types) {
        const base = t.expression.getText(sf);
        collect(base, depth + 1);
      }
    }
  };

  collect(interfaceName);
  return fields;
}

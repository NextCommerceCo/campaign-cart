/**
 * Reads the canonical `dl_*` vocabulary out of `schemas/events.ts` and each event's
 * field schema out of `schemas/index.ts`. Both are literals, so an event or a field
 * added there is picked up here without a second hand-copied table.
 */

import ts from 'typescript';

import {
  findVariableInitializer,
  parse,
  propertyName,
  stringOf,
  unwrap,
} from './extract-analytics-events-ast-helpers';
import type {
  DlEventEntry,
  SchemaField,
  SharedShape,
} from './extract-analytics-events-types';

// ── DL_EVENTS ───────────────────────────────────────────────────────────────

/** Reads the canonical vocabulary out of `schemas/events.ts`. */
export function extractDlEvents(eventsFile: string): DlEventEntry[] {
  const sf = parse(eventsFile);
  const literal = unwrap(findVariableInitializer(sf, 'DL_EVENTS'));
  if (!literal || !ts.isArrayLiteralExpression(literal)) {
    throw new Error(`DL_EVENTS array literal not found in ${eventsFile}`);
  }

  const events: DlEventEntry[] = [];
  for (const element of literal.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const entry: Record<string, string | boolean> = {};
    for (const prop of element.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = propertyName(prop);
      if (!key) continue;
      const value = prop.initializer;
      if (ts.isStringLiteralLike(value)) entry[key] = value.text;
      else if (value.kind === ts.SyntaxKind.TrueKeyword) entry[key] = true;
      else if (value.kind === ts.SyntaxKind.FalseKeyword) entry[key] = false;
    }
    if (typeof entry.name !== 'string') continue;
    events.push({
      name: entry.name,
      category: String(entry.category ?? ''),
      hasSchema: entry.hasSchema === true,
      description: String(entry.description ?? ''),
    });
  }
  return events;
}

// ── eventSchemas ────────────────────────────────────────────────────────────

/** A field definition literal, with spreads already merged. */
interface RawFieldDef {
  type: string;
  required: boolean;
  properties?: Map<string, RawFieldDef>;
  itemProperties?: Map<string, RawFieldDef>;
  itemType?: string;
}

/**
 * Merges `{ ...someTable, extra: … }` into one property map. Spread identifiers
 * are resolved against the file's own top-level field tables, which is how the
 * schemas share `productFields` / `ecommerceWithItemsFields` between events.
 */
function fieldMap(
  node: ts.Expression,
  tables: Map<string, ts.ObjectLiteralExpression>,
  depth = 0
): Map<string, RawFieldDef> {
  const out = new Map<string, RawFieldDef>();
  if (depth > 8) return out;
  let literal = unwrap(node);
  // `properties: productFields` names a table instead of inlining it.
  if (literal && ts.isIdentifier(literal)) {
    literal = tables.get(literal.text);
  }
  if (!literal || !ts.isObjectLiteralExpression(literal)) return out;

  for (const prop of literal.properties) {
    if (ts.isSpreadAssignment(prop)) {
      if (!ts.isIdentifier(prop.expression)) continue;
      const table = tables.get(prop.expression.text);
      if (!table) continue;
      for (const [key, value] of fieldMap(table, tables, depth + 1)) {
        out.set(key, value);
      }
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop);
    if (!key) continue;
    out.set(key, fieldDef(prop.initializer, tables, depth + 1));
  }
  return out;
}

function fieldDef(
  node: ts.Expression,
  tables: Map<string, ts.ObjectLiteralExpression>,
  depth: number
): RawFieldDef {
  const literal = unwrap(node);
  const def: RawFieldDef = { type: 'unknown', required: false };
  if (!literal || !ts.isObjectLiteralExpression(literal)) return def;

  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop);
    if (key === 'type') def.type = stringOf(prop.initializer) ?? 'unknown';
    else if (key === 'required')
      def.required = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
    else if (key === 'properties')
      def.properties = fieldMap(prop.initializer, tables, depth);
    else if (key === 'items') {
      const item = fieldDef(prop.initializer, tables, depth);
      def.itemType = item.type;
      if (item.properties) def.itemProperties = item.properties;
    }
  }
  return def;
}

/** Every top-level `const x: Record<string, FieldDefinition> = { … }` in a file. */
function collectFieldTables(
  sf: ts.SourceFile
): Map<string, ts.ObjectLiteralExpression> {
  const tables = new Map<string, ts.ObjectLiteralExpression>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const literal = unwrap(node.initializer);
      if (literal && ts.isObjectLiteralExpression(literal)) {
        tables.set(node.name.text, literal);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return tables;
}

function keySignature(map: Map<string, RawFieldDef>): string {
  return [...map.keys()].sort().join(',');
}

/**
 * Flattens a field map into dotted paths. Expansion stops at a shared table (its
 * fields are documented once, not per event) and at array elements that are the
 * shared item shape.
 */
function flatten(
  map: Map<string, RawFieldDef>,
  prefix: string,
  sharedSignatures: Map<string, SharedShape>,
  out: SchemaField[]
): void {
  for (const [name, def] of map) {
    const path = prefix ? `${prefix}.${name}` : name;

    if (def.type === 'array') {
      const shape = def.itemProperties
        ? sharedSignatures.get(keySignature(def.itemProperties))
        : undefined;
      const type = shape
        ? `${shape}[]`
        : def.itemProperties
          ? 'object[]'
          : `${def.itemType ?? 'unknown'}[]`;
      const field: SchemaField = { path, type, required: def.required };
      if (shape) field.sharedShape = shape;
      out.push(field);
      continue;
    }

    if (def.type === 'object' && def.properties) {
      const shape = sharedSignatures.get(keySignature(def.properties));
      if (shape) {
        out.push({
          path,
          type: shape,
          required: def.required,
          sharedShape: shape,
        });
        continue;
      }
      out.push({ path, type: 'object', required: def.required });
      flatten(def.properties, path, sharedSignatures, out);
      continue;
    }

    out.push({ path, type: def.type, required: def.required });
  }
}

/**
 * Reads `eventSchemas` from `schemas/index.ts`.
 *
 * @returns per-event field lists, plus the two shared field tables
 *   (`UserProperties`, `Product`) that most events reuse verbatim.
 */
export function extractEventSchemas(schemasFile: string): {
  schemas: Record<string, SchemaField[]>;
  shared: Record<SharedShape, SchemaField[]>;
} {
  const sf = parse(schemasFile);
  const tables = collectFieldTables(sf);

  const sharedSources: Array<[SharedShape, string]> = [
    ['UserProperties', 'userPropertiesFields'],
    ['Product', 'productFields'],
  ];
  const shared = {} as Record<SharedShape, SchemaField[]>;
  const sharedSignatures = new Map<string, SharedShape>();
  for (const [shape, tableName] of sharedSources) {
    const table = tables.get(tableName);
    if (!table) throw new Error(`${tableName} not found in ${schemasFile}`);
    const map = fieldMap(table, tables);
    sharedSignatures.set(keySignature(map), shape);
    const fields: SchemaField[] = [];
    flatten(map, '', new Map(), fields);
    shared[shape] = fields;
  }

  const eventSchemas = unwrap(findVariableInitializer(sf, 'eventSchemas'));
  if (!eventSchemas || !ts.isObjectLiteralExpression(eventSchemas)) {
    throw new Error(`eventSchemas object literal not found in ${schemasFile}`);
  }

  const schemas: Record<string, SchemaField[]> = {};
  for (const prop of eventSchemas.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const eventName = propertyName(prop);
    const body = unwrap(prop.initializer);
    if (!eventName || !body || !ts.isObjectLiteralExpression(body)) continue;
    const fieldsProp = body.properties.find(
      p => ts.isPropertyAssignment(p) && propertyName(p) === 'fields'
    );
    if (!fieldsProp || !ts.isPropertyAssignment(fieldsProp)) continue;
    const fields: SchemaField[] = [];
    flatten(
      fieldMap(fieldsProp.initializer, tables),
      '',
      sharedSignatures,
      fields
    );
    schemas[eventName] = fields;
  }

  return { schemas, shared };
}

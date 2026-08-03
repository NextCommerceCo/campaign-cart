/**
 * Reads the analytics source and returns everything about the `dl_*` event
 * vocabulary that a scanner can know for certain: the canonical event list, each
 * event's field schema, where in the source each event is built, and what the
 * provider adapters do with it.
 *
 * Why an extractor rather than a hand-written table: the vocabulary is a literal
 * (`DL_EVENTS`), the field schemas are literals (`eventSchemas`), the provider
 * registry is a literal (`PROVIDER_FACTORIES`), and every adapter's event
 * mapping is a literal. A table copied out of them by hand is a second copy that
 * goes stale — the same failure the analytics manifest gate in
 * `src/tests/utils/analyticsVocabulary.test.ts` exists to prevent. The prose half
 * (what an event means, which providers reshape it, what to do when nothing
 * arrives) is judgement a scanner cannot derive and lives in
 * `src/docs/content/analytics-events.ts`, checked against this extractor in both
 * directions.
 *
 * Build-time only: nothing under `src/` outside `src/docs/` may import this.
 *
 * @internal
 */

import ts from 'typescript';

import { MODULE_SCOPE, enclosingFunction } from './source-anchor';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** One entry of the canonical `DL_EVENTS` vocabulary. */
export interface DlEventEntry {
  name: string;
  category: string;
  /** True when `eventSchemas` defines field-level validation for it. */
  hasSchema: boolean;
  /** The one-line label carried in the vocabulary itself. */
  description: string;
}

/** Names of the field tables that several events share verbatim. */
export type SharedShape = 'UserProperties' | 'Product';

/** One field of an event's payload, as the validation schema declares it. */
export interface SchemaField {
  /** Dotted path from the event root, e.g. `ecommerce.transaction_id`. */
  path: string;
  /** `string` / `number` / `object` / `Product[]` / `object[]` / … */
  type: string;
  /** True when the schema marks it required. */
  required: boolean;
  /**
   * Set when this field's shape is one of the shared tables, which are
   * documented once instead of per event. Expansion stops here.
   */
  sharedShape?: SharedShape;
}

/** Where in the source an event object is constructed. */
export interface EmitSite {
  /** Path relative to `src/`, POSIX separators. */
  file: string;
  /**
   * Enclosing symbol, e.g. `UserEvents.buildSignUp` — empty at module scope.
   * A symbol rather than a line so reformatting the file does not rewrite the
   * published page; see `anchorOf` in `./source-anchor`.
   */
  symbol: string;
  /** The construction call or object property that produced it. */
  how: string;
}

/** One provider the registry knows how to build. */
export interface ProviderRegistryEntry {
  /** The `analytics.providers.<key>` config key. */
  key: string;
  /**
   * Config path the provider refuses to start without, when the registry
   * declares one. `undefined` means the provider needs no settings.
   */
  requiredSetting?: string;
}

/** What each adapter does with the vocabulary, read from its literals. */
export interface ProviderEventMaps {
  /** `dl_*` → Meta Pixel event name. */
  facebook: Record<string, string>;
  /** Meta event names dispatched with `trackCustom` instead of `track`. */
  facebookCustomEvents: string[];
  /** `dl_*` → RudderStack spec event name. */
  rudderstack: Record<string, string>;
  /** `dl_*` names RudderStack handles outside the mapping table. */
  rudderstackSpecialCases: string[];
  /** The only `dl_*` names NextCampaign maps. */
  nextCampaign: string[];
  /** `dl_*` names GTM treats as GA4 ecommerce. */
  gtmEcommerce: string[];
}

/** Everything the analytics source can tell us without human judgement. */
export interface AnalyticsExtract {
  events: DlEventEntry[];
  /** Field schema per event name; absent for events with no schema. */
  schemas: Record<string, SchemaField[]>;
  /** The field tables shared across events, documented once. */
  shared: Record<SharedShape, SchemaField[]>;
  /** Construction sites per event name; `[]` when nothing builds it. */
  emitSites: Record<string, EmitSite[]>;
  providers: ProviderRegistryEntry[];
  providerEventMaps: ProviderEventMaps;
}

// ── AST helpers ─────────────────────────────────────────────────────────────

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

/** The initializer of a top-level `const <name> = …`, anywhere in the file. */
function findVariableInitializer(
  sf: ts.SourceFile,
  name: string
): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      !found &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Unwraps `x as const satisfies T` down to the literal underneath. */
function unwrap(node: ts.Expression | undefined): ts.Expression | undefined {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(prop: ts.ObjectLiteralElementLike): string | undefined {
  if (!prop.name) return undefined;
  return prop.name.getText(prop.getSourceFile()).replace(/^['"`]|['"`]$/g, '');
}

function stringOf(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** `['a', 'b']` → `['a','b']`, ignoring non-literal entries. */
function stringArray(node: ts.Expression | undefined): string[] {
  const literal = unwrap(node);
  if (!literal || !ts.isArrayLiteralExpression(literal)) return [];
  return literal.elements
    .map(el => stringOf(el))
    .filter((s): s is string => s !== undefined);
}

/** `{ a: 'x', b: 'y' }` → `{ a: 'x', b: 'y' }`, ignoring non-string values. */
function stringRecord(node: ts.Expression | undefined): Record<string, string> {
  const literal = unwrap(node);
  const out: Record<string, string> = {};
  if (!literal || !ts.isObjectLiteralExpression(literal)) return out;
  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop);
    const value = stringOf(prop.initializer);
    if (key && value !== undefined) out[key] = value;
  }
  return out;
}

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

// ── emit sites ──────────────────────────────────────────────────────────────

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

// ── providers ───────────────────────────────────────────────────────────────

/** Reads the provider registry and its required-settings table. */
export function extractProviderRegistry(
  analyticsIndexFile: string
): ProviderRegistryEntry[] {
  const sf = parse(analyticsIndexFile);
  const factories = unwrap(findVariableInitializer(sf, 'PROVIDER_FACTORIES'));
  if (!factories || !ts.isObjectLiteralExpression(factories)) {
    throw new Error(`PROVIDER_FACTORIES not found in ${analyticsIndexFile}`);
  }
  const required = stringRecord(
    findVariableInitializer(sf, 'PROVIDER_REQUIRED_SETTINGS')
  );

  const out: ProviderRegistryEntry[] = [];
  for (const prop of factories.properties) {
    const key = propertyName(prop);
    if (!key) continue;
    const entry: ProviderRegistryEntry = { key };
    if (required[key]) entry.requiredSetting = required[key];
    out.push(entry);
  }
  return out;
}

/** The string literals of every `case '…':` inside a named method. */
function switchCaseLiterals(sf: ts.SourceFile, methodName: string): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name?.getText(sf) === methodName
    ) {
      const inner = (child: ts.Node): void => {
        if (ts.isCaseClause(child)) {
          const literal = stringOf(child.expression);
          if (literal) out.push(literal);
        }
        ts.forEachChild(child, inner);
      };
      ts.forEachChild(node, inner);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The initializer of a `const <name> = …` declared inside a named method. */
function localInitializer(
  sf: ts.SourceFile,
  methodName: string,
  variableName: string
): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      !found &&
      ts.isMethodDeclaration(node) &&
      node.name?.getText(sf) === methodName
    ) {
      const inner = (child: ts.Node): void => {
        if (
          !found &&
          ts.isVariableDeclaration(child) &&
          ts.isIdentifier(child.name) &&
          child.name.text === variableName
        ) {
          found = child.initializer;
          return;
        }
        ts.forEachChild(child, inner);
      };
      ts.forEachChild(node, inner);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The initializer of a class property, e.g. `private eventMapping = { … }`. */
function classPropertyInitializer(
  sf: ts.SourceFile,
  propName: string
): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      !found &&
      ts.isPropertyDeclaration(node) &&
      node.name.getText(sf) === propName
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Keeps only the `dl_*` half of a mapping table (adapters also map bare names). */
function dlOnly(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(map).filter(([key]) => key.startsWith('dl_'))
  );
}

/** Reads each adapter's event mapping out of its literals. */
export function extractProviderEventMaps(
  providersDir: string
): ProviderEventMaps {
  const facebook = parse(join(providersDir, 'facebook-adapter.ts'));
  const rudder = parse(join(providersDir, 'rudderstack-adapter.ts'));
  const nextCampaign = parse(join(providersDir, 'next-campaign-adapter.ts'));
  const gtm = parse(join(providersDir, 'gtm-adapter.ts'));

  return {
    facebook: dlOnly(
      stringRecord(classPropertyInitializer(facebook, 'eventMapping'))
    ),
    facebookCustomEvents: stringArray(
      classPropertyInitializer(facebook, 'customEvents')
    ),
    rudderstack: dlOnly(
      stringRecord(localInitializer(rudder, 'mapEventName', 'eventMapping'))
    ),
    // page-view and user-data are handled by dedicated plan builders in
    // `buildPlan`, so they never reach the mapping table.
    rudderstackSpecialCases: switchCaseLiterals(rudder, 'buildPlan').filter(n =>
      n.startsWith('dl_')
    ),
    nextCampaign: switchCaseLiterals(nextCampaign, 'mapEvent').filter(n =>
      n.startsWith('dl_')
    ),
    gtmEcommerce: stringArray(
      localInitializer(gtm, 'isEcommerceEvent', 'ecommerceEvents')
    ).filter(n => n.startsWith('dl_')),
  };
}

/**
 * One call that reads the whole analytics surface.
 *
 * @param srcRoot absolute path to the repo's `src` directory
 */
export function extractAnalytics(srcRoot: string): AnalyticsExtract {
  const analyticsDir = join(srcRoot, 'core', 'analytics');
  const events = extractDlEvents(join(analyticsDir, 'schemas', 'events.ts'));
  const { schemas, shared } = extractEventSchemas(
    join(analyticsDir, 'schemas', 'index.ts')
  );
  const emitSites = extractEmitSites(analyticsDir, srcRoot, [
    join(srcRoot, 'core', 'sdk-initializer.ts'),
  ]);

  return {
    events,
    schemas,
    shared,
    // Every event gets a key, so "nothing builds this" is a fact the docs can
    // assert rather than an absent lookup.
    emitSites: Object.fromEntries(
      events.map(e => [e.name, emitSites[e.name] ?? []])
    ),
    providers: extractProviderRegistry(join(analyticsDir, 'index.ts')),
    providerEventMaps: extractProviderEventMaps(
      join(analyticsDir, 'providers')
    ),
  };
}

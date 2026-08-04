/**
 * Reads the provider registry and, per adapter, what it does with the vocabulary.
 *
 * The adapter file names below are runtime string literals built with `join(…)`, not
 * imports `tsc` can see — this module is checked only by the docs test actually
 * running (`analyticsReference.test.ts`). Renaming or moving
 * `rudderstack-adapter.ts`, `facebook-adapter.ts`, `next-campaign-adapter.ts`, or
 * `gtm-adapter.ts` has to be grepped for as a **string**, not just as an import, or
 * this fails silently until that test runs.
 */

import ts from 'typescript';

import { join } from 'node:path';
import {
  findVariableInitializer,
  parse,
  propertyName,
  stringArray,
  stringOf,
  stringRecord,
  unwrap,
} from './extract-analytics-events-ast-helpers';
import type {
  ProviderEventMaps,
  ProviderRegistryEntry,
} from './extract-analytics-events-types';

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

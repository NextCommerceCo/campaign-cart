/**
 * Reads the two halves of the SDK's scriptable surface straight out of the source:
 * the public members of `NextCommerce` (what a page calls as `next.*`), and every
 * global the SDK plants on `window`.
 *
 * Both exist because the names cannot be written by hand without going stale. A
 * method added to `NextCommerce` and never documented is invisible to a reader —
 * that is how `swapCart`, `getVersion`, `triggerCallback` and four others stayed
 * out of the published API list. A `window.*` install added in a debug panel is
 * worse: it is part of the page's namespace whether or not anyone wrote it down.
 *
 * Signatures and source anchors are read here rather than copied into the companion
 * declaration, so the published table cannot disagree with the code about a type.
 * Prose lives in `src/docs/content/next-methods.ts`; nothing prose-shaped is derived
 * here.
 *
 * @internal
 */

import ts from 'typescript';

import { anchorOf, functionName } from './source-anchor';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** What kind of thing a reader is calling. */
export type MemberKind = 'method' | 'getter' | 'property';

export interface ExtractedMember {
  /** e.g. `getCartTotals`. */
  name: string;
  kind: MemberKind;
  /** True for `NextCommerce.getInstance()` — reached off the class, not `next`. */
  isStatic: boolean;
  /**
   * The call as a reader would write it, e.g.
   * `updateQuantity(options: { packageId?: number; quantity: number }): Promise<void>`.
   * Collapsed to one line so it fits a table cell.
   */
  signature: string;
  /**
   * True when the TSDoc block carries at least one sentence of its own.
   *
   * A block that is only `/** @category Cart *\/` is **false**: it files the member
   * under a heading and tells a reader nothing, so it publishes no documentation.
   * This is the distinction the coverage count turns on.
   */
  hasSummary: boolean;
  /** The `@category` value, or `undefined` when the block has no tag. */
  category?: string;
  /** True when the block carries an `@example`. */
  hasExample: boolean;
  /** True when tagged `@deprecated`. */
  deprecated: boolean;
  /**
   * Symbol to cite as the source, e.g. `NextCommerce.addItem`. Not a line number:
   * a line moves whenever the file is reformatted, which rewrote this page for no
   * behaviour change (see {@link anchorOf}).
   */
  symbol: string;
}

/** One global the SDK assigns to `window`. */
export interface ExtractedGlobal {
  /** The property name, e.g. `nextDebug`. */
  name: string;
  /**
   * Keys of the assigned object literal, `a.b` for one level of nesting.
   * Empty when the value is not an object literal.
   */
  keys: string[];
  /** Every `<path> › <symbol>` that assigns it, source-root-relative, in file order. */
  sites: string[];
}

/** One SDK-namespaced global the SDK *reads* but never assigns. */
export interface ExtractedGlobalRead {
  name: string;
  sites: string[];
}

export interface ExtractedWindowSurface {
  /** Globals the SDK writes. Anything it plants is part of the page's namespace. */
  installs: ExtractedGlobal[];
  /**
   * Globals the SDK reads and never writes, restricted to its own namespace
   * (`next…`, `_next…`, `__NEXT…`, `Next…`). Third-party globals it merely probes
   * for — `fbq`, `rudderanalytics` — belong to those vendors, not to this surface.
   */
  reads: ExtractedGlobalRead[];
}

// ── shared helpers ──────────────────────────────────────────────────────────

/** A multi-line type spread over source lines → one line, for a table cell. */
function oneLine(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .replace(/\s+;/g, ';')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * The TSDoc block immediately above a declaration, as raw text.
 *
 * Read from the comment ranges rather than from `node.jsDoc`, which is not part of
 * the public TypeScript API. A member can be preceded by a section marker
 * (`// Analytics methods (v2 system)`) as well as its block, so the *last* `/**`
 * range wins.
 */
function docBlock(sf: ts.SourceFile, node: ts.Node): string | undefined {
  const ranges = ts.getLeadingCommentRanges(sf.text, node.pos) ?? [];
  const blocks = ranges
    .map(r => sf.text.slice(r.pos, r.end))
    .filter(text => text.startsWith('/**'));
  return blocks.length ? blocks[blocks.length - 1] : undefined;
}

/** `/** … *\/` → the lines inside it, with the leading `*` gutter removed. */
function docLines(block: string): string[] {
  return block
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(l => l.replace(/^\s*\*/, '').trim());
}

// ── NextCommerce members ────────────────────────────────────────────────────

/** Modifier check that treats "no modifier" as public, the way TypeScript does. */
function isPublic(node: ts.ClassElement): boolean {
  const mods = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  return !mods.some(
    m =>
      m.kind === ts.SyntaxKind.PrivateKeyword ||
      m.kind === ts.SyntaxKind.ProtectedKeyword
  );
}

function isStatic(node: ts.ClassElement): boolean {
  const mods = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  return mods.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
}

/**
 * `name(a: A, b?: B): R` — parameters and return type exactly as declared.
 *
 * An unannotated getter (`public get cart() { … }`) has no type to print, so the
 * signature is the bare name: that is also how a reader writes it (`next.cart`).
 */
function signatureOf(
  sf: ts.SourceFile,
  node:
    | ts.MethodDeclaration
    | ts.GetAccessorDeclaration
    | ts.PropertyDeclaration,
  name: string
): string {
  if (ts.isPropertyDeclaration(node)) {
    return node.type ? `${name}: ${oneLine(node.type.getText(sf))}` : name;
  }
  if (ts.isGetAccessor(node)) {
    return node.type ? `${name}: ${oneLine(node.type.getText(sf))}` : name;
  }
  const params = node.parameters.map(p => oneLine(p.getText(sf))).join(', ');
  const ret = node.type ? `: ${oneLine(node.type.getText(sf))}` : '';
  return `${name}(${params})${ret}`;
}

/**
 * Every public member of a class, in source order.
 *
 * @param file absolute path to the file declaring the class
 * @param className e.g. `NextCommerce`
 */
export function extractPublicMembers(
  file: string,
  className: string
): ExtractedMember[] {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  let decl: ts.ClassDeclaration | undefined;
  const findClass = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      decl = node;
      return;
    }
    ts.forEachChild(node, findClass);
  };
  findClass(sf);
  if (!decl) return [];

  const members: ExtractedMember[] = [];

  for (const member of decl.members) {
    if (ts.isConstructorDeclaration(member)) continue;
    if (!isPublic(member)) continue;

    let kind: MemberKind;
    if (ts.isMethodDeclaration(member)) kind = 'method';
    else if (ts.isGetAccessor(member)) kind = 'getter';
    else if (ts.isPropertyDeclaration(member)) kind = 'property';
    else continue; // setters, index signatures, static blocks

    if (!member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;

    const block = docBlock(sf, member);
    let hasSummary = false;
    let category: string | undefined;
    let hasExample = false;
    let deprecated = false;

    if (block) {
      const lines = docLines(block);
      // The summary is everything before the first tag line. A block whose first
      // non-empty line is already a tag documents nothing.
      for (const line of lines) {
        if (line.startsWith('@')) break;
        if (line !== '') hasSummary = true;
      }
      const cat = /@category\s+([^\n*]+)/.exec(block);
      if (cat?.[1]) category = cat[1].trim();
      hasExample = /@example\b/.test(block);
      deprecated = /@deprecated\b/.test(block);
    }

    members.push({
      name,
      kind,
      isStatic: isStatic(member),
      signature: signatureOf(sf, member, name),
      hasSummary,
      ...(category ? { category } : {}),
      hasExample,
      deprecated,
      symbol: functionName(member, sf) ?? name,
    });
  }

  return members;
}

/**
 * Function-typed members of an interface, as call signatures.
 *
 * Used for `CartOperations` — the object behind `next.cart`. Its members are
 * declared as properties holding arrow types, so the state-field extractor skips
 * them by design; they still need documenting, because `next.cart.swapPackage` has
 * no other route into the docs.
 */
export function extractInterfaceCallables(
  file: string,
  interfaceName: string
): Array<{ name: string; signature: string }> {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  let decl: ts.InterfaceDeclaration | undefined;
  const find = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      decl = node;
      return;
    }
    ts.forEachChild(node, find);
  };
  find(sf);
  if (!decl) return [];

  const out: Array<{ name: string; signature: string }> = [];
  for (const member of decl.members) {
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;

    if (ts.isMethodSignature(member)) {
      const params = member.parameters
        .map(p => oneLine(p.getText(sf)))
        .join(', ');
      const ret = member.type ? `: ${oneLine(member.type.getText(sf))}` : '';
      out.push({
        name,
        signature: `${name}(${params})${ret}`,
      });
      continue;
    }
    if (!ts.isPropertySignature(member) || !member.type) continue;
    if (!ts.isFunctionTypeNode(member.type)) continue;

    const params = member.type.parameters
      .map(p => oneLine(p.getText(sf)))
      .join(', ');
    const ret = oneLine(member.type.type.getText(sf));
    out.push({
      name,
      signature: `${name}(${params}): ${ret}`,
    });
  }
  return out;
}

// ── window surface ──────────────────────────────────────────────────────────

/** Strips `( … )`, `… as any`, `<any> …` down to the expression underneath. */
function unwrap(node: ts.Expression): ts.Expression {
  let e = node;
  for (;;) {
    if (ts.isParenthesizedExpression(e)) e = e.expression;
    else if (ts.isAsExpression(e)) e = e.expression;
    else if (ts.isTypeAssertionExpression(e)) e = e.expression;
    else if (ts.isNonNullExpression(e)) e = e.expression;
    else return e;
  }
}

/** True for `window`, `(window as any)`, `(window as unknown as X)`. */
function isWindowRef(node: ts.Expression): boolean {
  const e = unwrap(node);
  return ts.isIdentifier(e) && e.text === 'window';
}

/** Every `.ts` under `dir`, excluding test files and `tests/` folders. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'tests' || entry === '__tests__' || entry === 'guide')
          continue;
        walk(full);
        continue;
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      if (/\.(test|spec)\.ts$/.test(entry)) continue;
      out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Reads the `window.*` surface out of the shipped source.
 *
 * @param srcRoot absolute path to `src/`
 * @param roots folders under `src/` to scan, relative. `src/config.ts` is out of
 *   scope on purpose: nothing imports it, so it is never in the bundle a customer
 *   page loads, and listing `window.nextConfig` as something the SDK *installs*
 *   would invert the truth — the loader sets it and the SDK reads it.
 */
export function extractWindowSurface(
  srcRoot: string,
  roots: string[] = ['core', 'features']
): ExtractedWindowSurface {
  const installs = new Map<string, ExtractedGlobal>();
  const reads = new Map<string, ExtractedGlobalRead>();

  for (const root of roots) {
    for (const file of sourceFiles(join(srcRoot, root))) {
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      const cited = relative(srcRoot, file).replace(/\\/g, '/');
      const where = (node: ts.Node): string => anchorOf(sf, node, cited);

      const visit = (node: ts.Node): void => {
        // window.X = …  /  (window as any).X = …
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(node.left) &&
          isWindowRef(node.left.expression)
        ) {
          const name = node.left.name.text;
          const entry = installs.get(name) ?? { name, keys: [], sites: [] };
          const site = where(node);
          if (!entry.sites.includes(site)) entry.sites.push(site);

          // `window.nextDebug = { … }` — the keys *are* the surface, and there
          // are two assignments to merge (boot, then the debug overlay).
          const rhs = unwrap(node.right);
          if (ts.isObjectLiteralExpression(rhs)) {
            for (const prop of rhs.properties) {
              if (!prop.name || !ts.isIdentifier(prop.name)) continue;
              const key = prop.name.text;
              if (!entry.keys.includes(key)) entry.keys.push(key);
              const value = ts.isPropertyAssignment(prop)
                ? unwrap(prop.initializer)
                : undefined;
              if (value && ts.isObjectLiteralExpression(value)) {
                for (const sub of value.properties) {
                  if (!sub.name || !ts.isIdentifier(sub.name)) continue;
                  const path = `${key}.${sub.name.text}`;
                  if (!entry.keys.includes(path)) entry.keys.push(path);
                }
              }
            }
          }
          installs.set(name, entry);
        }

        // A read: window.X used anywhere that is not the target of `=`.
        if (
          ts.isPropertyAccessExpression(node) &&
          isWindowRef(node.expression) &&
          !(
            node.parent &&
            ts.isBinaryExpression(node.parent) &&
            node.parent.left === node &&
            node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
          )
        ) {
          const name = node.name.text;
          if (/^(next|_next|__NEXT|Next)/.test(name)) {
            const entry = reads.get(name) ?? { name, sites: [] };
            const site = where(node);
            if (!entry.sites.includes(site)) entry.sites.push(site);
            reads.set(name, entry);
          }
        }

        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }

  // Something the SDK both writes and reads is an install, not a read.
  for (const name of installs.keys()) reads.delete(name);

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name);

  return {
    installs: [...installs.values()].sort(byName),
    reads: [...reads.values()].sort(byName),
  };
}

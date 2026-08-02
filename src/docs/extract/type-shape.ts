/**
 * Answers one question about the SDK's declared types: **does this dotted path
 * name a field that really exists on this shape?**
 *
 * Three of the five routed `data-next-display` namespaces do not resolve every
 * path with a `case`. They fall through to
 * `PropertyResolver.getNestedProperty(someObject, path)`, which reads whatever the
 * path names off runtime data — so `package.price_retail_total` is answered not by
 * a branch anyone wrote for it but by `Package` having that field. A gate that only
 * counted `case` labels would report fifteen live `package.` paths as dead.
 *
 * The alternative to reading the declarations was a hand-kept allowlist of "paths
 * the fallback answers", which is the same unchecked list that put four fictional
 * properties on `bundle-selector`'s page (finding 109 in `docs/code-findings.md`).
 * A declared interface is checkable; a list is not.
 *
 * **What it proves, and what it does not.** It proves the *contract* declares the
 * field. It cannot prove the API sends it: an endpoint may return more than the
 * interface admits, so "not declared" means "not promised by the SDK's own types",
 * which is the strongest statement a documentation page should make anyway.
 *
 * Interfaces only — no type checker, no program. That keeps this a file read rather
 * than a compile, and every shape a display fallback reads is a plain `interface`.
 *
 * Build-time only: lives under `src/docs/` and depends on the TypeScript compiler,
 * so it never reaches the bundle.
 */

import ts from 'typescript';

/** One declared object type: its own fields, plus whatever it inherits. */
export interface DeclaredShape {
  /** Field name → the named type of that field, when it has one. */
  fields: Map<string, string | undefined>;
  /** Names of the interfaces it extends, resolved lazily so order does not matter. */
  extends: string[];
  /** True when the shape has an index signature, so any name is a member. */
  open: boolean;
  /** `types/api.ts › Order` — where a failure should send the reader. */
  where: string;
}

/** The named type a member declaration resolves to, for walking a nested path. */
function namedTypeOf(node: ts.TypeNode | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isArrayTypeNode(node)) return namedTypeOf(node.elementType);
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName;
    return ts.isIdentifier(name) ? name.text : undefined;
  }
  if (ts.isUnionTypeNode(node)) {
    // `Order | null` — the null half carries no fields, so the named half wins.
    for (const member of node.types) {
      const found = namedTypeOf(member);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Every interface (and object-literal type alias) declared in `files`, by name.
 *
 * @param files `[fileName, sourceText]` pairs, the same shape the other extractors
 *   take. The file name is what a failure cites.
 */
export function readDeclaredShapes(
  files: Array<[string, string]>
): Map<string, DeclaredShape> {
  const shapes = new Map<string, DeclaredShape>();

  const record = (
    name: string,
    members: ts.NodeArray<ts.TypeElement>,
    heritage: string[],
    sf: ts.SourceFile,
    file: string
  ): void => {
    const fields = new Map<string, string | undefined>();
    let open = false;
    for (const member of members) {
      if (ts.isIndexSignatureDeclaration(member)) {
        open = true;
        continue;
      }
      if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
        continue;
      }
      const key = member.name?.getText(sf).replace(/^['"]|['"]$/g, '');
      if (!key) continue;
      fields.set(
        key,
        ts.isPropertySignature(member) ? namedTypeOf(member.type) : undefined
      );
    }
    shapes.set(name, {
      fields,
      extends: heritage,
      open,
      where: `${file} › ${name}`,
    });
  };

  for (const [file, text] of files) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node)) {
        const heritage = (node.heritageClauses ?? [])
          .flatMap(clause => clause.types)
          .map(t => (ts.isIdentifier(t.expression) ? t.expression.text : ''))
          .filter(Boolean);
        record(node.name.text, node.members, heritage, sf, file);
      }
      if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
        record(node.name.text, node.type.members, [], sf, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return shapes;
}

/** A shape's own fields plus every inherited one, with cycles guarded. */
function fieldsOf(
  shapes: Map<string, DeclaredShape>,
  name: string,
  seen = new Set<string>()
): Map<string, string | undefined> | undefined {
  if (seen.has(name)) return new Map();
  seen.add(name);
  const shape = shapes.get(name);
  if (!shape) return undefined;
  const fields = new Map(shape.fields);
  for (const parent of shape.extends) {
    for (const [key, type] of fieldsOf(shapes, parent, seen) ?? []) {
      if (!fields.has(key)) fields.set(key, type);
    }
  }
  return fields;
}

/**
 * Whether `path` names a declared field of `shapeName`, walking dots.
 *
 * Throws when the shape itself is unknown, because "the type this fallback reads
 * cannot be found" is a broken claim rather than a missing field — silently
 * answering `false` would report every path on the namespace as dead.
 *
 * @example
 * ```ts
 * declaresPath(shapes, 'Package', 'price_retail_total'); // → true
 * declaresPath(shapes, 'Order', 'status');               // → false
 * ```
 */
export function declaresPath(
  shapes: Map<string, DeclaredShape>,
  shapeName: string,
  path: string
): boolean {
  let current: string | undefined = shapeName;
  const segments = path.split('.');

  for (const [index, segment] of segments.entries()) {
    if (current === undefined) return false;
    const shape = shapes.get(current);
    if (!shape) {
      if (index === 0) {
        throw new Error(
          `No interface named \`${shapeName}\` was found, so nothing can be ` +
            'proved about the paths its display fallback answers. Either the type ' +
            'was renamed, or it lives outside the files the shape reader was given.'
        );
      }
      // A nested type outside the search set — cannot prove the field either way,
      // so treat the path as unproven rather than pretending it resolves.
      return false;
    }
    if (shape.open) return true;
    const fields = fieldsOf(shapes, current);
    if (!fields?.has(segment)) return false;
    current = fields.get(segment);
  }

  return true;
}

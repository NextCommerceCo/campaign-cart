/**
 * Reads the TSDoc off `EventMap` in `src/types/global.ts` and returns it as
 * structured event docs.
 *
 * `EventMap` is the one place events are declared, so it is also the one place
 * they are described — the feature guides' `reference/events.md` is generated
 * from this, and TypeDoc renders the same comments into the SDK reference. Adding
 * a second file of event prose would guarantee drift.
 *
 * Build-time only: lives under `src/tests/` and depends on the TypeScript
 * compiler, so it never reaches the bundle.
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { EventDoc } from '@/core/docs/render-feature-reference';

/**
 * The display text of one `{@link}` / `{@linkcode}` / `{@linkplain}` part.
 *
 * TypeScript splits the tag into `name` (the symbol, or a URL's scheme) and
 * `text` (everything after it), so the three authoring forms arrive as:
 *
 * | Written                       | `name`  | `text`                    |
 * |-------------------------------|---------|---------------------------|
 * | `{@link Foo}`                 | `Foo`   | `''`                      |
 * | `{@link Foo \| a label}`      | `Foo`   | `'\| a label'`            |
 * | `{@link Foo A Label}`         | `Foo`   | `'A Label'`               |
 * | `{@link https://x \| Label}`  | `https` | `'://x \| Label'`         |
 *
 * Reading `text` alone — as this file used to — dropped the symbol name
 * entirely and left the separating `|` behind, which also breaks the markdown
 * table row the text ends up in.
 */
function linkTextOf(
  link: ts.JSDocLink | ts.JSDocLinkCode | ts.JSDocLinkPlain,
  sf: ts.SourceFile
): string {
  const target = link.name?.getText(sf) ?? '';
  const rest = link.text;
  // A URL has no symbol: `name` holds only its scheme, so the two rejoin.
  const isUrl = rest.startsWith('://');
  const pipe = rest.indexOf('|');
  const beforePipe = pipe >= 0 ? rest.slice(0, pipe) : rest;
  const label = (pipe >= 0 ? rest.slice(pipe + 1) : isUrl ? '' : rest).trim();
  if (label.length > 0) return label;
  return isUrl ? target + beforePipe.trim() : target;
}

/** One JSDoc comment — a plain string, or text interleaved with link tags. */
function commentTextOf(
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
  sf: ts.SourceFile
): string {
  if (typeof comment === 'string') return comment;
  if (comment === undefined) return '';
  return comment
    .map(part =>
      ts.isJSDocLink(part) ||
      ts.isJSDocLinkCode(part) ||
      ts.isJSDocLinkPlain(part)
        ? linkTextOf(part, sf)
        : (part.text ?? '')
    )
    .join('');
}

/** The TSDoc summary text of a node, with `@tag` blocks excluded. */
function summaryOf(node: ts.Node, sf: ts.SourceFile): string | undefined {
  const parts: string[] = [];
  for (const doc of ts.getJSDocCommentsAndTags(node)) {
    // getJSDocCommentsAndTags returns JSDoc blocks *and* loose tags; a tag's own
    // comment belongs to the tag, not to the summary.
    if (!ts.isJSDoc(doc)) continue;
    parts.push(commentTextOf(doc.comment, sf));
  }
  const text = parts.join(' ').replace(/\s*\n\s*/g, ' ').trim();
  return text.length > 0 ? text : undefined;
}

/** The body of the first `@example` tag, with any code fence stripped. */
function exampleOf(node: ts.Node, sf: ts.SourceFile): string | undefined {
  for (const tag of ts.getJSDocTags(node)) {
    if (tag.tagName.text !== 'example') continue;
    const comment = commentTextOf(tag.comment, sf);
    const fenced = comment.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = (fenced ? fenced[1] : comment).trim();
    if (body.length > 0) return body;
  }
  return undefined;
}

/** Payload fields, when the payload is written inline as a type literal. */
function fieldsOf(
  type: ts.TypeNode | undefined,
  sf: ts.SourceFile
): EventDoc['fields'] {
  if (!type || !ts.isTypeLiteralNode(type)) return undefined;
  const fields = type.members
    .filter(ts.isPropertySignature)
    .map(member => {
      const optional = member.questionToken !== undefined;
      return {
        name: member.name.getText(sf) + (optional ? '?' : ''),
        type: member.type?.getText(sf).replace(/\s+/g, ' ') ?? 'unknown',
        description: summaryOf(member, sf) ?? '',
      };
    });
  return fields.length > 0 ? fields : undefined;
}

export function extractEventDocs(globalTsPath: string): Record<string, EventDoc> {
  const text = readFileSync(globalTsPath, 'utf8');
  const sf = ts.createSourceFile(
    globalTsPath,
    text,
    ts.ScriptTarget.Latest,
    true
  );

  const docs: Record<string, EventDoc> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'EventMap') {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.name) continue;
        const name = member.name.getText(sf).replace(/^['"]|['"]$/g, '');
        docs[name] = {
          when: summaryOf(member, sf),
          fields: fieldsOf(member.type, sf),
          example: exampleOf(member, sf),
        };
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return docs;
}

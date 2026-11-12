import type { Render } from '../dom/context';
import { matching } from '../dom/dom';
import { FIELDS, type ModelType } from '../engine/display/query';
import type { AttributeContext } from './context';
import { parseExpression, pathsOf, valueOf } from './expression';
import { fieldType } from './value';

const DEFINE = 'data-next-define';
const TYPES = Object.keys(FIELDS) as ModelType[];

/** The format a sum is written in when its element names none: its first path's, as `data-next-query` writes a sum. */
function formatOf(path: string | undefined): string | undefined {
  const type = fieldType(path?.split('.').pop() ?? '', 0);
  return type === 'money' ? 'currency' : type === 'percent' ? 'percentage' : undefined;
}

/**
 * `data-next-define="Cart.left = 75 - total"`: a field on every object of a type, as
 * `next.define` adds one. Its sum reads short paths from that object.
 */
export function bindDefine(root: ParentNode, a: AttributeContext): Render[] {
  for (const el of matching(root, `[${DEFINE}]`)) {
    if (!a.b.claim(el, DEFINE)) continue;
    const [, object, name, source] = /^\s*(\w+)\.(\w+)\s*=(?!=)(.+)$/s.exec(el.getAttribute(DEFINE) ?? '') ?? [];
    const type = TYPES.find((t) => t.toLowerCase() === object?.toLowerCase());
    const sum = source ? parseExpression(source) : null;
    if (!type || !name || !sum) {
      a.warn(el, DEFINE, object && !type ? `unknown type "${object}"` : 'cannot read the definition');
      continue;
    }
    const format = el.getAttribute('data-next-format') ?? formatOf(pathsOf(sum)[0]);
    a.query.define(type, name, (o: unknown) => valueOf(sum, (path) => a.query.get(path, o)), { format });
  }
  return [];
}

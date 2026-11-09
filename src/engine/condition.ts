import { truthy, type Value } from './format';

export type CompareOp = '==' | '!=' | '>' | '<' | '>=' | '<=';

export type Condition =
  { kind: 'path'; path: string; negate: boolean } | { kind: 'compare'; path: string; op: '==' | '!='; literal: string };

const COMPARE = /^([\w.]+?)(?:\(\))?\s*(==|!=)\s*(['"]?)(.*?)\3$/;
const PATH = /^(!?)\s*([\w.]+?)(?:\(\))?$/;

export function parseCondition(source: string): Condition | null {
  const text = source.trim();
  const compare = COMPARE.exec(text);
  if (compare) return { kind: 'compare', path: compare[1]!, op: compare[2] as '==' | '!=', literal: compare[4]! };
  const path = PATH.exec(text);
  if (path) return { kind: 'path', path: path[2]!, negate: path[1] === '!' };
  return null;
}

/** What `==`, `!=`, `>`, `<`, `>=` and `<=` mean in every condition: equal as text, ordered as numbers (a missing value is never ordered). */
export function compare(op: CompareOp, a: unknown, b: unknown): boolean {
  if (op === '==' || op === '!=') return (String(a ?? '') === String(b ?? '')) === (op === '==');
  const x = Number(a);
  const y = Number(b);
  if (a == null || Number.isNaN(x) || Number.isNaN(y)) return false;
  return op === '>' ? x > y : op === '<' ? x < y : op === '>=' ? x >= y : x <= y;
}

export const conditionMet = (condition: Condition, v: Value) =>
  condition.kind === 'compare' ? compare(condition.op, v.value, condition.literal) : truthy(v) !== condition.negate;

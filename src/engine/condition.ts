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

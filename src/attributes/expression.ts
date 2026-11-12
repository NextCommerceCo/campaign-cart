import { compare, type CompareOp } from '../engine/display/condition';
import { truthyValue } from '../engine/display/format';

export type MathOp = '+' | '-' | '*' | '/';

/**
 * A `data-next-show` condition or a `data-next-query` sum, parsed once: paths, literals, `!`,
 * `* /` before `+ -`, `== != > < >= <=`, `&&`, `||`, parentheses. After `==` and `!=` a bare word
 * is text (`param.banner == off`), as in 0.4.x. `-` between spaces subtracts; inside a path it is
 * part of an id (`options.bundle-1x`).
 */
export type Expression =
  | { kind: 'path'; path: string }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'not'; operand: Expression }
  | { kind: 'math'; op: MathOp; left: Expression; right: Expression }
  | { kind: 'compare'; op: CompareOp; left: Expression; right: Expression }
  | { kind: 'and' | 'or'; left: Expression; right: Expression };

const LEXEME =
  /\s*(\|\||&&|==|!=|>=|<=|[!<>()]|'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?(?![\w.])|[A-Za-z_][\w.-]*|[\w.]+|[-+*/])/y;

function tokenize(source: string): string[] | null {
  const tokens: string[] = [];
  LEXEME.lastIndex = 0;
  let index = 0;
  while (index < source.length) {
    if (!source.slice(index).trim()) break;
    LEXEME.lastIndex = index;
    const m = LEXEME.exec(source);
    if (!m) return null;
    tokens.push(m[1]!);
    index = LEXEME.lastIndex;
  }
  return tokens;
}

const COMPARE = new Set(['==', '!=', '>', '<', '>=', '<=']);

/** Parses a condition, or `null` when it cannot be read. `path()` reads as `path`. */
export function parseExpression(source: string): Expression | null {
  const tokens = tokenize(source.replace(/\(\)/g, ''));
  if (!tokens?.length) return null;
  let at = 0;
  const peek = () => tokens[at];

  const operand = (): Expression | null => {
    const t = tokens[at++];
    if (t === undefined) return null;
    if (t === '!') {
      const inner = operand();
      return inner && { kind: 'not', operand: inner };
    }
    if (t === '(') {
      const inner = or();
      return tokens[at++] === ')' ? inner : null;
    }
    if (/^['"]/.test(t)) return { kind: 'literal', value: t.slice(1, -1) };
    if (/^-?\d/.test(t)) return { kind: 'literal', value: Number(t) };
    if (t === 'true' || t === 'false') return { kind: 'literal', value: t === 'true' };
    if (/^[\w.-]+$/.test(t)) return { kind: 'path', path: t };
    return null;
  };
  const math = (next: () => Expression | null, ops: string) => (): Expression | null => {
    let left = next();
    while (left && ops.includes(peek() ?? ' ')) {
      const op = tokens[at++] as MathOp;
      const right = next();
      left = right && { kind: 'math', op, left, right };
    }
    return left;
  };
  const sum = math(math(operand, '*/'), '+-');
  const compare = (): Expression | null => {
    const left = sum();
    const op = peek();
    if (!left || !op || !COMPARE.has(op)) return left;
    at++;
    const next = tokens[at];
    const bare = (op === '==' || op === '!=') && next !== undefined && /^[A-Za-z_][\w-]*$/.test(next);
    const right =
      bare && !['true', 'false'].includes(next!) ? (at++, { kind: 'literal' as const, value: next! }) : sum();
    return right && { kind: 'compare', op: op as CompareOp, left, right };
  };
  const and = (): Expression | null => {
    let left = compare();
    while (left && peek() === '&&') {
      at++;
      const right = compare();
      left = right && { kind: 'and', left, right };
    }
    return left;
  };
  const or = (): Expression | null => {
    let left = and();
    while (left && peek() === '||') {
      at++;
      const right = and();
      left = right && { kind: 'or', left, right };
    }
    return left;
  };
  const result = or();
  return result && at === tokens.length ? result : null;
}

/** The paths an expression reads. */
export function pathsOf(e: Expression): string[] {
  switch (e.kind) {
    case 'path':
      return [e.path];
    case 'literal':
      return [];
    case 'not':
      return pathsOf(e.operand);
    default:
      return [...pathsOf(e.left), ...pathsOf(e.right)];
  }
}

/** `l op r` for two numbers; nothing when either is not known yet, or for a division by 0. */
function calculate(op: MathOp, l: unknown, r: unknown): number | undefined {
  if (typeof l !== 'number' || typeof r !== 'number') return undefined;
  const n = op === '+' ? l + r : op === '-' ? l - r : op === '*' ? l * r : l / r;
  return Number.isFinite(n) ? n : undefined;
}

/** What the expression comes to: a path's value, a sum's number, a condition's yes or no. */
export function valueOf(e: Expression, read: (path: string) => unknown): unknown {
  switch (e.kind) {
    case 'path':
      return read(e.path);
    case 'literal':
      return e.value;
    case 'math':
      return calculate(e.op, valueOf(e.left, read), valueOf(e.right, read));
    default:
      return evaluate(e, read);
  }
}

/** Whether the condition holds, reading each path with `read`. */
export function evaluate(e: Expression, read: (path: string) => unknown): boolean {
  switch (e.kind) {
    case 'path':
      return truthyValue(read(e.path));
    case 'literal':
      return truthyValue(e.value);
    case 'not':
      return !evaluate(e.operand, read);
    case 'math':
      return truthyValue(valueOf(e, read));
    case 'compare':
      return compare(e.op, valueOf(e.left, read), valueOf(e.right, read));
    case 'and':
      return evaluate(e.left, read) && evaluate(e.right, read);
    case 'or':
      return evaluate(e.left, read) || evaluate(e.right, read);
  }
}

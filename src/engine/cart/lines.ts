import type { Line, CartGroup, CartLine, CartState } from './types';

type Groups = Record<string, CartGroup>;

const TOGGLE = 'toggle:';

export const toggleGroup = (packageId: number) => TOGGLE + packageId;

export const lineKey = (l: CartLine) =>
  `${l.packageId}|${l.isUpsell ? 1 : 0}|${JSON.stringify(Object.entries(l.properties ?? {}).sort())}`;

export const apiLines = (lines: CartLine[]) => mergeLines({ lines: { lines, vouchers: [] } });

export function mergeLines(groups: Record<string, CartGroup>): Line[] {
  const merged = new Map<string, Line>();
  for (const group of Object.values(groups)) {
    for (const line of group.lines) {
      const key = lineKey(line);
      const existing = merged.get(key);
      if (existing) existing.quantity += line.quantity;
      else
        merged.set(key, {
          package_id: line.packageId,
          quantity: line.quantity,
          ...(line.isUpsell && { is_upsell: true }),
          ...(line.properties && Object.keys(line.properties).length && { properties: line.properties }),
        });
    }
  }
  return [...merged.values()].filter((l) => l.quantity > 0);
}

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export const quantities = (groups: Record<string, CartGroup>) => {
  const by = new Map<number, number>();
  for (const l of mergeLines(groups)) by.set(l.package_id, (by.get(l.package_id) ?? 0) + l.quantity);
  return by;
};

export const toggleOn = (groups: Record<string, CartGroup>, id: string) =>
  id.startsWith(TOGGLE) && !!groups[id]?.lines.some((l) => l.quantity > 0);

/** Every code on the cart: the shopper's and each group's own. */
export const vouchersOf = ({ coupons, groups }: CartState) => {
  const all = new Set(coupons);
  for (const group of Object.values(groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
  return [...all];
};

/**
 * `groups` with `quantity` of the package in all: more goes to the first group that has it (else `items`), less
 * comes off the last lines first. `undefined` when it already has that many.
 */
export function withQuantity(groups: Groups, packageId: number, quantity: number): Groups | undefined {
  const total = mergeLines(groups).reduce((n, l) => n + (l.package_id === packageId ? l.quantity : 0), 0);
  let delta = Math.max(0, quantity) - total;
  if (!delta) return undefined;
  const copy = Object.fromEntries(
    Object.entries(groups).map(([id, g]) => [id, { ...g, lines: g.lines.map((l) => ({ ...l })) }]),
  );
  if (delta > 0) {
    const id = ['items', ...Object.keys(copy)].find((g) => copy[g]?.lines.some((l) => l.packageId === packageId));
    const group = (copy[id ?? 'items'] ??= { lines: [], vouchers: [] });
    const line = group.lines.find((l) => l.packageId === packageId);
    if (line) line.quantity += delta;
    else group.lines.push({ packageId, quantity: delta });
  } else {
    for (const group of Object.values(copy).reverse()) {
      for (const line of [...group.lines].reverse()) {
        if (line.packageId !== packageId || !delta) continue;
        const take = Math.min(line.quantity, -delta);
        line.quantity -= take;
        delta += take;
      }
    }
  }
  for (const [id, group] of Object.entries(copy)) {
    group.lines = group.lines.filter((l) => l.quantity > 0);
    if (!group.lines.length) delete copy[id];
  }
  return copy;
}

/** `group` with `quantity` more of the package, on its line when it has one. */
export const withItem = (group: CartGroup, packageId: number, quantity: number): CartGroup => ({
  ...group,
  lines: group.lines.some((l) => l.packageId === packageId)
    ? group.lines.map((l) => (l.packageId === packageId ? { ...l, quantity: l.quantity + quantity } : l))
    : [...group.lines, { packageId, quantity }],
});

/** `groups` without the lines `known` refuses, and those lines; the same object when it refuses none. */
export function knownOnly(groups: Groups, known: (l: CartLine) => boolean): [Groups, CartLine[]] {
  const unknown = Object.values(groups).flatMap((g) => g.lines.filter((l) => !known(l)));
  if (!unknown.length) return [groups, unknown];
  const kept = Object.entries(groups)
    .map(([id, g]) => [id, { ...g, lines: g.lines.filter(known) }] as const)
    .filter(([, g]) => g.lines.length);
  return [Object.fromEntries(kept), unknown];
}

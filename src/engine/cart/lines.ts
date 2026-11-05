import type { Line, CartGroup, CartLine } from './types';

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

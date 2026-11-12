import type { Engine } from '../engine';
import { cardSlots } from './selectors';
import type { SelectorCard } from './types';

export type PackageFor = (current: number) => number | undefined;

/** A slot of a card takes the variant's package. */
export async function slotVariant(
  engine: Engine,
  selectorId: string,
  card: SelectorCard,
  index: number,
  packageFor: PackageFor,
): Promise<boolean> {
  const slot = cardSlots(engine.selectors.get(selectorId)!, card)[index];
  const packageId = slot && packageFor(slot.packageId);
  if (!packageId) return false;
  await engine.selectors.setSlot(selectorId, card.id, index, { packageId });
  return true;
}

/** A card of one line takes the variant's package, and is picked. */
export async function cardVariant(
  engine: Engine,
  selectorId: string,
  card: SelectorCard,
  packageFor: PackageFor,
): Promise<boolean> {
  const selector = engine.selectors.get(selectorId)!;
  const [line, ...others] = card.lines;
  const packageId = line && !others.length && packageFor(line.packageId);
  if (!packageId) return false;
  const cards = selector.cards.map((c) => (c === card ? { ...c, lines: [{ ...line, packageId }] } : c));
  await engine.selectors.register(selectorId, cards, selector.mode);
  if (selector.picked !== card.id) await engine.selectors.pick(selectorId, card.id);
  return true;
}

/** The cart's own line of package `current` takes the variant's package. */
export async function lineVariant(
  engine: Engine,
  current: number | undefined,
  packageFor: PackageFor,
): Promise<boolean> {
  const items = engine.cart.group('items');
  const own = items?.lines.find((l) => l.packageId === current);
  const packageId = current && packageFor(current);
  if (!items || !own || !packageId) return false;
  await engine.cart.setGroup('items', {
    ...items,
    lines: items.lines.map((l) => (l === own ? { ...l, packageId } : l)),
  });
  return true;
}

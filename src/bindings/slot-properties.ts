import { cardSlots, pickedCard } from '../engine/cart/selectors';
import type { SelectorCard } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import { ownProperties, pageProperties } from './cards';

/**
 * The line properties of a bundle selector's units: the page's `data-next-default-property` inputs,
 * then a unit's own `data-next-property` inputs. `shown` is the picked card's unit drawn at an index.
 */
export function slotProperties(
  engine: Engine,
  selectorId: string,
  cards: Map<string, Element>,
  shown: (index: number) => Element | undefined,
) {
  const defaults = document.querySelectorAll('[data-next-default-property]');
  const names = [...defaults].map((input) => input.getAttribute('data-next-default-property'));
  const of = (card: SelectorCard, el: Element) => ({ ...pageProperties(cards.get(card.id)), ...ownProperties(el) });

  /** The defaults on every unit of every card, so a card picked later carries them without a second pricing. */
  const sync = () => {
    const selector = engine.selectors.get(selectorId);
    if (!selector) return;
    const picked = pickedCard(selector);
    for (const card of selector.cards) {
      cardSlots(selector, card).forEach((slot, index) => {
        const el = card.id === picked?.id ? shown(index) : undefined;
        const own = el
          ? ownProperties(el)
          : Object.fromEntries(Object.entries(slot.properties ?? {}).filter(([name]) => !names.includes(name)));
        const properties = { ...pageProperties(cards.get(card.id)), ...own };
        if (slot.properties || Object.keys(properties).length)
          void engine.selectors.setSlot(selectorId, card.id, index, { properties });
      });
    }
  };
  return { defaults, of, sync };
}

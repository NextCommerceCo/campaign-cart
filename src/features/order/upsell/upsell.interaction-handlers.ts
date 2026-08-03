/**
 * Interaction wiring for the post-purchase upsell.
 *
 * Everything here is bound to the DOM once, during `initialize`, and then runs
 * later — on a click or on an event-bus message. So each function reads
 * `ctx.state` **live** rather than taking a snapshot: the selected option and
 * the quantity it needs are whatever the shopper has since chosen, not what was
 * on the page when the listener was attached.
 *
 * The order-submission half — `addUpsellToOrder`, `skipUpsell`,
 * `handleActionClick`, `trackUpsellPageView` — lives in
 * [`upsell.handlers.ts`](./upsell.handlers.ts). Split because the two halves
 * answer different questions ("what did the shopper pick" vs "put it on the
 * order") and one file of both was 646 lines.
 */

import type { EventMap } from '@/types/global';
import {
  renderQuantityDisplay,
  renderQuantityToggles,
  syncOptionSelectionAcrossContainers,
  syncQuantityAcrossContainers,
} from './upsell.renderer';
import type {
  UpsellHandlerContext,
  UpsellInteractionContext,
  UpsellState,
} from './upsell.types';
import { handleActionClick } from './upsell.handlers';

/**
 * Which selector id the offer's quantity is addressed by: the one a `+`/`-`
 * control named, else the container's own `data-next-selector-id`. It decides
 * which elements a repaint writes to — the number itself is always
 * `state.quantity`.
 */
export function quantityKey(state: UpsellState): string | undefined {
  return state.currentQuantitySelectorId ?? state.selectorId;
}

/**
 * The selector-keyed view of `state.quantity` that the renderers and the
 * order-submission handlers take. Built on read and discarded, so it cannot
 * drift from `state.quantity` the way a stored map did.
 *
 * @example
 * quantitySnapshot({ quantity: 3, selectorId: 'protection', ... });
 * // Map { 'protection' => 3 }
 */
export function quantitySnapshot(state: UpsellState): Map<string, number> {
  const key = quantityKey(state);
  const snapshot = new Map<string, number>();
  if (key) snapshot.set(key, state.quantity);
  return snapshot;
}

/** Repaints every quantity widget in this container from `state.quantity`. */
function renderQuantity(ctx: UpsellInteractionContext): void {
  const { element, state } = ctx;
  renderQuantityDisplay(
    element,
    quantityKey(state),
    quantitySnapshot(state),
    state.quantity
  );
  renderQuantityToggles(element, state.quantity);
}

/**
 * The one place the offer's quantity is written after initialize: clamps it to
 * 1–10, records which selector the change came from, announces it, then repaints
 * the display, the fixed-quantity toggles, and the same offer wherever else it
 * appears on the page.
 *
 * Every input path goes through here — the `+`/`-` buttons, the
 * `data-next-upsell-quantity-toggle` buttons, and a change announced by another
 * container — so the number that gets submitted is the number on screen.
 *
 * @example
 * setQuantity(ctx, 3); // three units, keyed by the container's selector
 * setQuantity(ctx, 3, 'protection'); // three units, keyed by 'protection'
 */
export function setQuantity(
  ctx: UpsellInteractionContext,
  quantity: number,
  qtySelectorId?: string
): void {
  const { state } = ctx;
  state.quantity = Math.min(10, Math.max(1, quantity));
  if (qtySelectorId) state.currentQuantitySelectorId = qtySelectorId;

  const key = qtySelectorId ?? state.selectorId;
  ctx.emit('upsell:quantity-changed', {
    ...(key ? { selectorId: key } : {}),
    quantity: state.quantity,
    packageId: state.packageId,
  });

  // Repaint after the emit: the bus is synchronous, so every other container
  // showing this offer has already reacted.
  renderQuantity(ctx);
  syncQuantityAcrossContainers(
    quantityKey(state),
    state.packageId,
    quantitySnapshot(state),
    state.quantity
  );
}

/**
 * `addEventListener` that records how to take the listener back.
 *
 * Every listener this module puts on author DOM goes through here, and the caller
 * chooses which array on {@link UpsellState} records the undo — which is the same
 * choice as "how long should this live":
 *
 * - `state.scanTeardowns` for anything a scan attaches. {@link scanUpsellElements}
 *   empties that array and re-runs it on every `update()`.
 * - `state.selectorTeardowns` for the option cards and the dropdown, which are wired
 *   once at initialize and must survive every later scan.
 *
 * Putting the second group in the first array is the trap this split exists to
 * prevent: the next scan would have removed the option listeners and never re-added
 * them, so the offer would stop responding to clicks after its first update.
 */
function bind(
  teardowns: (() => void)[],
  target: Element | null,
  type: string,
  listener: EventListener
): void {
  if (!target) return;
  target.addEventListener(type, listener);
  teardowns.push(() => target.removeEventListener(type, listener));
}

/**
 * Wires selector mode: option cards and/or a `<select>` dropdown, plus any
 * option already marked `data-next-selected="true"`.
 *
 * The card and dropdown listeners are recorded in `state.selectorTeardowns` so the
 * enhancer can take them off the author's markup on destroy — without that they
 * outlived it, and a re-enhanced container answered every click twice.
 */
export function initializeSelectorMode(ctx: UpsellInteractionContext): void {
  const { element, state } = ctx;

  element.querySelectorAll('[data-next-upsell-option]').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    const pkgId = parseInt(el.getAttribute('data-next-package-id') ?? '', 10);
    if (isNaN(pkgId)) return;
    state.options.set(pkgId, el);
    bind(state.selectorTeardowns, el, 'click', () => selectOption(pkgId, ctx));
    if (el.getAttribute('data-next-selected') === 'true')
      selectOption(pkgId, ctx);
  });

  const selectEl =
    element.tagName === 'SELECT'
      ? (element as HTMLSelectElement)
      : (element.querySelector(
          `[data-next-upsell-select="${state.selectorId}"]`
        ) as HTMLSelectElement | null);

  if (selectEl) {
    bind(state.selectorTeardowns, selectEl, 'change', () => {
      if (selectEl.value) {
        const pkgId = parseInt(selectEl.value, 10);
        if (!isNaN(pkgId)) selectOption(pkgId, ctx);
      } else {
        state.selectedPackageId = undefined;
        state.packageId = undefined;
      }
    });
    if (selectEl.value) {
      const pkgId = parseInt(selectEl.value, 10);
      if (!isNaN(pkgId)) selectOption(pkgId, ctx);
    }
  }
}

/**
 * Collects the action buttons and wires the quantity controls (+/- buttons and
 * fixed-quantity toggles) found inside the container, then paints the current
 * quantity onto them.
 *
 * Safe to call again: `update()` re-scans the same container, so this first
 * undoes what the previous scan attached. Without that, a button ended up in
 * `actionButtons` twice and one press stepped the quantity twice.
 */
export function scanUpsellElements(ctx: UpsellInteractionContext): void {
  const { element, state } = ctx;

  state.scanTeardowns.forEach(off => off());
  state.scanTeardowns = [];
  state.actionButtons = [];

  element.querySelectorAll('[data-next-upsell-action]').forEach(el => {
    if (el instanceof HTMLElement) state.actionButtons.push(el);
  });

  const incBtn = element.querySelector(
    '[data-next-upsell-quantity="increase"]'
  );
  const decBtn = element.querySelector(
    '[data-next-upsell-quantity="decrease"]'
  );
  const qtySelectorId =
    incBtn?.getAttribute('data-next-quantity-selector-id') ??
    decBtn?.getAttribute('data-next-quantity-selector-id') ??
    state.selectorId;

  bind(state.scanTeardowns, incBtn, 'click', () =>
    adjustQuantity(1, qtySelectorId, ctx)
  );
  bind(state.scanTeardowns, decBtn, 'click', () =>
    adjustQuantity(-1, qtySelectorId, ctx)
  );

  element
    .querySelectorAll('[data-next-upsell-quantity-toggle]')
    .forEach(toggle => {
      if (!(toggle instanceof HTMLElement)) return;
      const qty = parseInt(
        toggle.getAttribute('data-next-upsell-quantity-toggle') ?? '1',
        10
      );
      bind(state.scanTeardowns, toggle, 'click', () => setQuantity(ctx, qty));
    });

  renderQuantity(ctx);
}

/** Steps the quantity by `delta`, clamped to 1–10. */
export function adjustQuantity(
  delta: number,
  qtySelectorId: string | undefined,
  ctx: UpsellInteractionContext
): void {
  setQuantity(ctx, ctx.state.quantity + delta, qtySelectorId);
}

/** Marks `packageId` as the chosen option and announces it to the page. */
export function selectOption(
  packageId: number,
  ctx: UpsellInteractionContext
): void {
  const { element, state } = ctx;

  state.options.forEach((el, id) => {
    el.classList.toggle('next-selected', id === packageId);
    el.setAttribute('data-next-selected', (id === packageId).toString());
  });
  state.selectedPackageId = packageId;
  state.packageId = packageId;

  let actualSelectorId = state.selectorId;
  const selectedEl = state.options.get(packageId);
  if (selectedEl) {
    const parent = selectedEl.closest('[data-next-selector-id]');
    actualSelectorId =
      parent?.getAttribute('data-next-selector-id') ?? state.selectorId;
  }

  const sid = actualSelectorId ?? '';
  ctx.emit('upsell-selector:item-selected', { selectorId: sid, packageId });
  ctx.emit('upsell:option-selected', { selectorId: sid, packageId });

  if (actualSelectorId)
    syncOptionSelectionAcrossContainers(actualSelectorId, packageId);
  (element as unknown as Record<string, unknown>)['_selectedPackageId'] =
    packageId;
  ctx.logger.debug('Upsell option selected:', {
    packageId,
    selectorId: actualSelectorId,
  });
}

/**
 * Binds the action buttons and the Enter-key guard. Returns both listeners so
 * the enhancer can remove exactly these functions on destroy.
 */
export function setupEventHandlers(
  ctx: UpsellInteractionContext,
  isProcessingRef: { value: boolean },
  makeHandlerContext: () => UpsellHandlerContext
): {
  clickHandler: (event: Event) => void;
  keydownHandler: (event: KeyboardEvent) => void;
} {
  const clickHandler = (event: Event) =>
    void handleActionClick(event, makeHandlerContext());
  ctx.state.actionButtons.forEach(btn =>
    btn.addEventListener('click', clickHandler)
  );

  const keydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && isProcessingRef.value) {
      event.preventDefault();
      event.stopPropagation();
      ctx.logger.debug('Enter key blocked - upsell is processing');
    }
  };
  ctx.element.addEventListener('keydown', keydownHandler, true);

  return { clickHandler, keydownHandler };
}

/**
 * Mirrors a quantity change announced by another container for the same
 * selector (or, in direct mode, the same package). Ignores events for anything
 * else, leaving this offer's quantity untouched.
 */
export function onQuantityChanged(
  data: EventMap['upsell:quantity-changed'],
  ctx: UpsellInteractionContext
): void {
  const { state } = ctx;
  const shouldSync =
    (!!state.selectorId && data.selectorId === state.selectorId) ||
    (!state.selectorId &&
      !data.selectorId &&
      state.packageId !== undefined &&
      data.packageId === state.packageId);
  if (!shouldSync) return;

  state.quantity = data.quantity;
  if (state.selectorId) state.currentQuantitySelectorId = state.selectorId;
  renderQuantity(ctx);
}

/**
 * Mirrors an option chosen in another container for the same selector. Ignores
 * events for other selectors, leaving this offer's selection untouched.
 */
export function onOptionSelected(
  data: EventMap['upsell:option-selected'],
  ctx: UpsellInteractionContext
): void {
  const { element, state } = ctx;

  let shouldUpdate = state.selectorId === data.selectorId;
  if (!shouldUpdate) {
    element.querySelectorAll('[data-next-selector-id]').forEach(sel => {
      if (sel.getAttribute('data-next-selector-id') === data.selectorId)
        shouldUpdate = true;
    });
  }
  if (!shouldUpdate) return;

  state.selectedPackageId = data.packageId;
  state.packageId = data.packageId;
  state.options.forEach((el, id) => {
    el.classList.toggle('next-selected', id === data.packageId);
    el.setAttribute('data-next-selected', (id === data.packageId).toString());
  });
}

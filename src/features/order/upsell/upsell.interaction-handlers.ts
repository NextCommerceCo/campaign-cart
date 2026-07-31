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
} from './upsell.types';
import { handleActionClick } from './upsell.handlers';

/**
 * Wires selector mode: option cards and/or a `<select>` dropdown, plus any
 * option already marked `data-next-selected="true"`.
 */
export function initializeSelectorMode(ctx: UpsellInteractionContext): void {
  const { element, state } = ctx;

  if (state.selectorId && !state.quantityBySelectorId.has(state.selectorId)) {
    state.quantityBySelectorId.set(state.selectorId, state.quantity);
  }

  element.querySelectorAll('[data-next-upsell-option]').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    const pkgId = parseInt(el.getAttribute('data-next-package-id') ?? '', 10);
    if (isNaN(pkgId)) return;
    state.options.set(pkgId, el);
    el.addEventListener('click', () => selectOption(pkgId, ctx));
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
    selectEl.addEventListener('change', () => {
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
 * fixed-quantity toggles) found inside the container.
 */
export function scanUpsellElements(ctx: UpsellInteractionContext): void {
  const { element, state } = ctx;

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

  incBtn?.addEventListener('click', () =>
    adjustQuantity(1, qtySelectorId, ctx)
  );
  decBtn?.addEventListener('click', () =>
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
      toggle.addEventListener('click', () => {
        state.quantity = qty;
        renderQuantityDisplay(
          element,
          state.selectorId,
          state.quantityBySelectorId,
          qty
        );
        renderQuantityToggles(element, qty);
        ctx.emit('upsell:quantity-changed', {
          selectorId: state.selectorId,
          quantity: qty,
          packageId: state.packageId,
        });
      });
      if (qty === state.quantity) toggle.classList.add('next-selected');
    });
}

/**
 * Steps the quantity by `delta`, clamped to 1–10. With a quantity selector id
 * the count is kept per selector; without one it is the offer's own quantity.
 */
export function adjustQuantity(
  delta: number,
  qtySelectorId: string | undefined,
  ctx: UpsellInteractionContext
): void {
  const { state } = ctx;
  if (qtySelectorId) {
    const next = Math.min(
      10,
      Math.max(1, (state.quantityBySelectorId.get(qtySelectorId) ?? 1) + delta)
    );
    state.quantityBySelectorId.set(qtySelectorId, next);
    state.currentQuantitySelectorId = qtySelectorId;
    ctx.emit('upsell:quantity-changed', {
      selectorId: qtySelectorId,
      quantity: next,
      packageId: state.packageId,
    });
  } else {
    state.quantity = Math.min(10, Math.max(1, state.quantity + delta));
    ctx.emit('upsell:quantity-changed', {
      quantity: state.quantity,
      packageId: state.packageId,
    });
  }
  // Read after the emit: the bus is synchronous, so onQuantityChanged has
  // already run and may have moved these values.
  renderQuantityDisplay(
    ctx.element,
    qtySelectorId ?? state.selectorId,
    state.quantityBySelectorId,
    state.quantity
  );
  syncQuantityAcrossContainers(
    qtySelectorId,
    state.packageId,
    state.quantityBySelectorId,
    state.quantity
  );
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

  if (state.selectorId) {
    state.quantityBySelectorId.set(state.selectorId, data.quantity);
    state.currentQuantitySelectorId = state.selectorId;
  } else {
    state.quantity = data.quantity;
  }
  renderQuantityDisplay(
    ctx.element,
    state.currentQuantitySelectorId ?? state.selectorId,
    state.quantityBySelectorId,
    state.quantity
  );
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

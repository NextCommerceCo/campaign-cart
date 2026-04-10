/**
 * Local condition evaluator for BundleSelector slot templates.
 *
 * Supports `data-next-show` and `data-next-hide` attributes inside slot
 * templates. Conditions are evaluated synchronously at render time against
 * the slot's template vars map — not against Zustand stores.
 *
 * Only processes attributes whose value is a key in the vars map (e.g.
 * `item.hasDiscount`, `item.isRecurring`). Store-based conditions like
 * `cart.hasCoupon` are left untouched for the global ConditionalDisplayEnhancer.
 *
 * Processed attributes are removed from the element to prevent the
 * ConditionalDisplayEnhancer from re-evaluating them after the slot enters
 * the DOM.
 */

/** Evaluate a slot template var string as truthy for conditional display. */
function isTruthyVar(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  return value !== 'hide' && value !== 'false';
}

/**
 * Process data-next-show / data-next-hide attributes within a slot element,
 * toggling visibility based on the slot's template vars.
 */
export function applySlotConditionals(
  root: HTMLElement,
  vars: Record<string, string>,
): void {
  root.querySelectorAll<HTMLElement>('[data-next-show]').forEach(el => {
    const key = el.getAttribute('data-next-show')!;
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? '' : 'none';
      el.removeAttribute('data-next-show');
    }
  });
  root.querySelectorAll<HTMLElement>('[data-next-hide]').forEach(el => {
    const key = el.getAttribute('data-next-hide')!;
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? 'none' : '';
      el.removeAttribute('data-next-hide');
    }
  });
}

/** Evaluate a slot template var string as truthy for conditional display. */
export function isTruthyVar(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  return value !== 'hide' && value !== 'false';
}

/**
 * Process data-next-show / data-next-hide attributes within a rendered element,
 * toggling visibility based on the element's template vars.
 *
 * Only processes attributes whose value is a key in the vars map (e.g.
 * `isRecurring`, `hasDiscount`). Store-based conditions like `cart.hasCoupon`
 * are left untouched for the global ConditionalDisplayEnhancer.
 *
 * Processed attributes are removed from the element to prevent the
 * ConditionalDisplayEnhancer from re-evaluating them after the element enters
 * the DOM.
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

/**
 * Generic inline quantity stepper wiring.
 *
 * Shared by `PackageSelectorEnhancer` (per-card quantity) and
 * `BundleSelectorEnhancer` (bundle-level quantity multiplier). Scans one or
 * more host elements for `[data-next-quantity-increase]` /
 * `[data-next-quantity-decrease]` buttons and a
 * `[data-next-quantity-display]` element, and wires click handlers that
 * clamp to `[min, max]`, toggle disabled state, keep the host's
 * `data-next-quantity` attribute in sync, and fire `onChange` when the
 * value actually changes.
 *
 * This util owns DOM wiring only — it has no opinion on cart writes or
 * price fetches. The consumer's `onChange` is responsible for those.
 */

export interface QuantityControlsOptions {
  /**
   * Host elements to scan for stepper buttons / display. The first host is
   * also the one whose `data-next-quantity` attribute is kept in sync.
   * Typical usage: [cardElement] or [cardElement, externalHostElement].
   */
  hostEls: HTMLElement[];
  /** Current value accessor — called before each click to read the latest qty. */
  getQty: () => number;
  /** Persist a new value to the owning state. Must be synchronous. */
  setQty: (value: number) => void;
  min: number;
  max: number;
  /** Called after a value change is committed. Sync or async — return value ignored. */
  onChange: () => void;
  /**
   * Registry of attached listeners for later cleanup. The caller owns the map
   * and is responsible for calling `removeEventListener` in their cleanup pass.
   */
  handlers: Map<HTMLElement, (e: Event) => void>;
}

/**
 * Wire inline quantity controls across the given host elements.
 * Returns a function that re-applies the display state (useful after an
 * external qty change, e.g. variant swap).
 */
export function setupQuantityControls(opts: QuantityControlsOptions): () => void {
  const { hostEls, getQty, setQty, min, max, onChange, handlers } = opts;

  const increaseBtns: HTMLElement[] = [];
  const decreaseBtns: HTMLElement[] = [];
  const displayEls: HTMLElement[] = [];

  for (const host of hostEls) {
    host.querySelectorAll<HTMLElement>('[data-next-quantity-increase]').forEach(b =>
      increaseBtns.push(b),
    );
    host.querySelectorAll<HTMLElement>('[data-next-quantity-decrease]').forEach(b =>
      decreaseBtns.push(b),
    );
    host.querySelectorAll<HTMLElement>('[data-next-quantity-display]').forEach(d =>
      displayEls.push(d),
    );
  }

  const primaryHost = hostEls[0];

  const updateDisplay = (): void => {
    const qty = getQty();
    const qtyStr = String(qty);
    for (const el of displayEls) el.textContent = qtyStr;
    if (primaryHost) primaryHost.setAttribute('data-next-quantity', qtyStr);
    const atMin = qty <= min;
    const atMax = qty >= max;
    for (const btn of decreaseBtns) {
      btn.toggleAttribute('disabled', atMin);
      btn.classList.toggle('next-disabled', atMin);
    }
    for (const btn of increaseBtns) {
      btn.toggleAttribute('disabled', atMax);
      btn.classList.toggle('next-disabled', atMax);
    }
  };

  if (increaseBtns.length === 0 && decreaseBtns.length === 0) {
    // Still reflect initial state on the display element, even with no buttons.
    if (displayEls.length > 0) updateDisplay();
    return updateDisplay;
  }

  for (const btn of increaseBtns) {
    const h = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();
      const current = getQty();
      if (current < max) {
        setQty(current + 1);
        updateDisplay();
        onChange();
      }
    };
    handlers.set(btn, h);
    btn.addEventListener('click', h);
  }

  for (const btn of decreaseBtns) {
    const h = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();
      const current = getQty();
      if (current > min) {
        setQty(current - 1);
        updateDisplay();
        onChange();
      }
    };
    handlers.set(btn, h);
    btn.addEventListener('click', h);
  }

  updateDisplay();
  return updateDisplay;
}

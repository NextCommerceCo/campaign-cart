/**
 * DOM event delegation for the debug overlay's shadow root: routing a click to
 * the right handler, and the discount-popup hover positioning. Extracted
 * verbatim from `debug-overlay.ts` — logic unchanged, only `this.foo` became an
 * explicit `deps: ContainerClickDeps` parameter and calls between these
 * functions are now direct calls instead of `this.foo()`.
 *
 * `handleDebugAction` and `handleTabSwitch` deliberately stayed on `DebugOverlay`
 * rather than moving here: both write `DebugOverlay.EXPANDED_STORAGE_KEY` /
 * `ACTIVE_PANEL_KEY` / `ACTIVE_TAB_KEY`, and `extract-storage-keys.ts` only
 * resolves a static class field when the reference lives in the same file as
 * the class declaration (see docs/code-findings.md #183). Moving them would
 * have turned three documented storage-key rows into unresolvable `{token}`
 * patterns, so this split stops at the dispatcher that calls them.
 */
import type { ContainerClickDeps } from './debug-overlay.types';

export function addEventListeners(
  shadowRoot: ShadowRoot | null,
  onClick: (event: Event) => void,
  onHover: (event: Event) => void
): void {
  if (!shadowRoot) return;

  // Remove any existing listeners to prevent duplicates
  shadowRoot.removeEventListener('click', onClick);
  shadowRoot.removeEventListener('mouseover', onHover);

  // Use event delegation for all debug actions
  shadowRoot.addEventListener('click', onClick);
  shadowRoot.addEventListener('mouseover', onHover);
}

/**
 * Switches the vertical panel or the horizontal tab inside it, then runs the
 * active panel's own action button, matched by its label.
 */
export function runPanelAction(
  target: HTMLElement,
  deps: ContainerClickDeps
): void {
  // Handle panel action buttons
  const panelActionBtn = target.closest('.panel-action-btn') as HTMLElement;
  if (panelActionBtn) {
    const actionLabel = panelActionBtn.getAttribute('data-panel-action');
    const activePanel = deps.panels.find(p => p.id === deps.activePanel);
    const panelAction = activePanel
      ?.getActions?.()
      ?.find(a => a.label === actionLabel);

    if (panelAction) {
      panelAction.action();
      // Re-render the whole overlay (not just content): actions whose label
      // toggles with state — e.g. Pause/Resume — live in the chrome, and the
      // click handler matches by label, so the buttons must be re-rendered to
      // stay in sync. updateContent() alone leaves a stale "Pause" button that
      // no longer matches the now-"Resume" action.
      setTimeout(() => deps.updateOverlay(), 100);
    }
    return;
  }
}

export function handleContainerClick(
  event: Event,
  deps: ContainerClickDeps
): void {
  const target = event.target as HTMLElement;
  const action =
    target.getAttribute('data-action') ||
    target.closest('[data-action]')?.getAttribute('data-action');

  // Handle main debug actions
  if (action) {
    deps.handleDebugAction(action);
    return;
  }

  // Handle panel and horizontal tab switching
  if (deps.handleTabSwitch(target)) return;

  runPanelAction(target, deps);
}

export function handleContainerHover(event: Event): void {
  const target = event.target as HTMLElement;
  const miniCartItem = target.closest('.debug-mini-cart-item');

  if (miniCartItem) {
    const detailsCard = miniCartItem.querySelector(
      '.mini-cart-discount-details-card'
    ) as HTMLElement;
    if (detailsCard) {
      const itemRect = miniCartItem.getBoundingClientRect();

      // Exact width from CSS: 240px width + 32px padding (16*2) + 2px border = 274px
      const cardWidth = 250;
      const gap = 8;

      const left = itemRect.left - cardWidth - gap;
      const top = itemRect.top;

      detailsCard.style.left = `${left}px`;
      detailsCard.style.top = `${top}px`;
    }
  }

  // Handle cart-level discount popup hover
  const miniCartTotals = target.closest(
    '.debug-mini-cart-totals.has-cart-discounts'
  );
  if (miniCartTotals) {
    const cartDiscountPopup = miniCartTotals.querySelector(
      '.mini-cart-cart-discount-popup .mini-cart-discount-details-card'
    ) as HTMLElement;
    if (cartDiscountPopup) {
      const totalsRect = miniCartTotals.getBoundingClientRect();

      const cardWidth = 250;
      const gap = 8;

      const left = totalsRect.left - cardWidth - gap;
      const top = totalsRect.top;

      cartDiscountPopup.style.left = `${left}px`;
      cartDiscountPopup.style.top = `${top}px`;
    }
  }
}

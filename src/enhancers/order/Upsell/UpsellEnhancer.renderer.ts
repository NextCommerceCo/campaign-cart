import type { Logger } from '@/utils/logger';

export function renderQuantityDisplay(
  element: HTMLElement,
  selectorId: string | undefined,
  quantityMap: Map<string, number>,
  fallbackQty: number,
): void {
  if (selectorId && quantityMap.has(selectorId)) {
    const qty = quantityMap.get(selectorId)!;
    document
      .querySelectorAll(
        `[data-next-upsell-quantity="display"][data-next-quantity-selector-id="${selectorId}"]`,
      )
      .forEach(el => {
        if (el instanceof HTMLElement) el.textContent = qty.toString();
      });
    const local = element.querySelector(
      '[data-next-upsell-quantity="display"]:not([data-next-quantity-selector-id])',
    );
    if (local instanceof HTMLElement) local.textContent = qty.toString();
  } else {
    const display = element.querySelector('[data-next-upsell-quantity="display"]');
    if (display) display.textContent = fallbackQty.toString();
  }
}

export function renderQuantityToggles(element: HTMLElement, qty: number): void {
  element.querySelectorAll('[data-next-upsell-quantity-toggle]').forEach(toggle => {
    if (!(toggle instanceof HTMLElement)) return;
    const toggleQty = parseInt(
      toggle.getAttribute('data-next-upsell-quantity-toggle') ?? '1',
      10,
    );
    toggle.classList.toggle('next-selected', toggleQty === qty);
  });
}

export function syncOptionSelectionAcrossContainers(
  selectorId: string,
  selectedPackageId: number,
): void {
  document.querySelectorAll(`[data-next-selector-id="${selectorId}"]`).forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    el.querySelectorAll('[data-next-upsell-option]').forEach(option => {
      if (!(option instanceof HTMLElement)) return;
      const pkgId = parseInt(option.getAttribute('data-next-package-id') ?? '0', 10);
      const isSelected = pkgId === selectedPackageId;
      option.classList.toggle('next-selected', isSelected);
      option.setAttribute('data-next-selected', isSelected.toString());
    });
    const select = el.querySelector('select');
    if (select) select.value = selectedPackageId.toString();
  });
}

export function syncQuantityAcrossContainers(
  selectorId: string | undefined,
  packageId: number | undefined,
  quantityMap: Map<string, number>,
  fallbackQty: number,
): void {
  if (selectorId) {
    const qty = quantityMap.get(selectorId);
    if (!qty) return;
    document
      .querySelectorAll(`[data-next-selector-id="${selectorId}"] [data-next-upsell-option]`)
      .forEach(option => {
        if (option instanceof HTMLElement)
          option.setAttribute('data-next-quantity', qty.toString());
      });
    document.querySelectorAll(`[data-next-upsell-select="${selectorId}"]`).forEach(select => {
      if (!(select instanceof HTMLSelectElement)) return;
      select.querySelectorAll('option[data-next-package-id]').forEach(opt => {
        if (opt instanceof HTMLOptionElement)
          opt.setAttribute('data-next-quantity', qty.toString());
      });
    });
  } else if (packageId !== undefined) {
    document
      .querySelectorAll(
        `[data-next-upsell="offer"][data-next-package-id="${packageId}"]:not([data-next-selector-id])`,
      )
      .forEach(container => {
        if (!(container instanceof HTMLElement)) return;
        const display = container.querySelector('[data-next-upsell-quantity="display"]');
        if (display instanceof HTMLElement) display.textContent = fallbackQty.toString();
      });
  }
}

export function renderProcessingState(
  element: HTMLElement,
  buttons: HTMLElement[],
  processing: boolean,
): void {
  element.classList.toggle('next-processing', processing);
  buttons.forEach(btn => {
    if (btn instanceof HTMLButtonElement) btn.disabled = processing;
    btn.classList.toggle('next-disabled', processing);
  });
}

export function showUpsellOffer(element: HTMLElement): void {
  element.classList.remove('next-hidden', 'next-error');
  element.classList.add('next-available');
}

export function hideUpsellOffer(element: HTMLElement): void {
  element.classList.add('next-hidden');
  element.classList.remove('next-available');
}

export function renderSuccess(element: HTMLElement): void {
  element.classList.add('next-success');
  setTimeout(() => element.classList.remove('next-success'), 3000);
}

export function renderError(element: HTMLElement, message: string, logger: Logger): void {
  element.classList.add('next-error');
  element.classList.remove('next-processing');
  logger.error('Upsell error:', message);
  setTimeout(() => element.classList.remove('next-error'), 5000);
}

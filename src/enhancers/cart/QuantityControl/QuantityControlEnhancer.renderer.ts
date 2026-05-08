import type { QuantityAction, QuantityConstraints } from './QuantityControlEnhancer.types';

export function renderButtonState(
  element: HTMLElement,
  action: QuantityAction,
  currentQuantity: number,
  constraints: QuantityConstraints,
): void {
  const canIncrease = currentQuantity < constraints.max;
  const canDecrease = currentQuantity > constraints.min;

  switch (action) {
    case 'increase':
      toggleElementDisabled(element, !canIncrease);
      break;
    case 'decrease':
      toggleElementDisabled(element, !canDecrease);
      break;
    case 'set':
      if (element instanceof HTMLInputElement) {
        element.min = String(constraints.min);
        element.max = String(constraints.max);
        element.step = String(constraints.step);
      }
      break;
  }
}

function toggleElementDisabled(element: HTMLElement, disabled: boolean): void {
  element.classList.toggle('disabled', disabled);
  element.toggleAttribute('disabled', disabled);
  element.setAttribute('aria-disabled', String(disabled));
}

export function renderInputValue(
  element: HTMLInputElement | HTMLSelectElement,
  quantity: number,
): void {
  if (element.value !== String(quantity)) {
    element.value = String(quantity);
  }
}

export function renderCartClasses(element: HTMLElement, isInCart: boolean): void {
  element.classList.toggle('has-item', isInCart);
  element.classList.toggle('empty', !isInCart);
}

export function renderQuantityData(
  element: HTMLElement,
  quantity: number,
  isInCart: boolean,
): void {
  element.setAttribute('data-quantity', String(quantity));
  element.setAttribute('data-in-cart', String(isInCart));
}

export function renderButtonContent(
  element: HTMLElement,
  currentQuantity: number,
  step: number,
): void {
  if (!element.hasAttribute('data-original-content')) {
    element.setAttribute('data-original-content', element.innerHTML);
  }
  const originalContent =
    element.getAttribute('data-original-content') ?? element.innerHTML;
  const newContent = originalContent
    .replace(/\{quantity\}/g, String(currentQuantity))
    .replace(/\{step\}/g, String(step));
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent;
  }
}

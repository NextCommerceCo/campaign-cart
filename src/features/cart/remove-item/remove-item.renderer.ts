export function renderButtonState(element: HTMLElement, isInCart: boolean): void {
  element.classList.toggle('disabled', !isInCart);
  element.toggleAttribute('disabled', !isInCart);
  element.setAttribute('aria-disabled', String(!isInCart));
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

export function renderButtonContent(element: HTMLElement, quantity: number): void {
  if (!element.hasAttribute('data-original-content')) {
    element.setAttribute('data-original-content', element.innerHTML);
  }
  const originalContent = element.getAttribute('data-original-content') ?? element.innerHTML;
  const newContent = originalContent.replace(/\{quantity\}/g, String(quantity));
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent;
  }
}

export function renderRemovalFeedback(element: HTMLElement): void {
  element.classList.add('item-removed');
  const cartItem = element.closest('[data-cart-item-id], .cart-item');
  if (cartItem instanceof HTMLElement) {
    cartItem.classList.add('removing');
    setTimeout(() => cartItem.classList.remove('removing'), 300);
  }
  setTimeout(() => element.classList.remove('item-removed'), 300);
}

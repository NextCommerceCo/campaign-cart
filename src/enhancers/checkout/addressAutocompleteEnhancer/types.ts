import type { Logger } from '@/utils/logger';
import type { EventBus } from '@/utils/events';

export interface AutocompleteContext {
  fields: Map<string, HTMLElement>;
  billingFields: Map<string, HTMLElement>;
  getDetectedCountryCode: () => string;
  getHasTrackedShippingInfo: () => boolean;
  setHasTrackedShippingInfo: (value: boolean) => void;
  logger: Logger;
  eventBus: EventBus;
}

/** Creates a close button element styled for PAC containers */
export function createCloseButton(onClose: () => void): HTMLButtonElement {
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'pac-close-button';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close suggestions');
  closeButton.style.cssText = `
    position: absolute;
    top: 0.4rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 20px;
    line-height: 24px;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
    width: 24px;
    height: 24px;
  `;
  closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#f3f4f6'; });
  closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = 'transparent'; });
  closeButton.addEventListener('click', onClose);
  return closeButton;
}

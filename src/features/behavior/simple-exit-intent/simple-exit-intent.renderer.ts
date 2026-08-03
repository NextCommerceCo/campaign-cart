/**
 * Popup DOM builders for the simple exit-intent behavior — the template-based
 * popup, the image-based popup, the `data-exit-intent-action` wiring inside a
 * template popup, and the DOM half of hiding a popup. Pure functions over an
 * explicit `ExitIntentPopupContext` — no reads off `this`.
 */

import type {
  ExitIntentPopupContext,
  ExitIntentPopupElements,
} from './simple-exit-intent.types';

export function createTemplatePopup(
  ctx: ExitIntentPopupContext
): ExitIntentPopupElements {
  // Create overlay
  const overlayElement = document.createElement('div');
  overlayElement.className = 'exit-intent-overlay';
  overlayElement.setAttribute('data-exit-intent', 'overlay');
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    cursor: ${ctx.overlayClosable ? 'pointer' : 'default'};
  `;

  // Create popup container
  const popupElement = document.createElement('div');
  popupElement.className = 'exit-intent-popup exit-intent-template-popup';
  popupElement.setAttribute('data-exit-intent', 'popup');
  popupElement.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000000;
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
  `;

  // Clone and show the template content
  if (ctx.templateElement) {
    // Use the template's content property to get a document fragment
    const templateContent = ctx.templateElement.content.cloneNode(
      true
    ) as DocumentFragment;

    // Append the cloned content to the popup
    popupElement.appendChild(templateContent);

    // Process any data-next attributes in the popup element
    processTemplateActions(popupElement, ctx);
  }

  // Add close button if enabled
  if (ctx.showCloseButton) {
    const closeButton = document.createElement('button');
    closeButton.className = 'exit-intent-close';
    closeButton.setAttribute('data-exit-intent', 'close');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: transparent;
      border: none;
      font-size: 30px;
      cursor: pointer;
      z-index: 1000001;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      line-height: 1;
    `;
    closeButton.addEventListener('click', e => {
      e.stopPropagation();
      ctx.hidePopup();
      ctx.emit('exit-intent:closed', {
        imageUrl: ctx.imageUrl,
        template: ctx.templateName,
      });
    });
    popupElement.appendChild(closeButton);
  }

  // Click handlers
  if (ctx.overlayClosable) {
    overlayElement.addEventListener('click', () => {
      ctx.hidePopup();
      ctx.emit('exit-intent:dismissed', {
        imageUrl: ctx.imageUrl,
        template: ctx.templateName,
      });
      ctx.saveToSessionStorage();
    });
  }

  // Prevent popup clicks from closing when clicking inside
  popupElement.addEventListener('click', e => {
    e.stopPropagation();
  });

  // Escape key
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      ctx.hidePopup();
      ctx.emit('exit-intent:dismissed', {
        imageUrl: ctx.imageUrl,
        template: ctx.templateName,
      });
      ctx.saveToSessionStorage();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Add to DOM with animation
  document.body.appendChild(overlayElement);
  document.body.appendChild(popupElement);

  requestAnimationFrame(() => {
    overlayElement.style.opacity = '1';
    popupElement.style.opacity = '0';
    popupElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
    popupElement.style.transition = 'all 0.3s ease';
    requestAnimationFrame(() => {
      popupElement.style.opacity = '1';
      popupElement.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  });

  return { popupElement, overlayElement };
}

export function processTemplateActions(
  templateElement: HTMLElement,
  ctx: ExitIntentPopupContext
): void {
  // Find elements with data-exit-intent-action attributes
  const actionElements = templateElement.querySelectorAll(
    '[data-exit-intent-action]'
  );

  actionElements.forEach(element => {
    const actionType = element.getAttribute('data-exit-intent-action');

    switch (actionType) {
      case 'close':
        element.addEventListener('click', () => {
          ctx.hidePopup();
          ctx.emit('exit-intent:action', { action: 'close' });
        });
        break;

      case 'apply-coupon':
        const couponCode = element.getAttribute('data-coupon-code');
        if (couponCode) {
          element.addEventListener('click', async () => {
            ctx.emit('exit-intent:action', {
              action: 'apply-coupon',
              couponCode,
            });
            // Apply the coupon through the cart operations
            const { cartOperations } = await import('@/state/cart');
            await cartOperations.applyCoupon(couponCode);
            ctx.hidePopup();
          });
        }
        break;

      case 'custom':
        element.addEventListener('click', async () => {
          if (ctx.action) {
            await ctx.action();
          }
          ctx.emit('exit-intent:action', { action: 'custom' });
          ctx.hidePopup();
        });
        break;
    }
  });
}

export function createImagePopup(
  ctx: ExitIntentPopupContext
): ExitIntentPopupElements {
  // Create overlay
  const overlayElement = document.createElement('div');
  overlayElement.className = 'exit-intent-overlay';
  overlayElement.setAttribute('data-exit-intent', 'overlay');
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    cursor: pointer;
  `;

  // Create popup
  const popupElement = document.createElement('div');
  popupElement.className = 'exit-intent-popup';
  popupElement.setAttribute('data-exit-intent', 'popup');
  popupElement.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000000;
    cursor: ${ctx.imageClickable && !ctx.actionButtonText ? 'pointer' : 'default'};
    max-width: 90vw;
    max-height: ${ctx.actionButtonText ? '60vh' : '50vh'};
  `;

  // Create image
  const image = document.createElement('img');
  image.className = 'exit-intent-image';
  image.setAttribute('data-exit-intent', 'image');
  image.src = ctx.imageUrl;
  image.style.cssText = `
    max-width: 100%;
    max-height: 50vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;

  image.onerror = () => {
    ctx.logger.error('Failed to load exit intent image:', ctx.imageUrl);
    ctx.hidePopup();
  };

  popupElement.appendChild(image);

  // Add action button if specified
  if (ctx.actionButtonText) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      text-align: center;
      margin-top: 20px;
    `;

    const actionButton = document.createElement('button');
    actionButton.className = 'exit-intent-action-button';
    actionButton.setAttribute('data-exit-intent', 'action');
    actionButton.textContent = ctx.actionButtonText;
    actionButton.style.cssText = `
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 12px 30px;
      font-size: 16px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    `;

    actionButton.addEventListener('click', async e => {
      e.stopPropagation();
      ctx.emit('exit-intent:clicked', { imageUrl: ctx.imageUrl });

      // Execute action if provided
      if (ctx.action) {
        try {
          await ctx.action();
        } catch (error) {
          ctx.logger.error('Exit intent action failed:', error);
        }
      }

      // Mark as clicked in session storage
      ctx.saveToSessionStorage();
      ctx.hidePopup();
    });

    buttonContainer.appendChild(actionButton);
    popupElement.appendChild(buttonContainer);
  }

  // Add close button
  if (ctx.showCloseButton) {
    const closeButton = document.createElement('button');
    closeButton.className = 'exit-intent-close';
    closeButton.setAttribute('data-exit-intent', 'close');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: transparent;
      border: none;
      font-size: 30px;
      cursor: pointer;
      z-index: 1000001;
      color: #fff;
      text-shadow: 0 0 3px rgba(0,0,0,0.5);
      padding: 0;
      width: 30px;
      height: 30px;
      line-height: 1;
    `;
    closeButton.addEventListener('click', e => {
      e.stopPropagation();
      ctx.hidePopup();
      ctx.emit('exit-intent:closed', { imageUrl: ctx.imageUrl });
    });
    popupElement.appendChild(closeButton);
  }

  // Click handlers
  overlayElement.addEventListener('click', () => {
    ctx.hidePopup();
    ctx.emit('exit-intent:dismissed', { imageUrl: ctx.imageUrl });
    // Mark as dismissed in session storage
    ctx.saveToSessionStorage();
  });

  // Only make the popup clickable if imageClickable is true and no action button
  if (ctx.imageClickable && !ctx.actionButtonText) {
    popupElement.addEventListener('click', async e => {
      e.stopPropagation();
      ctx.emit('exit-intent:clicked', { imageUrl: ctx.imageUrl });

      // Execute action if provided
      if (ctx.action) {
        try {
          await ctx.action();
        } catch (error) {
          ctx.logger.error('Exit intent action failed:', error);
        }
      }

      // Mark as clicked in session storage
      ctx.saveToSessionStorage();
      ctx.hidePopup();
    });
  } else {
    // Prevent popup clicks from closing when clicking inside
    popupElement.addEventListener('click', e => {
      e.stopPropagation();
    });
  }

  // Escape key
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      ctx.hidePopup();
      ctx.emit('exit-intent:dismissed', { imageUrl: ctx.imageUrl });
      // Mark as dismissed in session storage
      ctx.saveToSessionStorage();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Add to DOM with animation
  document.body.appendChild(overlayElement);
  document.body.appendChild(popupElement);

  requestAnimationFrame(() => {
    overlayElement.style.opacity = '1';
    popupElement.style.opacity = '0';
    popupElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
    popupElement.style.transition = 'all 0.3s ease';
    requestAnimationFrame(() => {
      popupElement.style.opacity = '1';
      popupElement.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  });

  return { popupElement, overlayElement };
}

/**
 * DOM half of hiding a popup: fades the elements out and removes them after
 * the 0.2s transition. `live` reads the enhancer's *current* element
 * references at timeout-fire time (not the snapshot passed in `elements`), so
 * a second `hidePopup()` call in the same 200ms window doesn't double-remove
 * or double-clear — matching the original single-method behavior.
 */
export function hidePopupElements(
  elements: {
    popupElement: HTMLElement | null;
    overlayElement: HTMLElement | null;
  },
  live: {
    getPopupElement: () => HTMLElement | null;
    getOverlayElement: () => HTMLElement | null;
  },
  onCleared: { popup: () => void; overlay: () => void }
): void {
  if (elements.popupElement) {
    elements.popupElement.style.transition = 'all 0.2s ease';
    elements.popupElement.style.opacity = '0';
    elements.popupElement.style.transform = 'translate(-50%, -50%) scale(0.8)';

    setTimeout(() => {
      const current = live.getPopupElement();
      if (current) {
        current.remove();
        onCleared.popup();
      }
    }, 200);
  }

  if (elements.overlayElement) {
    elements.overlayElement.style.transition = 'opacity 0.2s ease';
    elements.overlayElement.style.opacity = '0';

    setTimeout(() => {
      const current = live.getOverlayElement();
      if (current) {
        current.remove();
        onCleared.overlay();
      }
    }, 200);
  }
}

(function() {
  'use strict';

  const QUANTITY_MAPS = {
    'limos-card': {
      1: { packageId: 2, quantity: 1 },
      2: { packageId: 3, quantity: 2 },
      3: { packageId: 4, quantity: 1 },
      4: [
        { packageId: 2, quantity: 2 },
        { packageId: 3, quantity: 1 }
      ]
    }
  };

  const CONFIG = {
    debug: true,
    clearCartOnLoad: true,
    resetToQuantityOne: true,
    addInitialPackage: true  // Add the quantity 1 package to cart on load
  };

  const reverseMaps = {};
  let isInitialized = false;

  function log(...args) {
    if (CONFIG.debug) console.log('[QuantitySwapper]', ...args);
  }

  function normalizePackageDefinition(definition, selectorQuantity) {
    if (Array.isArray(definition)) return definition;
    if (typeof definition === 'number') return [{ packageId: definition, quantity: selectorQuantity }];
    if (typeof definition === 'object' && definition.packageId) return [definition];
    return [];
  }

  function buildReverseMaps() {
    Object.keys(QUANTITY_MAPS).forEach(selectorId => {
      reverseMaps[selectorId] = {};
      Object.entries(QUANTITY_MAPS[selectorId]).forEach(([qty, definition]) => {
        const normalized = normalizePackageDefinition(definition, parseInt(qty));
        if (normalized.length > 0) {
          reverseMaps[selectorId][normalized[0].packageId] = parseInt(qty);
        }
      });
    });
  }

  function getSelector(selectorId) {
    return document.querySelector(`[data-qty-selector="${selectorId}"]`);
  }

  function getSelectorCard(selectorId) {
    const selector = getSelector(selectorId);
    return selector ? selector.querySelector('[data-qty-card]') : null;
  }

  async function swapToPackages(packages) {
    try {
      await next.swapCart(packages);
      log('✅ Cart swapped');
      return true;
    } catch (err) {
      console.error('[QuantitySwapper] Failed to swap cart:', err);
      return false;
    }
  }

  async function clearCart() {
    try {
      await next.clearCart();
      log('✅ Cart cleared');
      return true;
    } catch (err) {
      console.error('[QuantitySwapper] Failed to clear cart:', err);
      return false;
    }
  }

  function resetSelectorToQuantityOne(selectorId) {
    const card = getSelectorCard(selectorId);
    if (!card) return;

    card.setAttribute('data-qty-current', '1');
    const display = card.querySelector('[data-qty-display]');
    if (display) display.textContent = '1';

    const firstPackageDef = QUANTITY_MAPS[selectorId][1];
    if (firstPackageDef) {
      const packages = normalizePackageDefinition(firstPackageDef, 1);
      if (packages.length > 0) {
        card.setAttribute('data-next-package-id', packages[0].packageId);
      }
    }

    log(`Reset ${selectorId} to quantity 1`);
  }

  function setupQuantityControls(selectorId) {
    const selector = getSelector(selectorId);
    if (!selector) return;

    const card = selector.querySelector('[data-qty-card]');
    if (!card) return;

    const increaseBtn = card.querySelector('[data-qty-increase]');
    const decreaseBtn = card.querySelector('[data-qty-decrease]');
    const displayElement = card.querySelector('[data-qty-display]');

    if (!increaseBtn || !decreaseBtn || !displayElement) return;

    const minQuantity = parseInt(card.getAttribute('data-qty-min') || '1', 10);
    const maxQuantity = parseInt(card.getAttribute('data-qty-max') || '999', 10);

    let currentQuantity = parseInt(card.getAttribute('data-qty-current') || '1', 10);

    const updateButtonStates = () => {
      const isAtMin = currentQuantity <= minQuantity;
      const isAtMax = currentQuantity >= maxQuantity;

      decreaseBtn.disabled = isAtMin;
      decreaseBtn.classList.toggle('next-disabled', isAtMin);

      increaseBtn.disabled = isAtMax;
      increaseBtn.classList.toggle('next-disabled', isAtMax);
    };

    const handleQuantityChange = async (newQuantity) => {
      currentQuantity = newQuantity;
      displayElement.textContent = currentQuantity.toString();
      card.setAttribute('data-qty-current', currentQuantity.toString());
      updateButtonStates();

      log(`Quantity changed: selector=${selectorId}, qty=${currentQuantity}`);

      const packageMap = QUANTITY_MAPS[selectorId];
      if (!packageMap) return;

      const packageDefinition = packageMap[currentQuantity];
      if (!packageDefinition) return;

      const targetPackages = normalizePackageDefinition(packageDefinition, currentQuantity);
      if (targetPackages.length === 0) return;

      const targetPackageId = targetPackages[0].packageId;
      card.setAttribute('data-next-package-id', targetPackageId);

      log(`Swapping to package ${targetPackageId}`);
      await swapToPackages(targetPackages);
    };

    increaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentQuantity < maxQuantity) {
        handleQuantityChange(currentQuantity + 1);
      }
    });

    decreaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentQuantity > minQuantity) {
        handleQuantityChange(currentQuantity - 1);
      }
    });

    updateButtonStates();
    log(`✅ Quantity controls setup for ${selectorId}`);
  }

  async function initialize() {
    if (isInitialized) return;

    log('Initializing...');

    if (CONFIG.clearCartOnLoad) {
      await clearCart();
    }

    buildReverseMaps();

    if (CONFIG.resetToQuantityOne) {
      Object.keys(QUANTITY_MAPS).forEach(selectorId => {
        resetSelectorToQuantityOne(selectorId);
      });
    }

    if (CONFIG.addInitialPackage) {
      Object.keys(QUANTITY_MAPS).forEach(selectorId => {
        const firstPackageDef = QUANTITY_MAPS[selectorId][1];
        if (firstPackageDef) {
          const packages = normalizePackageDefinition(firstPackageDef, 1);
          if (packages.length > 0) {
            swapToPackages(packages);
            log(`Added initial package(s) for ${selectorId}`);
          }
        }
      });
    }

    Object.keys(QUANTITY_MAPS).forEach(selectorId => {
      setupQuantityControls(selectorId);
    });

    isInitialized = true;
    log('✅ Initialized');
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('next:initialized', function() {
      setTimeout(initialize, 50);
    });

    window.QuantityPackageSwapper = {
      initialize,
      swapToPackages,
      clearCart,
      config: CONFIG,
      maps: QUANTITY_MAPS
    };
  }

})();

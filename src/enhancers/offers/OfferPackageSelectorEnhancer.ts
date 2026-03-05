/**
 * Offer Package Selector Enhancer
 * Manages offer package selection with multi-tier pricing, badges, and discounts
 *
 * This enhancer handles the "Choose your package" UI pattern common in e-commerce
 * where users select between 1x, 2x, 3x units with increasing discounts.
 *
 * @example
 * <div data-next-offer-selector
 *      data-next-offer-id="123"
 *      data-next-selection-mode="swap">
 *
 *   <div data-next-offer-package-card
 *        data-next-offer-package-id="1"
 *        data-next-badge="Most Popular"
 *        data-next-badge-type="popular">
 *     <div class="package-title">2x Units</div>
 *     <div data-next-package-price>$19.99/ea</div>
 *     <div data-next-package-savings>Save 55% OFF</div>
 *   </div>
 *
 *   <div data-next-offer-package-card
 *        data-next-offer-package-id="2"
 *        data-next-badge="Best Deal"
 *        data-next-badge-type="deal">
 *     <div class="package-title">3x Units</div>
 *     <div data-next-package-price>$15.99/ea</div>
 *     <div data-next-package-savings>Save 60% OFF</div>
 *   </div>
 * </div>
 *
 * Attributes:
 * - data-next-offer-selector: Main identifier for the enhancer
 * - data-next-offer-id: Offer ID from campaign data (optional)
 * - data-next-selection-mode: 'swap' (replace cart) or 'select' (user confirms)
 * - data-next-auto-select-best: Auto-select best deal on load (default: false)
 *
 * Card Attributes:
 * - data-next-offer-package-card: Identifies a selectable package card
 * - data-next-offer-package-id: Reference to OfferPackage from campaign
 * - data-next-package-id: The actual package ID to add to cart
 * - data-next-quantity: Quantity for this package (default: 1)
 * - data-next-badge: Badge text to display
 * - data-next-badge-type: Badge style (popular, deal, limited, discount)
 * - data-next-selected: Pre-selected state (default: false)
 * - data-next-shipping-id: Shipping method to set when selected
 *
 * Events:
 * - offer-package:selected - When package is selected
 * - offer-package:changed - When selection changes
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { ElementDataExtractor } from '@/utils/dom/ElementDataExtractor';
import type { CartState } from '@/types/global';
import type { Offer, OfferPackage } from '@/types/campaign';

interface OfferPackageItem {
  element: HTMLElement;
  offerPackageId: string;
  packageId: number;
  quantity: number;
  badge?: string;
  badgeType?: 'popular' | 'deal' | 'limited' | 'discount';
  isPreSelected: boolean;
  shippingId?: string;

  // Extracted data from offer
  price: number;
  priceBeforeDiscount: number;
  savings: number;
  savingsPercent: number;
  name: string;
}

export class OfferPackageSelectorEnhancer extends BaseEnhancer {
  private offerId?: number;
  private mode: 'swap' | 'select' = 'swap';
  private autoSelectBest: boolean = false;
  private packages: OfferPackageItem[] = [];
  private selectedPackage: OfferPackageItem | null = null;
  private clickHandlers = new Map<HTMLElement, (event: Event) => void>();
  private mutationObserver: MutationObserver | null = null;
  private offerData?: Offer;

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    const offerIdAttr = this.getAttribute('data-next-offer-id');
    this.offerId = offerIdAttr ? parseInt(offerIdAttr, 10) : undefined;

    this.mode = (this.getAttribute('data-next-selection-mode') || 'swap') as 'swap' | 'select';
    this.autoSelectBest = this.getAttribute('data-next-auto-select-best') === 'true';

    // Load offer data from campaign if offer ID is provided
    if (this.offerId) {
      await this.loadOfferData();
    }

    // Find and register all package cards
    this.initializePackageCards();

    // Set up mutation observer for dynamic cards
    this.setupMutationObserver();

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.syncWithCart.bind(this));

    // Initial sync
    this.syncWithCart(useCartStore.getState());

    // Auto-select best deal if configured
    if (this.autoSelectBest && !this.selectedPackage) {
      this.selectBestDeal();
    }

    // Initialize slot visibility (defaults to quantity 1 if no package is selected yet)
    this.updateSlotVisibility(this.selectedPackage?.quantity ?? 1);

    // Expose methods for external access
    (this.element as any)._getSelectedPackage = () => this.selectedPackage;
    (this.element as any)._getSelectedPackageId = () => this.selectedPackage?.packageId;

    this.logger.debug('OfferPackageSelectorEnhancer initialized:', {
      offerId: this.offerId,
      mode: this.mode,
      packageCount: this.packages.length,
      selectedPackage: this.selectedPackage?.packageId
    });
  }

  private async loadOfferData(): Promise<void> {
    try {
      const campaignStore = useCampaignStore.getState();
      const campaign = campaignStore.campaign;

      if (campaign?.offers && this.offerId) {
        this.offerData = campaign.offers.find(offer => offer.ref_id === this.offerId);

        if (this.offerData) {
          this.logger.debug('Loaded offer data:', this.offerData);
        } else {
          this.logger.warn(`Offer ${this.offerId} not found in campaign data`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load offer data:', error);
    }
  }

  private initializePackageCards(): void {
    const cardElements = this.element.querySelectorAll('[data-next-offer-package-card]');

    cardElements.forEach((cardElement) => {
      if (cardElement instanceof HTMLElement) {
        this.registerPackageCard(cardElement);
      }
    });

    if (this.packages.length === 0) {
      this.logger.warn('No offer package cards found', this.element);
    }
  }

  private registerPackageCard(cardElement: HTMLElement): void {
    const offerPackageId = cardElement.getAttribute('data-next-offer-package-id');
    const packageIdAttr = cardElement.getAttribute('data-next-package-id');

    if (!packageIdAttr) {
      this.logger.warn('Card missing package ID attribute', cardElement);
      return;
    }

    const packageId = parseInt(packageIdAttr, 10);
    const quantity = parseInt(cardElement.getAttribute('data-next-quantity') || '1', 10);
    const isPreSelected = cardElement.getAttribute('data-next-selected') === 'true';
    const badge = cardElement.getAttribute('data-next-badge') || undefined;
    const badgeType = cardElement.getAttribute('data-next-badge-type') as any || undefined;
    const shippingId = cardElement.getAttribute('data-next-shipping-id') || undefined;

    // Check if already registered
    const existingIndex = this.packages.findIndex(pkg => pkg.element === cardElement);
    if (existingIndex !== -1) {
      this.logger.debug('Package card already registered, updating:', packageId);
      return;
    }

    // Get package data from campaign or offer
    let offerPackageData: OfferPackage | undefined;

    if (this.offerData && offerPackageId) {
      offerPackageData = this.offerData.packages.find(
        pkg => pkg.package_id.toString() === offerPackageId
      );
    }

    // Extract pricing information
    let price = 0;
    let priceBeforeDiscount = 0;
    let name = `Package ${packageId}`;

    if (offerPackageData) {
      price = parseFloat(offerPackageData.unit_price);
      priceBeforeDiscount = parseFloat(offerPackageData.unit_price_before_discount);
      name = offerPackageData.package_name;
    } else {
      // Fallback to DOM extraction
      price = ElementDataExtractor.extractPrice(cardElement);
      const priceBeforeEl = cardElement.querySelector('[data-next-price-before-discount]');
      priceBeforeDiscount = (priceBeforeEl instanceof HTMLElement
        ? ElementDataExtractor.extractPrice(priceBeforeEl)
        : undefined) || price;
      name = ElementDataExtractor.extractName(cardElement) || name;
    }

    const savings = priceBeforeDiscount - price;
    const savingsPercent = priceBeforeDiscount > 0
      ? (savings / priceBeforeDiscount) * 100
      : 0;

    const item: OfferPackageItem = {
      element: cardElement,
      offerPackageId: offerPackageId || `pkg-${packageId}`,
      packageId,
      quantity,
      badge,
      badgeType,
      isPreSelected,
      shippingId,
      price,
      priceBeforeDiscount,
      savings,
      savingsPercent,
      name
    };

    this.packages.push(item);

    // Set up click handler
    const clickHandler = (event: Event) => this.handlePackageClick(event, item);
    this.clickHandlers.set(cardElement, clickHandler);
    cardElement.addEventListener('click', clickHandler);

    // Add styling classes
    cardElement.classList.add('next-offer-package-card');

    if (badge && badgeType) {
      cardElement.classList.add(`next-badge-${badgeType}`);
    }

    // Add data attributes for CSS targeting
    cardElement.setAttribute('data-savings-percent', savingsPercent.toFixed(0));
    cardElement.setAttribute('data-package-quantity', quantity.toString());

    this.logger.debug('Registered offer package card:', {
      packageId,
      offerPackageId,
      quantity,
      badge,
      savings: savingsPercent.toFixed(0) + '%'
    });
  }

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute('data-next-offer-package-card')) {
                this.registerPackageCard(node);
              }

              const cards = node.querySelectorAll('[data-next-offer-package-card]');
              cards.forEach((card) => {
                if (card instanceof HTMLElement) {
                  this.registerPackageCard(card);
                }
              });
            }
          });

          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              this.handleCardRemoval(node);
            }
          });
        }
      });
    });

    this.mutationObserver.observe(this.element, {
      childList: true,
      subtree: true
    });
  }

  private handleCardRemoval(element: HTMLElement): void {
    const cardsToRemove: HTMLElement[] = [];

    if (element.hasAttribute('data-next-offer-package-card')) {
      cardsToRemove.push(element);
    }

    const childCards = element.querySelectorAll('[data-next-offer-package-card]');
    childCards.forEach((card) => {
      if (card instanceof HTMLElement) {
        cardsToRemove.push(card);
      }
    });

    cardsToRemove.forEach((cardElement) => {
      const itemIndex = this.packages.findIndex(pkg => pkg.element === cardElement);
      if (itemIndex !== -1) {
        const removedItem = this.packages[itemIndex];

        const handler = this.clickHandlers.get(cardElement);
        if (handler) {
          cardElement.removeEventListener('click', handler);
          this.clickHandlers.delete(cardElement);
        }

        this.packages.splice(itemIndex, 1);

        if (this.selectedPackage === removedItem) {
          this.selectedPackage = null;
        }

        this.logger.debug('Removed package card:', removedItem?.packageId);
      }
    });
  }

  private async handlePackageClick(event: Event, item: OfferPackageItem): Promise<void> {
    event.preventDefault();

    try {
      // If already selected, do nothing
      if (this.selectedPackage === item) {
        return;
      }

      const previousPackage = this.selectedPackage;

      // Select the new package
      this.selectPackage(item);

      // Emit events
      this.eventBus.emit('offer-package:selected', {
        offerId: this.offerId,
        packageId: item.packageId,
        offerPackageId: item.offerPackageId,
        previousPackageId: previousPackage?.packageId,
        mode: this.mode,
        savings: item.savingsPercent
      });

      // For swap mode, update cart immediately
      if (this.mode === 'swap') {
        await this.updateCart(previousPackage, item);

        // Handle shipping method if specified
        if (item.shippingId) {
          await this.setShippingMethod(item.shippingId);
        }
      }

    } catch (error) {
      this.handleError(error, 'handlePackageClick');
    }
  }

  private selectPackage(item: OfferPackageItem): void {
    // Clear previous selection
    this.packages.forEach(pkg => {
      pkg.element.classList.remove('next-selected', 'next-offer-selected');
      pkg.element.setAttribute('data-next-selected', 'false');
    });

    // Select new package
    item.element.classList.add('next-selected', 'next-offer-selected');
    item.element.setAttribute('data-next-selected', 'true');

    this.selectedPackage = item;

    // Store on element
    this.element.setAttribute('data-selected-package', item.packageId.toString());
    this.element.setAttribute('data-selected-offer-package', item.offerPackageId);

    this.logger.debug('Selected offer package:', {
      packageId: item.packageId,
      offerPackageId: item.offerPackageId,
      name: item.name,
      savings: item.savingsPercent.toFixed(0) + '%'
    });

    // Update slot visibility based on selected quantity
    this.updateSlotVisibility(item.quantity);

    // Emit event for other components
    this.emit('offer-package:selection-changed', {
      offerId: this.offerId,
      packageId: item.packageId,
      package: item
    });
  }

  /**
   * Shows/hides slot elements based on the selected package quantity.
   *
   * Finds all containers with [data-next-quantity-slots] that are either:
   * - Scoped to this offer via data-next-offer-id matching this enhancer's offerId
   * - Unscoped (no data-next-offer-id attribute), treated as global
   *
   * Within each container, [data-next-slot="N"] elements are shown when N <= quantity
   * and hidden otherwise.
   *
   * @example
   * <div data-next-quantity-slots data-next-offer-id="123">
   *   <div data-next-slot="1">Slot 1</div>
   *   <div data-next-slot="2">Slot 2</div>
   *   <div data-next-slot="3">Slot 3</div>
   * </div>
   */
  private updateSlotVisibility(quantity: number): void {
    const slotContainers: HTMLElement[] = [];

    // Find containers scoped to this offer ID
    if (this.offerId) {
      document
        .querySelectorAll(`[data-next-quantity-slots][data-next-offer-id="${this.offerId}"]`)
        .forEach(el => {
          if (el instanceof HTMLElement) slotContainers.push(el);
        });
    }

    // Find unscoped containers (no data-next-offer-id)
    document
      .querySelectorAll('[data-next-quantity-slots]:not([data-next-offer-id])')
      .forEach(el => {
        if (el instanceof HTMLElement) slotContainers.push(el);
      });

    slotContainers.forEach(container => {
      container.setAttribute('data-active-slots', quantity.toString());

      container.querySelectorAll('[data-next-slot]').forEach(slot => {
        if (!(slot instanceof HTMLElement)) return;

        const slotIndex = parseInt(slot.getAttribute('data-next-slot') || '0', 10);
        const visible = slotIndex <= quantity;

        slot.style.display = visible ? '' : 'none';
        slot.setAttribute('data-slot-visible', visible.toString());
      });
    });

    this.logger.debug('Updated slot visibility:', { quantity, containers: slotContainers.length });
  }

  private async updateCart(
    previousPackage: OfferPackageItem | null,
    selectedPackage: OfferPackageItem
  ): Promise<void> {
    const cartStore = useCartStore.getState();

    if (this.mode === 'swap') {
      // Find existing offer package in cart
      const existingCartItem = cartStore.items.find(cartItem => {
        return this.packages.some(pkg =>
          cartItem.packageId === pkg.packageId ||
          cartItem.originalPackageId === pkg.packageId
        );
      });

      if (existingCartItem && existingCartItem.packageId !== selectedPackage.packageId) {
        this.logger.debug(`Swapping offer package: ${existingCartItem.packageId} -> ${selectedPackage.packageId}`);
        await cartStore.swapPackage(existingCartItem.packageId, {
          packageId: selectedPackage.packageId,
          quantity: selectedPackage.quantity,
          isUpsell: false
        });
      } else if (!cartStore.hasItem(selectedPackage.packageId)) {
        this.logger.debug(`Adding offer package: ${selectedPackage.packageId}`);
        await cartStore.addItem({
          packageId: selectedPackage.packageId,
          quantity: selectedPackage.quantity,
          isUpsell: false
        });
      }
    }
  }

  private async setShippingMethod(shippingId: string): Promise<void> {
    try {
      const shippingIdNum = parseInt(shippingId, 10);

      if (isNaN(shippingIdNum)) {
        this.logger.error('Invalid shipping ID:', shippingId);
        return;
      }

      const cartStore = useCartStore.getState();
      await cartStore.setShippingMethod(shippingIdNum);

      this.logger.debug(`Shipping method ${shippingIdNum} set via offer selector`);
    } catch (error) {
      this.logger.error('Failed to set shipping method:', error);
    }
  }

  private syncWithCart(cartState: CartState): void {
    try {
      // Update card states based on cart
      this.packages.forEach(pkg => {
        const cartItem = cartState.items.find(cartItem =>
          cartItem.originalPackageId === pkg.packageId ||
          cartItem.packageId === pkg.packageId
        );

        const isInCart = !!cartItem;
        pkg.element.classList.toggle('next-in-cart', isInCart);
        pkg.element.setAttribute('data-next-in-cart', isInCart.toString());
      });

      // Find which package should be selected based on cart
      const cartPackagesInOffer = this.packages.filter(pkg =>
        cartState.items.some(cartItem =>
          cartItem.originalPackageId === pkg.packageId ||
          cartItem.packageId === pkg.packageId
        )
      );

      if (cartPackagesInOffer.length > 0 && this.mode === 'swap') {
        const pkgToSelect = cartPackagesInOffer[0];
        if (pkgToSelect && this.selectedPackage !== pkgToSelect) {
          this.selectPackage(pkgToSelect);
        }
      } else if (!this.selectedPackage) {
        // No selection yet - find pre-selected or select first
        const preSelected = this.packages.find(pkg => pkg.isPreSelected);

        if (preSelected) {
          this.selectPackage(preSelected);

          if (this.mode !== 'select' && cartState.isEmpty) {
            this.updateCart(null, preSelected)
              .then(() => {
                if (preSelected.shippingId) {
                  this.setShippingMethod(preSelected.shippingId);
                }
              })
              .catch(error => {
                this.logger.error('Failed to add pre-selected package:', error);
              });
          }
        }
      }

    } catch (error) {
      this.handleError(error, 'syncWithCart');
    }
  }

  private selectBestDeal(): void {
    if (this.packages.length === 0) return;

    // Find package with highest savings percentage
    const bestDeal = this.packages.reduce((best, current) => {
      return current.savingsPercent > best.savingsPercent ? current : best;
    }, this.packages[0]!);

    if (bestDeal) {
      this.selectPackage(bestDeal);
      this.logger.debug('Auto-selected best deal:', {
        packageId: bestDeal.packageId,
        savings: bestDeal.savingsPercent.toFixed(0) + '%'
      });
    }
  }

  public update(): void {
    this.syncWithCart(useCartStore.getState());
  }

  public getSelectedPackage(): OfferPackageItem | null {
    return this.selectedPackage;
  }

  public getPackages(): OfferPackageItem[] {
    return this.packages;
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((handler, element) => {
      element.removeEventListener('click', handler);
    });
    this.clickHandlers.clear();

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  public override destroy(): void {
    this.cleanupEventListeners();

    this.packages.forEach(pkg => {
      pkg.element.classList.remove(
        'next-offer-package-card',
        'next-selected',
        'next-offer-selected',
        'next-in-cart'
      );
    });

    super.destroy();
  }
}

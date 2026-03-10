/**
 * Debug Overlay - Main controller for debug utilities
 * 
 * Provides a comprehensive debugging interface when ?debug=true is present
 * in the URL. Features cart state inspection, store monitoring, and more.
 */

import { Logger } from '../logger';
import { DebugEventManager } from './DebugEventManager';
import { EnhancedDebugUI } from './EnhancedDebugUI';
import { useCartStore } from '../../stores/cartStore';
import { useConfigStore } from '../../stores/configStore';
import { XrayManager } from './XrayStyles';
import { selectorContainer } from './SelectorContainer';
import { upsellSelector } from './UpsellSelector';
import { formatCurrency } from '../currencyFormatter';
import {
  CartPanel,
  OrderPanel,
  EventTimelinePanel,
  ConfigPanel,
  CheckoutPanel,
  StoragePanel,
  EnhancedCampaignPanel,
  DebugPanel
} from './panels';

export class DebugOverlay {
  private static instance: DebugOverlay;
  private visible = false;
  private isExpanded = false;
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private activePanel = 'cart';
  private activePanelTab: string | undefined;
  private updateInterval: number | null = null;
  private logger = new Logger('DebugOverlay');

  private eventManager: DebugEventManager | null = null;
  private panels: DebugPanel[] = [];

  // Storage keys
  private static readonly EXPANDED_STORAGE_KEY = 'debug-overlay-expanded';
  private static readonly ACTIVE_PANEL_KEY = 'debug-overlay-active-panel';
  private static readonly ACTIVE_TAB_KEY = 'debug-overlay-active-tab';

  public static getInstance(): DebugOverlay {
    if (!DebugOverlay.instance) {
      DebugOverlay.instance = new DebugOverlay();
    }
    return DebugOverlay.instance;
  }

  private constructor() {
    // Only initialize if debug mode is enabled
    const urlParams = new URLSearchParams(window.location.search);
    const windowConfig = (window as any).nextConfig;
    const isDebugMode = urlParams.get('debugger') === 'true' || urlParams.get('debug') === 'true' || windowConfig?.debugger === true || windowConfig?.debug === true;

    if (isDebugMode) {
      this.eventManager = new DebugEventManager();
      this.initializePanels();
      this.setupEventListeners();

      // Restore saved state from localStorage
      const savedExpandedState = localStorage.getItem(DebugOverlay.EXPANDED_STORAGE_KEY);
      if (savedExpandedState === 'true') {
        this.isExpanded = true;
      }

      // Restore active panel
      const savedPanel = localStorage.getItem(DebugOverlay.ACTIVE_PANEL_KEY);
      if (savedPanel) {
        this.activePanel = savedPanel;
      }

      // Restore active tab
      const savedTab = localStorage.getItem(DebugOverlay.ACTIVE_TAB_KEY);
      if (savedTab) {
        this.activePanelTab = savedTab;
      }
    }
  }

  private initializePanels(): void {
    this.panels = [
      new CartPanel(),
      new OrderPanel(),
      new ConfigPanel(),
      new EnhancedCampaignPanel(),
      new CheckoutPanel(),
      new EventTimelinePanel(),
      new StoragePanel()
    ];
  }

  private setupEventListeners(): void {
    // Listen for content updates
    document.addEventListener('debug:update-content', () => {
      this.updateContent();
    });

    // Listen for new events being added
    document.addEventListener('debug:event-added', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { panelId } = customEvent.detail;

      // Debug logging
      console.log('[Debug] Event added:', panelId, 'Active panel:', this.activePanel, 'Expanded:', this.isExpanded);

      // Only update if the event panel is currently active
      if (this.activePanel === panelId && this.isExpanded) {
        // For the events panel, always update regardless of input focus
        // since it's read-only content and won't disrupt user input
        console.log('[Debug] Updating content for events panel (forced update)');
        this.updateContent();
      }
    });
  }

  public initialize(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const windowConfig = (window as any).nextConfig;
    const isDebugMode = urlParams.get('debugger') === 'true' || windowConfig?.debugger === true;

    if (isDebugMode) {
      this.show();
      this.logger.info('Debug overlay initialized');

      // Initialize selector container with currency, country, and locale selectors
      selectorContainer.initialize();
      this.logger.info('Selector container initialized');

      // Initialize upsell selector (overlays directly on upsell elements)
      upsellSelector.initialize();
      this.logger.info('Upsell selector initialized');

      // Test components in development
      if (import.meta.env && import.meta.env.DEV) {

      }
    }
  }

  public async show(): Promise<void> {
    if (this.visible) return;

    this.visible = true;
    await this.createOverlay();
    this.startAutoUpdate();

    // Initialize XrayManager with saved state
    XrayManager.initialize();

    // Auto-restore mini cart if it was previously visible
    const savedMiniCartState = localStorage.getItem('debug-mini-cart-visible');
    if (savedMiniCartState === 'true') {
      // Create mini cart and show it based on saved state
      this.toggleMiniCart(true);
    }

    // Update button states after everything is rendered
    this.updateButtonStates();
  }

  public hide(): void {
    if (!this.visible) return;

    this.visible = false;
    this.stopAutoUpdate();

    // Remove body height adjustment
    document.body.classList.remove('debug-body-expanded');
    document.documentElement.classList.remove('debug-body-expanded');

    // Destroy selector container
    selectorContainer.destroy();

    // Destroy upsell selector
    upsellSelector.destroy();

    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }

  public async toggle(): Promise<void> {
    if (this.visible) {
      this.hide();
    } else {
      await this.show();
    }
  }

  public isVisible(): boolean {
    return this.visible;
  }

  private async createOverlay(): Promise<void> {
    // Create host container
    this.container = document.createElement('div');
    this.container.id = 'next-debug-overlay-host';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Create Shadow DOM
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Load and inject styles into Shadow DOM
    await this.injectShadowStyles();

    // Create overlay container inside shadow DOM
    const overlayContainer = document.createElement('div');
    overlayContainer.className = 'debug-overlay';
    overlayContainer.style.pointerEvents = 'auto';

    this.shadowRoot.appendChild(overlayContainer);

    // Render initial content
    this.updateOverlay();

    // Add event listeners
    this.addEventListeners();

    document.body.appendChild(this.container);
  }

  private async injectShadowStyles(): Promise<void> {
    if (!this.shadowRoot) return;

    // Load debug styles
    const { DebugStyleLoader } = await import('./DebugStyleLoader');
    const styles = await DebugStyleLoader.getDebugStyles();

    // Create style element in shadow DOM
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    this.shadowRoot.appendChild(styleElement);

    // Add reset styles to prevent inheritance
    const resetStyles = document.createElement('style');
    resetStyles.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      * {
        box-sizing: border-box;
      }
      
      /* Ensure debug overlay is always on top */
      .debug-overlay {
        position: fixed;
        z-index: 2147483647;
      }
    `;
    this.shadowRoot.appendChild(resetStyles);
  }

  private updateOverlay(): void {
    if (!this.shadowRoot) return;

    const overlayContainer = this.shadowRoot.querySelector('.debug-overlay');
    if (!overlayContainer) return;

    overlayContainer.innerHTML = EnhancedDebugUI.createOverlayHTML(
      this.panels,
      this.activePanel,
      this.isExpanded,
      this.activePanelTab
    );

    this.addEventListeners();

    // Restore button states
    this.updateButtonStates();
  }

  private updateContent(): void {
    if (!this.shadowRoot) return;

    const panelContent = this.shadowRoot.querySelector('.panel-content');
    if (panelContent) {
      const activePanel = this.panels.find(p => p.id === this.activePanel);
      if (activePanel) {
        const tabs = activePanel.getTabs?.() || [];
        if (tabs.length > 0) {
          // Panel has horizontal tabs - get content from active tab
          const activeTabId = this.activePanelTab || tabs[0]?.id;
          const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
          if (activeTab) {
            panelContent.innerHTML = activeTab.getContent();
          }
        } else {
          // Panel doesn't have horizontal tabs - use regular content
          panelContent.innerHTML = activePanel.getContent();
        }
      }
    }
  }

  private addEventListeners(): void {
    if (!this.shadowRoot) return;

    // Remove any existing listeners to prevent duplicates
    this.shadowRoot.removeEventListener('click', this.handleContainerClick);
    this.shadowRoot.removeEventListener('mouseover', this.handleContainerHover);

    // Use event delegation for all debug actions
    this.shadowRoot.addEventListener('click', this.handleContainerClick);
    this.shadowRoot.addEventListener('mouseover', this.handleContainerHover);
  }

  private handleContainerClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action') || target.closest('[data-action]')?.getAttribute('data-action');

    // Handle main debug actions
    if (action) {
      console.log('[Debug] Action clicked:', action);
      switch (action) {
        case 'toggle-expand':
          this.isExpanded = !this.isExpanded;
          // Save expanded state to localStorage
          localStorage.setItem(DebugOverlay.EXPANDED_STORAGE_KEY, this.isExpanded.toString());
          this.updateBodyHeight();
          this.updateOverlay();
          // Emit event for selector container
          document.dispatchEvent(new CustomEvent('debug:panel-toggled', {
            detail: { isExpanded: this.isExpanded }
          }));
          break;
        case 'close':
          this.hide();
          break;
        case 'clear-cart':
          this.clearCart();
          break;
        case 'export-data':
          this.exportAllData();
          break;
        case 'toggle-mini-cart':
          this.toggleMiniCart();
          break;
        case 'toggle-xray':
          this.toggleXray();
          break;
        case 'close-mini-cart':
          this.closeMiniCart();
          break;
        case 'toggle-internal-events':
          // Toggle internal events for the Events panel
          const eventPanel = this.panels.find(p => p.id === 'event-timeline') as any;
          if (eventPanel && eventPanel.toggleInternalEvents) {
            eventPanel.toggleInternalEvents();
            this.updateContent();
          }
          break;
      }
      return;
    }

    // Handle panel tab switching
    const panelTab = target.closest('.debug-panel-tab') as HTMLElement;
    if (panelTab) {
      const panelId = panelTab.getAttribute('data-panel');
      console.log('[Debug] Panel switch:', this.activePanel, '->', panelId);
      if (panelId && panelId !== this.activePanel) {
        this.activePanel = panelId;
        this.activePanelTab = undefined; // Reset horizontal tab when switching panels

        // Save to localStorage
        localStorage.setItem(DebugOverlay.ACTIVE_PANEL_KEY, panelId);
        localStorage.removeItem(DebugOverlay.ACTIVE_TAB_KEY); // Clear tab when switching panels

        this.updateOverlay();
      }
      return;
    }

    // Handle horizontal tab switching within panels
    const horizontalTab = target.closest('.horizontal-tab') as HTMLElement;
    if (horizontalTab) {
      const tabId = horizontalTab.getAttribute('data-panel-tab');
      console.log('[Debug] Horizontal tab switch:', this.activePanelTab, '->', tabId, 'in panel:', this.activePanel);
      if (tabId && tabId !== this.activePanelTab) {
        this.activePanelTab = tabId;

        // Save to localStorage
        localStorage.setItem(DebugOverlay.ACTIVE_TAB_KEY, tabId);

        this.updateOverlay();
      }
      return;
    }

    // Handle panel action buttons
    const panelActionBtn = target.closest('.panel-action-btn') as HTMLElement;
    if (panelActionBtn) {
      const actionLabel = panelActionBtn.getAttribute('data-panel-action');
      const activePanel = this.panels.find(p => p.id === this.activePanel);
      const panelAction = activePanel?.getActions?.()?.find(a => a.label === actionLabel);

      if (panelAction) {
        panelAction.action();
        // Update content after action
        setTimeout(() => this.updateContent(), 100);
      }
      return;
    }
  };

  private handleContainerHover = (event: Event) => {
    const target = event.target as HTMLElement;
    const miniCartItem = target.closest('.debug-mini-cart-item');

    if (miniCartItem) {
      const detailsCard = miniCartItem.querySelector('.mini-cart-discount-details-card') as HTMLElement;
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
    const miniCartTotals = target.closest('.debug-mini-cart-totals.has-cart-discounts');
    if (miniCartTotals) {
      const cartDiscountPopup = miniCartTotals.querySelector('.mini-cart-cart-discount-popup .mini-cart-discount-details-card') as HTMLElement;
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
  };

  private updateBodyHeight(): void {
    if (this.isExpanded) {
      document.body.classList.add('debug-body-expanded');
      document.documentElement.classList.add('debug-body-expanded');
    } else {
      document.body.classList.remove('debug-body-expanded');
      document.documentElement.classList.remove('debug-body-expanded');
    }
  }

  private startAutoUpdate(): void {
    this.updateInterval = window.setInterval(() => {
      // Only update quick stats, not the full content to avoid losing focus
      this.updateQuickStats();

      // Only update content for specific panels that need real-time updates
      // Skip updates if viewing raw data tab to prevent constant re-renders
      if ((this.activePanel === 'cart' || this.activePanel === 'config' || this.activePanel === 'campaign') && this.activePanelTab !== 'raw') {
        this.updateContent();
      }
    }, 1000);
  }

  private stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Public API for external access
  public getEventManager(): DebugEventManager | null {
    return this.eventManager || null;
  }

  public getPanels(): DebugPanel[] {
    return this.panels || [];
  }

  public setActivePanel(panelId: string): void {
    if (this.panels.find(p => p.id === panelId)) {
      this.activePanel = panelId;

      // Save to localStorage
      localStorage.setItem(DebugOverlay.ACTIVE_PANEL_KEY, panelId);

      this.updateOverlay();
    }
  }

  public logEvent(type: string, data: any, source: string = 'Manual'): void {
    if (this.eventManager) {
      this.eventManager.logEvent(type, data, source);
    }
  }

  // Enhanced debug methods for global access
  private clearCart(): void {
    useCartStore.getState().clear();
    this.updateContent();
  }

  private exportAllData(): void {
    const debugData = {
      timestamp: new Date().toISOString(),
      cart: useCartStore.getState(),
      config: useConfigStore.getState(),
      events: this.eventManager ? this.eventManager.getEvents() : [],
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    const data = JSON.stringify(debugData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-session-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private closeMiniCart(): void {
    if (!this.shadowRoot) return;
    const miniCart = this.shadowRoot.querySelector('#debug-mini-cart-display') as HTMLDivElement;
    if (miniCart) {
      miniCart.classList.remove('show');
      localStorage.setItem('debug-mini-cart-visible', 'false');

      // Update button state
      const cartButton = this.shadowRoot.querySelector('[data-action="toggle-mini-cart"]');
      if (cartButton) {
        cartButton.classList.remove('active');
        cartButton.setAttribute('title', 'Toggle Mini Cart');
      }
    }
  }

  private toggleMiniCart(forceShow?: boolean): void {
    if (!this.shadowRoot) return;

    let miniCart = this.shadowRoot.querySelector('#debug-mini-cart-display') as HTMLDivElement;

    if (!miniCart) {
      // Create mini cart if it doesn't exist
      miniCart = document.createElement('div');
      miniCart.id = 'debug-mini-cart-display';
      miniCart.className = 'debug-mini-cart-display';
      this.shadowRoot.appendChild(miniCart);

      // Subscribe to cart changes for real-time updates
      useCartStore.subscribe(() => {
        const cart = this.shadowRoot?.querySelector('#debug-mini-cart-display');
        if (cart && cart.classList.contains('show')) {
          this.updateMiniCart();
        }
      });

      // When creating for the first time via button click (not auto-restore), show it
      if (forceShow !== false) {
        miniCart.classList.add('show');
        this.updateMiniCart();
      }
    } else {
      // Toggle visibility
      miniCart.classList.toggle('show');

      // Update content if showing
      if (miniCart.classList.contains('show')) {
        this.updateMiniCart();
      }
    }

    // Save state to localStorage
    localStorage.setItem('debug-mini-cart-visible', miniCart.classList.contains('show').toString());

    // Update cart button state - use shadowRoot!
    const cartButton = this.shadowRoot?.querySelector('[data-action="toggle-mini-cart"]');
    if (cartButton && miniCart) {
      if (miniCart.classList.contains('show')) {
        cartButton.classList.add('active');
        cartButton.setAttribute('title', 'Hide Mini Cart');
      } else {
        cartButton.classList.remove('active');
        cartButton.setAttribute('title', 'Toggle Mini Cart');
      }
    }
  }

  private updateMiniCart(): void {
    if (!this.shadowRoot) return;
    const miniCart = this.shadowRoot.querySelector('#debug-mini-cart-display') as HTMLDivElement;
    if (!miniCart || !miniCart.classList.contains('show')) return;

    const cartState = useCartStore.getState();

    if (!cartState.items || cartState.items.length === 0) {
      miniCart.innerHTML = `
        <div class="debug-mini-cart-header">
          <span>🛒 Debug Cart</span>
          <button class="mini-cart-close" data-action="close-mini-cart">×</button>
        </div>
        <div class="debug-mini-cart-empty">Cart empty</div>
      `;
      return;
    }

    let itemsHtml = '';
    let subtotalBeforeDiscounts = 0;

    cartState.items.forEach(item => {
      // Check for upsell flag
      const isUpsell = item.is_upsell;
      const upsellBadge = isUpsell ? '<span class="mini-cart-upsell-badge">UPSELL</span>' : '';

      // Calculate pricing
      const packagePriceExcl = item.package_price_excl_discount ? parseFloat(item.package_price_excl_discount) : 0;
      const packagePriceIncl = item.package_price_incl_discount ? parseFloat(item.package_price_incl_discount) : item.price;

      // Check if item has a discount applied (comparing package prices)
      const itemHasDiscount = packagePriceExcl > 0 && packagePriceIncl < packagePriceExcl;

      // For display: use the DISCOUNTED price (incl) as the current price
      const currentUnitPrice = packagePriceIncl;
      const originalUnitPrice = packagePriceExcl > 0 ? packagePriceExcl : packagePriceIncl;

      // Line totals
      const currentLineTotal = currentUnitPrice * item.quantity;
      const originalLineTotal = originalUnitPrice * item.quantity;

      // Add CURRENT (discounted) price to running subtotal for clarity
      subtotalBeforeDiscounts += currentLineTotal;

      // Build savings text (show total savings on this line)
      const itemLineSavings = itemHasDiscount ? originalLineTotal - currentLineTotal : 0;
      const savingsPercent = itemHasDiscount ? Math.round(((originalUnitPrice - currentUnitPrice) / originalUnitPrice) * 100) : 0;

      // Build discount details hover card
      let discountDetailsCard = '';

      // Collect discount information from various sources
      const discountList: string[] = [];

      // Check for item.discounts array
      if (item.discounts && item.discounts.length > 0) {
        item.discounts.forEach(d => {
          const discountName = d.description || d.description || `Offer #${d.offer_id}`;
          discountList.push(discountName + ' ' + d.amount);
        });
      }

      // Only show hover card if we have discount info or item has discount pricing
      if (itemHasDiscount || (item.discounts && item.discounts.length > 0)) {
        let discountItemsHtml = '';

        if (item.discounts && item.discounts.length > 0) {
          discountItemsHtml = item.discounts.map(d => `
            <li class="discount-card-item">
              <span class="discount-card-bullet">•</span>
              <span style="display: flex; justify-content: space-between; width: 100%;">
                <span class="discount-card-text">${d.description}</span>
                <span class="discount-card-text" style="text-align: right;">${formatCurrency(parseFloat(d.amount))}</span>
              </span>
            </li>
          `).join('');
        } else {
          // Show a generic message if we detect discount but no details
          discountItemsHtml = `
            <li class="discount-card-item">
              <span class="discount-card-bullet">•</span>
              <span class="discount-card-text">Price discount applied (${savingsPercent}% off)</span>
            </li>
          `;
        }

        discountDetailsCard = `
          <div class="mini-cart-discount-details-card">
            <div class="discount-card-header">
              <span class="discount-card-icon">🎯</span>
              <span class="discount-card-title">Applied Discounts</span>
            </div>
            <ul class="discount-card-list">${discountItemsHtml}</ul>
          </div>
        `;
      }

      // Build pricing display
      let pricingHtml = '';
      if (itemHasDiscount) {
        pricingHtml = `
          <div class="mini-cart-price-details">
            <span class="mini-cart-original-price">${formatCurrency(originalUnitPrice)} each</span>
            <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each</span>
          </div>
          <div class="mini-cart-line-total">${formatCurrency(currentLineTotal)}</div>
        `;
      } else {
        pricingHtml = `
          <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each</span>
          <div class="mini-cart-line-total">${formatCurrency(currentLineTotal)}</div>
        `;
      }

      itemsHtml += `
        <div class="debug-mini-cart-item${itemHasDiscount ? ' has-discount' : ''}">
          ${discountDetailsCard}
          <div class="mini-cart-item-header">
            <div class="mini-cart-item-title-row">
              <div class="mini-cart-item-title">${item.title || 'Unknown'}</div>
              <div class="mini-cart-line-total">${formatCurrency(currentLineTotal)}</div>
            </div>
            <div class="mini-cart-item-meta">
              <span class="mini-cart-item-id">ID: ${item.packageId}</span>
              ${upsellBadge}
            </div>
          </div>
          ${itemHasDiscount ? `
            <div class="mini-cart-item-price-breakdown">
              <div class="mini-cart-price-row">
                <span class="mini-cart-price-label">Was</span>
                <span class="mini-cart-original-price">${formatCurrency(originalUnitPrice)} each</span>
              </div>
              <div class="mini-cart-price-row mini-cart-sale-row">
                <span class="mini-cart-price-label">Now</span>
                <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each × ${item.quantity}</span>
              </div>
              <div class="mini-cart-price-row mini-cart-savings-row">
                <span class="mini-cart-price-label">You save</span>
                <span class="mini-cart-savings-amount">${formatCurrency(itemLineSavings)} (${savingsPercent}% off)</span>
              </div>
            </div>
          ` : `
            <div class="mini-cart-item-price-breakdown">
              <div class="mini-cart-price-row">
                <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each × ${item.quantity}</span>
              </div>
            </div>
          `}
        </div>
      `;
    });

    // Build totals breakdown - use calculated subtotal before discounts
    const totalDiscount = cartState.totals.discounts.value;
    const shipping = cartState.totals.shipping.value;
    const shippingDiscount = cartState.totals.shippingDiscount.value;
    // If there's a shipping discount, the API returns net shipping, so we need to show original shipping
    const displayShipping = shippingDiscount > 0 ? shipping + shippingDiscount : shipping;
    const shippingLabel = displayShipping === 0 ? 'FREE' : formatCurrency(displayShipping);
    const total = cartState.totals.total.value;

    // Collect all item-level discount offer_ids to avoid showing them twice
    const itemLevelOfferIds = new Set<number>();
    cartState.items.forEach(item => {
      if (item.discounts) {
        item.discounts.forEach(d => itemLevelOfferIds.add(d.offer_id));
      }
    });

    // Build detailed discount breakdown for cart-level offers and vouchers
    let hasCartLevelDiscounts = false;
    let cartLevelDiscountList: Array<{ type: 'offer' | 'voucher'; label: string; amount: number }> = [];

    if (cartState.discountDetails) {
      const { offerDiscounts, voucherDiscounts } = cartState.discountDetails;
      console.log(offerDiscounts)
      console.log(voucherDiscounts)

      // Collect offer discounts ONLY if they're not already shown on line items
      // Cart-wide offers that apply to multiple items or the cart total should appear here
      if (offerDiscounts && offerDiscounts.length > 0) {
        offerDiscounts.forEach(discount => {
          const label = discount.name || discount.description || `Offer #${discount.offer_id}`;
          const amount = parseFloat(discount.amount);
          cartLevelDiscountList.push({ type: 'offer', label, amount });
        });
      }

      // Collect voucher discounts (these are always cart-level)
      if (voucherDiscounts && voucherDiscounts.length > 0) {
        hasCartLevelDiscounts = true;
        voucherDiscounts.forEach(discount => {
          const amount = parseFloat(discount.amount);
          const label = discount.name || discount.description || 'Voucher';
          cartLevelDiscountList.push({ type: 'voucher', label, amount });
        });
      }
    } else if (totalDiscount > 0) {
      // Fallback: show single discount row if no details available
      hasCartLevelDiscounts = true;
      cartLevelDiscountList.push({ type: 'offer', label: 'Discount', amount: totalDiscount });
    }

    console.log(cartLevelDiscountList)

    // Build cart-level discount popup (similar to item discount popup)
    let cartDiscountPopup = '';
    if (hasCartLevelDiscounts) {
      const discountItemsHtml = cartLevelDiscountList.map(discount => `
        <li class="discount-card-item">
          <span class="discount-card-bullet">•</span>
          <span style="display: flex; justify-content: space-between; width: 100%; gap: 8px;">
            <span class="discount-card-text">
              <span class="mini-cart-discount-type">${discount.type.toUpperCase()}</span> ${discount.label}
            </span>
            <span class="discount-card-text" style="text-align: right;">-${formatCurrency(discount.amount)}</span>
          </span>
        </li>
      `).join('');

      cartDiscountPopup = `
        <div class="mini-cart-cart-discount-popup">
          <div class="mini-cart-discount-details-card">
            <div class="discount-card-header">
              <span class="discount-card-icon">🎁</span>
              <span class="discount-card-title">Discounts</span>
            </div>
            <ul class="discount-card-list">${discountItemsHtml}</ul>
          </div>
        </div>
      `;
    }

    // Build shipping row with savings (inline format)
    let shippingRow = '';
    if (shippingDiscount > 0) {
      // Show shipping with original price strikethrough and discounted price
      shippingRow = `
        <div class="mini-cart-total-row mini-cart-shipping-row has-discount">
          <span>Shipping:</span>
          <span class="mini-cart-shipping-prices">
            <span class="mini-cart-original-price">${formatCurrency(displayShipping)}</span>
            <span class="mini-cart-shipping">${formatCurrency(shipping)}</span>
          </span>
        </div>
      `;
    } else {
      // Regular shipping row
      shippingRow = `
        <div class="mini-cart-total-row">
          <span>Shipping:</span>
          <span class="mini-cart-shipping">${shippingLabel}</span>
        </div>
      `;
    }

    miniCart.innerHTML = `
      <div class="debug-mini-cart-header">
        <span>🛒 Debug Cart</span>
        <button class="mini-cart-close" data-action="close-mini-cart">×</button>
      </div>
      <div class="debug-mini-cart-items">${itemsHtml}</div>
      <div class="debug-mini-cart-totals${hasCartLevelDiscounts ? ' has-cart-discounts' : ''}">
        ${cartDiscountPopup}
        <div class="mini-cart-total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotalBeforeDiscounts)}</span>
        </div>
        ${shippingRow}
        <div class="mini-cart-total-row mini-cart-final-total">
          <span>Total:</span>
          <span class="mini-cart-total">${formatCurrency(total)}</span>
        </div>
      </div>
      <div class="debug-mini-cart-footer">
        <div class="mini-cart-stat">
          <span>Items:</span>
          <span>${cartState.totalQuantity}</span>
        </div>
      </div>
    `;
  }


  private toggleXray(): void {
    const isActive = XrayManager.toggle();

    // Update button state - use shadowRoot not container!
    const xrayButton = this.shadowRoot?.querySelector('[data-action="toggle-xray"]');
    if (xrayButton) {
      if (isActive) {
        xrayButton.classList.add('active');
        xrayButton.setAttribute('title', 'Disable X-Ray View');
      } else {
        xrayButton.classList.remove('active');
        xrayButton.setAttribute('title', 'Toggle X-Ray View');
      }
    }

    // Log event
    if (this.eventManager) {
      this.eventManager.logEvent('debug:xray-toggled', { active: isActive }, 'Debug');
    }
  }

  private updateButtonStates(): void {
    if (!this.shadowRoot) return;

    // Update X-ray button state
    const xrayButton = this.shadowRoot.querySelector('[data-action="toggle-xray"]');
    if (xrayButton) {
      if (XrayManager.isXrayActive()) {
        xrayButton.classList.add('active');
        xrayButton.setAttribute('title', 'Disable X-Ray View');
      } else {
        xrayButton.classList.remove('active');
        xrayButton.setAttribute('title', 'Toggle X-Ray View');
      }
    }

    // Update mini cart button state
    const miniCart = this.shadowRoot.querySelector('#debug-mini-cart-display');
    const cartButton = this.shadowRoot.querySelector('[data-action="toggle-mini-cart"]');
    if (cartButton) {
      if (miniCart && miniCart.classList.contains('show')) {
        cartButton.classList.add('active');
        cartButton.setAttribute('title', 'Hide Mini Cart');
      } else {
        cartButton.classList.remove('active');
        cartButton.setAttribute('title', 'Toggle Mini Cart');
      }
    }
  }

  public updateQuickStats(): void {
    if (!this.shadowRoot) return;

    const cartState = useCartStore.getState();

    // Update cart stats
    const cartItemsEl = this.shadowRoot.querySelector('[data-debug-stat="cart-items"]');
    const cartTotalEl = this.shadowRoot.querySelector('[data-debug-stat="cart-total"]');
    const enhancedElementsEl = this.shadowRoot.querySelector('[data-debug-stat="enhanced-elements"]');

    if (cartItemsEl) cartItemsEl.textContent = cartState.totalQuantity.toString();
    if (cartTotalEl) cartTotalEl.textContent = cartState.totals.total.formatted;
    if (enhancedElementsEl) enhancedElementsEl.textContent = document.querySelectorAll('[data-next-]').length.toString();
  }
}

// Global instance
export const debugOverlay = DebugOverlay.getInstance();

// Auto-initialize if debug mode
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    debugOverlay.initialize();
  });
}
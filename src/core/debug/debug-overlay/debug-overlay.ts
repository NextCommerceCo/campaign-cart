/**
 * Debug Overlay - Main controller for debug utilities
 *
 * Provides a comprehensive debugging interface when ?debug=true is present
 * in the URL. Features cart state inspection, store monitoring, and more.
 */

import { Logger } from '../../logger';
import { DebugEventManager } from '../debug-event-manager';
import { EnhancedDebugUI } from '../enhanced-debug-ui';
import { useCartStore, cartOperations } from '@/state/cart';
import { useConfigStore } from '@/state/config';
import { XrayManager } from '../xray-styles';
import { selectorContainer } from '../selector-container';
import { upsellSelector } from '../upsell-selector';
import { formatCurrency } from '@/core/currency-formatter';
import { analyticsDebug } from '@/core/analytics/debug/analytics-debug-tracker';
import {
  CartPanel,
  OrderPanel,
  EventTimelinePanel,
  ConfigPanel,
  CheckoutPanel,
  StoragePanel,
  OffersPanel,
  EnhancedCampaignPanel,
  DebugPanel,
  RawDataHelper
} from '../panels';
import type { MiniCartHost } from './debug-overlay.types';
import {
  closeMiniCart as closeMiniCartImpl,
  toggleMiniCart as toggleMiniCartImpl,
  updateMiniCart as updateMiniCartImpl,
} from './debug-overlay.mini-cart';

export class DebugOverlay {
  private static instance: DebugOverlay;
  private visible = false;
  private isExpanded = false;
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private activePanel = 'cart';
  private activePanelTab: string | undefined;
  private updateInterval: number | null = null;
  /** Unsubscribe from the analytics delivery tracker (event-driven refresh). */
  private analyticsDebugUnsub: (() => void) | null = null;
  /** Pending coalesced refresh for the provider panels. */
  private providerRefreshTimer: number | null = null;
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
      new OffersPanel(),
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

      // Only update if the event panel is currently active
      if (this.activePanel === panelId && this.isExpanded) {
        // For the events panel, always update regardless of input focus
        // since it's read-only content and won't disrupt user input
        this.updateContent();
      }
    });

    // The Analytics panel shows provider delivery alongside the event timeline.
    // Deliveries arrive asynchronously after the dataLayer event (e.g. Facebook
    // resolves once fbq loads), so re-render when the delivery tracker changes —
    // event-driven, not on the 1-second poll. The tracker fires once per provider
    // per event, so the refresh is coalesced into a single render below.
    this.analyticsDebugUnsub?.();
    this.analyticsDebugUnsub = analyticsDebug.subscribe(() => {
      this.scheduleAnalyticsPanelRefresh();
    });
  }

  /**
   * Coalesce a burst of tracker notifications (one per provider per event) into
   * a single re-render on the next tick, and only when the Analytics panel is
   * the active, expanded view.
   */
  private scheduleAnalyticsPanelRefresh(): void {
    if (this.providerRefreshTimer !== null) return;
    this.providerRefreshTimer = window.setTimeout(() => {
      this.providerRefreshTimer = null;
      if (!this.isExpanded) return;
      if (this.activePanel === 'event-timeline') {
        this.updateContent();
      }
    }, 80);
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
    const { DebugStyleLoader } = await import('../debug-style-loader');
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

    RawDataHelper.bindCopyHandlers(overlayContainer);
    this.addEventListeners();

    // Restore button states
    this.updateButtonStates();
  }

  private updateContent(): void {
    if (!this.shadowRoot) return;

    const panelContent = this.shadowRoot.querySelector('.panel-content');
    if (!panelContent) return;
    const activePanel = this.panels.find(p => p.id === this.activePanel);
    if (!activePanel) return;

    // A panel that re-renders on every keystroke (e.g. the Analytics search
    // box) would otherwise lose focus and caret position. Capture them before
    // swapping innerHTML and restore afterwards.
    const focused = this.shadowRoot.activeElement as HTMLInputElement | null;
    const search =
      focused && focused.matches?.('[data-debug-search]')
        ? { start: focused.selectionStart, end: focused.selectionEnd }
        : null;

    const tabs = activePanel.getTabs?.() || [];
    if (tabs.length > 0) {
      // Panel has horizontal tabs - get content from active tab
      const activeTabId = this.activePanelTab || tabs[0]?.id;
      const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
      if (activeTab) {
        panelContent.innerHTML = activeTab.getContent();
        RawDataHelper.bindCopyHandlers(panelContent);
      }
    } else {
      // Panel doesn't have horizontal tabs - use regular content
      panelContent.innerHTML = activePanel.getContent();
      RawDataHelper.bindCopyHandlers(panelContent);
    }

    if (search) {
      const input = panelContent.querySelector<HTMLInputElement>(
        '[data-debug-search]'
      );
      if (input) {
        input.focus();
        const end = input.value.length;
        try {
          input.setSelectionRange(search.start ?? end, search.end ?? end);
        } catch {
          // Some input types don't support selection ranges; focus is enough.
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
      this.handleDebugAction(action);
      return;
    }

    // Handle panel and horizontal tab switching
    if (this.handleTabSwitch(target)) return;

    this.runPanelAction(target);
  };

  /** One of the `data-action` buttons in the overlay chrome was clicked. */
  private handleDebugAction(action: string): void {
    this.logger.debug('[Debug] Action clicked:', action);
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
  }

  /**
   * Switches the vertical panel or the horizontal tab inside it.
   * Returns true when the click was one of those, so the caller stops.
   */
  private handleTabSwitch(target: HTMLElement): boolean {
    // Handle panel tab switching
    const panelTab = target.closest('.debug-panel-tab') as HTMLElement;
    if (panelTab) {
      const panelId = panelTab.getAttribute('data-panel');
      this.logger.debug('[Debug] Panel switch:', this.activePanel, '->', panelId);
      if (panelId && panelId !== this.activePanel) {
        this.activePanel = panelId;
        this.activePanelTab = undefined; // Reset horizontal tab when switching panels

        // Save to localStorage
        localStorage.setItem(DebugOverlay.ACTIVE_PANEL_KEY, panelId);
        localStorage.removeItem(DebugOverlay.ACTIVE_TAB_KEY); // Clear tab when switching panels

        this.updateOverlay();
      }
      return true;
    }

    // Handle horizontal tab switching within panels
    const horizontalTab = target.closest('.horizontal-tab') as HTMLElement;
    if (horizontalTab) {
      const tabId = horizontalTab.getAttribute('data-panel-tab');
      this.logger.debug('[Debug] Horizontal tab switch:', this.activePanelTab, '->', tabId, 'in panel:', this.activePanel);
      if (tabId && tabId !== this.activePanelTab) {
        this.activePanelTab = tabId;

        // Save to localStorage
        localStorage.setItem(DebugOverlay.ACTIVE_TAB_KEY, tabId);

        this.updateOverlay();
      }
      return true;
    }

    return false;
  }

  /** Runs the active panel's own action button, matched by its label. */
  private runPanelAction(target: HTMLElement): void {
    // Handle panel action buttons
    const panelActionBtn = target.closest('.panel-action-btn') as HTMLElement;
    if (panelActionBtn) {
      const actionLabel = panelActionBtn.getAttribute('data-panel-action');
      const activePanel = this.panels.find(p => p.id === this.activePanel);
      const panelAction = activePanel?.getActions?.()?.find(a => a.label === actionLabel);

      if (panelAction) {
        panelAction.action();
        // Re-render the whole overlay (not just content): actions whose label
        // toggles with state — e.g. Pause/Resume — live in the chrome, and the
        // click handler matches by label, so the buttons must be re-rendered to
        // stay in sync. updateContent() alone leaves a stale "Pause" button that
        // no longer matches the now-"Resume" action.
        setTimeout(() => this.updateOverlay(), 100);
      }
      return;
    }
  }

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
      // Skip updates if viewing raw data tab to prevent constant re-renders.
      // Provider panels are intentionally excluded — they refresh on tracker
      // changes via scheduleProviderPanelRefresh(), not on this poll.
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
    if (this.providerRefreshTimer !== null) {
      clearTimeout(this.providerRefreshTimer);
      this.providerRefreshTimer = null;
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
    cartOperations.clear();
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

  /** The mini-cart's view of this overlay: just the shadow root it renders into. */
  private miniCartHost(): MiniCartHost {
    return { shadowRoot: this.shadowRoot };
  }

  private closeMiniCart(): void {
    closeMiniCartImpl(this.miniCartHost());
  }

  private toggleMiniCart(forceShow?: boolean): void {
    toggleMiniCartImpl(this.miniCartHost(), forceShow);
  }

  private updateMiniCart(): void {
    updateMiniCartImpl(this.miniCartHost());
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
    if (cartTotalEl) cartTotalEl.textContent = formatCurrency(cartState.total.toNumber());
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

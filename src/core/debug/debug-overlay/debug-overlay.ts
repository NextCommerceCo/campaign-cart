/**
 * Debug Overlay - Main controller for debug utilities
 *
 * Provides a comprehensive debugging interface when ?debug=true is present
 * in the URL. Features cart state inspection, store monitoring, and more.
 */

import { Logger } from '../../logger';
import { DebugEventManager } from '../debug-event-manager';
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
} from '../panels';
import type {
  MiniCartHost,
  OverlayRenderDeps,
  AutoUpdateDeps,
  ContainerClickDeps,
} from './debug-overlay.types';
import {
  closeMiniCart as closeMiniCartImpl,
  toggleMiniCart as toggleMiniCartImpl,
  updateMiniCart as updateMiniCartImpl,
} from './debug-overlay.mini-cart';
import {
  createOverlay as createOverlayImpl,
  updateOverlay as updateOverlayImpl,
  updateContent as updateContentImpl,
  startAutoUpdate as startAutoUpdateImpl,
  stopAutoUpdate as stopAutoUpdateImpl,
} from './debug-overlay.chrome';
import {
  addEventListeners as addEventListenersImpl,
  handleContainerClick as handleContainerClickImpl,
  handleContainerHover as handleContainerHoverImpl,
} from './debug-overlay.handlers';

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

  /** What `debug-overlay.chrome.ts` needs to render the panel chrome. */
  private renderDeps(): OverlayRenderDeps {
    return {
      panels: this.panels,
      activePanel: this.activePanel,
      activePanelTab: this.activePanelTab,
      isExpanded: this.isExpanded,
      addEventListeners: () => this.addEventListeners(),
      updateButtonStates: () => this.updateButtonStates(),
    };
  }

  private async createOverlay(): Promise<void> {
    const { container, shadowRoot } = await createOverlayImpl(
      this.renderDeps()
    );
    this.container = container;
    this.shadowRoot = shadowRoot;
  }

  private updateOverlay(): void {
    updateOverlayImpl(this.shadowRoot, this.renderDeps());
  }

  private updateContent(): void {
    updateContentImpl(
      this.shadowRoot,
      this.panels,
      this.activePanel,
      this.activePanelTab
    );
  }

  private addEventListeners(): void {
    addEventListenersImpl(
      this.shadowRoot,
      this.handleContainerClick,
      this.handleContainerHover
    );
  }

  /** What `debug-overlay.handlers.ts` needs to route a click on the overlay. */
  private containerClickDeps(): ContainerClickDeps {
    return {
      panels: this.panels,
      activePanel: this.activePanel,
      handleDebugAction: action => this.handleDebugAction(action),
      handleTabSwitch: target => this.handleTabSwitch(target),
      updateOverlay: () => this.updateOverlay(),
    };
  }

  private handleContainerClick = (event: Event): void => {
    handleContainerClickImpl(event, this.containerClickDeps());
  };

  /**
   * One of the `data-action` buttons in the overlay chrome was clicked.
   *
   * Stays on this class rather than moving to `debug-overlay.handlers.ts`:
   * `extract-storage-keys.ts` only resolves `DebugOverlay.EXPANDED_STORAGE_KEY`
   * as a static class field when the reference lives in the same file as the
   * class declaration — moving this would have turned the
   * `debug-overlay-expanded` documentation row into an unresolvable `{token}`
   * (docs/code-findings.md #183).
   */
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
   *
   * Stays on this class for the same reason as `handleDebugAction` above: it
   * writes `DebugOverlay.ACTIVE_PANEL_KEY` / `ACTIVE_TAB_KEY`, which only
   * resolve as documented storage keys from inside this file.
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

  private handleContainerHover = (event: Event): void => {
    handleContainerHoverImpl(event);
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
    const deps: AutoUpdateDeps = {
      getActivePanel: () => this.activePanel,
      getActivePanelTab: () => this.activePanelTab,
      updateQuickStats: () => this.updateQuickStats(),
      updateContent: () => this.updateContent(),
    };
    this.updateInterval = startAutoUpdateImpl(deps);
  }

  private stopAutoUpdate(): void {
    const cleared = stopAutoUpdateImpl(
      this.updateInterval,
      this.providerRefreshTimer
    );
    this.updateInterval = cleared.updateInterval;
    this.providerRefreshTimer = cleared.providerRefreshTimer;
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

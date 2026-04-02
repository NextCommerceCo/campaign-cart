/**
 * Upsell Selector for Debug Mode
 * Shows currently selected upsell package on upsell pages
 */

import { Logger } from '@/utils/logger';
import { useCampaignStore } from '@/stores/campaignStore';
import { EventBus } from '@/utils/events';

interface UpsellState {
  packageId?: number;
  selectorId?: string;
  bundleSelectorId?: string;
  bundleItems?: { packageId: number; quantity: number }[];
  quantity: number;
  mode: 'direct' | 'selector' | 'bundle' | 'none';
}

export class UpsellSelector {
  private static instance: UpsellSelector;
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private logger = new Logger('UpsellSelector');
  private eventBus = EventBus.getInstance();
  private state: UpsellState = { mode: 'none', quantity: 1 };
  private isUpsellPage = false;
  private renderDebounceTimer: NodeJS.Timeout | null = null;

  public static getInstance(): UpsellSelector {
    if (!UpsellSelector.instance) {
      UpsellSelector.instance = new UpsellSelector();
    }
    return UpsellSelector.instance;
  }

  private constructor() {}

  public initialize(): void {
    // Check if this is an upsell page
    this.checkIfUpsellPage();

    if (!this.isUpsellPage) {
      this.logger.debug('Not an upsell page, skipping initialization');
      return;
    }

    this.createContainer();
    this.setupEventListeners();

    // Scan for existing upsell elements that may have already been enhanced
    this.scanExistingUpsells();

    this.logger.info('UpsellSelector initialized');
  }

  private createContainer(): void {
    // Remove existing container if any
    if (this.container) {
      this.container.remove();
    }

    // Create container fixed at top-right
    this.container = document.createElement('div');
    this.container.id = 'debug-upsell-display';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999998;
      pointer-events: auto;
    `;

    // Create shadow root for style isolation
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Add to body
    document.body.appendChild(this.container);
  }

  private scanExistingUpsells(): void {
    // Find all upsell elements on the page
    const upsellElements = document.querySelectorAll('[data-next-upsell], [data-next-upsell-selector]');

    this.logger.debug('Scanning for existing upsell elements:', upsellElements.length);

    if (upsellElements.length === 0) {
      this.logger.debug('No upsell elements found');
      return;
    }

    // Take the first upsell element to determine state
    const firstElement = upsellElements[0] as HTMLElement;

    // Check for bundle selector mode first (child element or explicit attribute)
    const childBundleSelector = firstElement.querySelector<HTMLElement>('[data-next-bundle-selector]');
    const bundleSelectorId = firstElement.getAttribute('data-next-bundle-selector-id')
      ?? childBundleSelector?.getAttribute('data-next-selector-id');
    if (bundleSelectorId) {
      this.state = { bundleSelectorId, quantity: 1, mode: 'bundle' };
      // Delay read so BundleSelectorEnhancer has time to attach _getSelectedBundleItems
      setTimeout(() => this.readBundleSelection(), 200);
      this.render();
      this.logger.debug('Initialized state from bundle selector:', { bundleSelectorId });
      return;
    }

    // Determine if this is a selector or direct mode
    let selectorId = firstElement.getAttribute('data-next-selector-id');
    let packageIdAttr = firstElement.getAttribute('data-next-package-id');
    let packageId = packageIdAttr ? parseInt(packageIdAttr, 10) : undefined;

    // If no package ID on the container, look for selected option inside
    if (!packageId) {
      const selectedOption = firstElement.querySelector('[data-next-upsell-option][data-next-selected="true"]');
      if (selectedOption) {
        const selectedPackageIdAttr = selectedOption.getAttribute('data-next-package-id');
        packageId = selectedPackageIdAttr ? parseInt(selectedPackageIdAttr, 10) : undefined;
        this.logger.debug('Found selected option:', { packageId });
      }

      // If still no package ID, look for ANY option (even if not selected)
      if (!packageId) {
        const anyOption = firstElement.querySelector('[data-next-upsell-option][data-next-package-id]');
        if (anyOption) {
          const optionPackageIdAttr = anyOption.getAttribute('data-next-package-id');
          packageId = optionPackageIdAttr ? parseInt(optionPackageIdAttr, 10) : undefined;
          this.logger.debug('Found first available option:', { packageId });
        }
      }
    }

    // Look for nested selector if we have one
    if (!selectorId) {
      const nestedSelector = firstElement.querySelector('[data-next-selector-id]');
      if (nestedSelector) {
        selectorId = nestedSelector.getAttribute('data-next-selector-id') || null;
        this.logger.debug('Found nested selector:', { selectorId });
      }
    }

    this.state = {
      packageId: packageId || undefined,
      selectorId: selectorId || undefined,
      quantity: 1,
      mode: selectorId ? 'selector' : (packageId ? 'direct' : 'none'),
    };

    this.render();

    this.logger.debug('Initialized state from existing upsell element:', {
      mode: this.state.mode,
      packageId: this.state.packageId,
      selectorId: this.state.selectorId
    });
  }

  private checkIfUpsellPage(): void {
    const pageTypeMeta = document.querySelector('meta[name="next-page-type"]');
    this.isUpsellPage = pageTypeMeta?.getAttribute('content') === 'upsell';
  }

  private setupEventListeners(): void {
    // Listen for upsell initialization via EventBus
    this.eventBus.on('upsell:initialized', (data) => {
      const { packageId, element } = data;
      this.logger.debug('Upsell initialized:', data);

      if (!element) return;

      const selectorId = element.getAttribute('data-next-selector-id');
      const childBundle = element.querySelector<HTMLElement>('[data-next-bundle-selector]');
      const bundleSelectorId = element.getAttribute('data-next-bundle-selector-id')
        ?? childBundle?.getAttribute('data-next-selector-id');

      if (bundleSelectorId) {
        this.state = {
          bundleSelectorId,
          quantity: 1,
          mode: 'bundle',
        };
      } else {
        this.state = {
          packageId: packageId || undefined,
          selectorId: selectorId || undefined,
          quantity: 1,
          mode: selectorId ? 'selector' : 'direct',
        };
      }

      this.render();
    });

    // Listen for bundle selection changes
    this.eventBus.on('bundle:selection-changed', (data) => {
      if (this.state.mode !== 'bundle') return;
      this.logger.debug('Bundle selection changed:', data);
      this.state.bundleItems = data.items;
      this.render();
    });

    // Listen for option selection changes via EventBus
    this.eventBus.on('upsell:option-selected', (data) => {
      const { packageId, selectorId } = data;
      this.logger.debug('Upsell option selected:', data);

      // Always update the package ID since we're on an upsell page
      // (nested selectors may have different IDs than the outer container)
      this.state.packageId = packageId;
      if (selectorId) {
        this.state.selectorId = selectorId;
      }
      this.render();
    });

    // Listen for quantity changes via EventBus
    this.eventBus.on('upsell:quantity-changed', (data) => {
      const { quantity, selectorId, packageId } = data;
      this.logger.debug('Upsell quantity changed:', data);

      // Always update quantity since we're on an upsell page
      // (nested selectors and quantity controls may have different IDs)
      this.state.quantity = quantity;
      this.render();
    });
  }

  private readBundleSelection(): void {
    if (!this.state.bundleSelectorId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-next-bundle-selector][data-next-selector-id="${this.state.bundleSelectorId}"]`,
    );
    if (!el) return;
    const fn = (el as unknown as Record<string, unknown>)['_getSelectedBundleItems'];
    if (typeof fn === 'function') {
      const items = fn() as { packageId: number; quantity: number }[] | null;
      if (items) {
        this.state.bundleItems = items;
        this.render();
      }
    }
  }

  private getPackageName(packageId: number): string {
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);
    return packageData?.name || `Package ${packageId}`;
  }

  private render(): void {
    // Debounce renders to prevent excessive updates
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }

    this.renderDebounceTimer = setTimeout(() => {
      this.doRender();
    }, 50);
  }

  private doRender(): void {
    if (!this.shadowRoot) return;

    // Don't render if no selection or not on upsell page
    if ((this.state.mode === 'none' && !this.state.bundleSelectorId) || !this.isUpsellPage) {
      if (this.container) {
        this.container.style.display = 'none';
      }
      return;
    }

    // Make sure container is visible
    if (this.container) {
      this.container.style.display = 'block';
    }

    const packageName = this.state.packageId ? this.getPackageName(this.state.packageId) : 'None';
    const modeLabel =
      this.state.mode === 'bundle'
        ? '📦 Bundle'
        : this.state.mode === 'selector'
          ? '🎯 Selector'
          : '➡️ Direct';
    const bundleHasItems = (this.state.bundleItems?.length ?? 0) > 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .upsell-badge {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(99, 102, 241, 0.4);
          border-radius: 8px;
          padding: 14px 18px;
          display: inline-flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.1);
          transition: all 0.2s ease;
          min-width: 320px;
        }

        .upsell-badge:hover {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border-color: rgba(99, 102, 241, 0.6);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.2);
          transform: translateY(-1px);
        }

        .badge-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .debug-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          flex: 1;
        }

        .mode-badge {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .info-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 500;
          min-width: 50px;
        }

        .info-value {
          color: rgba(255, 255, 255, 0.95);
          font-size: 14px;
          font-weight: 600;
          flex: 1;
        }

        .package-id {
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #c7d2fe;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        .package-name {
          color: rgba(255, 255, 255, 0.9);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quantity-badge {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        .selector-id-value {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-family: 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 4px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-left: auto;
        }

        .status-indicator.selected {
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
        }

        .status-indicator.unselected {
          background: rgba(255, 255, 255, 0.2);
        }
      </style>

      <div class="upsell-badge">
        <div class="badge-header">
          <span class="debug-label">🔍 Debug Info</span>
          <span class="mode-badge">${modeLabel}</span>
        </div>

        <div class="badge-content">
          ${this.state.mode === 'bundle' ? `
            <div class="info-row">
              <span class="info-label">Bundle:</span>
              <span class="selector-id-value">${this.state.bundleSelectorId ?? ''}</span>
              <span class="status-indicator ${bundleHasItems ? 'selected' : 'unselected'}"></span>
            </div>
            ${bundleHasItems ? this.state.bundleItems!.map(item => `
              <div class="info-row">
                <span class="info-label">Item:</span>
                <span class="package-id">#${item.packageId}</span>
                <span class="info-value package-name">${this.getPackageName(item.packageId)}</span>
                <span class="quantity-badge">×${item.quantity}</span>
              </div>
            `).join('') : `
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">No selection</span>
              </div>
            `}
          ` : this.state.packageId ? `
            <div class="info-row">
              <span class="info-label">Package:</span>
              <span class="package-id">#${this.state.packageId}</span>
              <span class="status-indicator selected"></span>
            </div>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value package-name" title="${packageName}">${packageName}</span>
            </div>
          ` : `
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">No selection</span>
              <span class="status-indicator unselected"></span>
            </div>
          `}

          ${this.state.quantity > 1 ? `
            <div class="info-row">
              <span class="info-label">Qty:</span>
              <span class="quantity-badge">×${this.state.quantity}</span>
            </div>
          ` : ''}

          ${this.state.selectorId ? `
            <div class="info-row">
              <span class="info-label">ID:</span>
              <span class="selector-id-value">${this.state.selectorId}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  public destroy(): void {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public show(): void {
    if (this.container && this.isUpsellPage) {
      this.container.style.display = 'block';
    }
  }
}

// Export singleton instance
export const upsellSelector = UpsellSelector.getInstance();

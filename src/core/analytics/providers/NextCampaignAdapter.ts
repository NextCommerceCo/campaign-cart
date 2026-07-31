import {
  ProviderAdapter,
  notSupported,
  DispatchError,
} from './ProviderAdapter';
import { DataLayerEvent } from '../types';
import { useConfigStore } from '@/state/config';

declare global {
  interface Window {
    nextCampaign: {
      config: (options: { apiKey: string }) => void;
      event: (eventName: string, eventData?: any) => void;
    };
  }
}

/**
 * NextCampaign Analytics adapter
 * Integrates with NextCommerce's campaign analytics platform
 */
export class NextCampaignAdapter extends ProviderAdapter {
  private scriptLoaded = false;
  private scriptLoading = false;
  private loadPromise: Promise<void> | null = null;
  private apiKey: string = '';
  private loadWarned = false;

  constructor(config?: { blockedEvents?: string[] }) {
    super('NextCampaign', { blockedEvents: config?.blockedEvents });
  }

  /** Warn once, with the fix, when the NextCampaign SDK fails to load. */
  private warnScriptMissing(): void {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      'NextCampaign SDK failed to load — check that a valid apiKey is set and ' +
        'that campaigns.apps.29next.com is reachable.'
    );
  }

  /**
   * Initialize the adapter with configuration
   */
  async initialize(config?: any): Promise<void> {
    this.logger.info('NextCampaign adapter initializing...');

    // Get API key from config store or adapter config
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
      this.logger.info('API key provided via config parameter');
    } else {
      // Get from the proper config store
      const configStore = useConfigStore.getState();
      this.apiKey = configStore.apiKey || '';
      this.logger.info(
        `API key from config store: ${this.apiKey ? 'found' : 'not found'}`
      );
    }

    if (!this.apiKey) {
      this.logger.warn('No API key available for NextCampaign initialization');
      return;
    }

    this.logger.info(
      `NextCampaign API key found: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
    );

    // Load the NextCampaign SDK script
    await this.loadScript();
  }

  protected override isReady(): boolean {
    return this.scriptLoaded;
  }

  protected override getDebugDetails(): Record<
    string,
    string | number | boolean
  > {
    return {
      scriptLoaded: this.scriptLoaded,
      apiKeySet: Boolean(this.apiKey),
    };
  }

  /**
   * Send event to NextCampaign
   */
  async sendEvent(event: DataLayerEvent): Promise<unknown> {
    if (!this.enabled) {
      this.debug('NextCampaign adapter disabled');
      return undefined;
    }

    // Map first (SDK-independent) so the prepared payload survives a load
    // failure. NextCampaign only tracks page_view — everything else is skipped.
    const mappedEvent = this.mapEvent(event);
    if (!mappedEvent) {
      return notSupported('NextCampaign only tracks page_view');
    }

    // Ensure script is loaded; if it never loads, surface the prepared payload.
    if (!this.scriptLoaded) {
      try {
        await this.loadScript();
      } catch {
        this.warnScriptMissing();
        throw new DispatchError('NextCampaign SDK load failed', mappedEvent);
      }
    }

    try {
      if (window.nextCampaign) {
        window.nextCampaign.event(mappedEvent.name, mappedEvent.data);
        this.debug(
          `Event sent to NextCampaign: ${mappedEvent.name}`,
          mappedEvent.data
        );
      }
    } catch (error) {
      // Re-throw so the base records `failed`, not a misleading `sent`.
      throw new DispatchError(
        `NextCampaign dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        mappedEvent
      );
    }

    // Report the mapped {name, data} dispatched to NextCampaign for the overlay.
    return mappedEvent;
  }

  /**
   * Load the NextCampaign SDK script
   */
  private async loadScript(): Promise<void> {
    if (this.scriptLoaded) {
      return;
    }

    if (this.scriptLoading) {
      return this.loadPromise!;
    }

    this.scriptLoading = true;
    this.loadPromise = this.performLoad();

    try {
      await this.loadPromise;
      this.scriptLoaded = true;
      this.logger.info(
        'NextCampaign SDK loaded and initialized successfully ✅'
      );
    } catch (error) {
      this.logger.error('Failed to load NextCampaign SDK:', error);
      throw error;
    } finally {
      this.scriptLoading = false;
    }
  }

  /**
   * Perform the actual script loading
   */
  private async performLoad(): Promise<void> {
    const scriptUrl = 'https://campaigns.apps.29next.com/js/v1/campaign/';

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      // Wait for it to be ready
      await this.waitForNextCampaign();
      return;
    }

    // Create and load the script
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptUrl;

      script.onload = () => {
        this.logger.debug('NextCampaign script loaded');
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load NextCampaign script: ${scriptUrl}`));
      };

      document.head.appendChild(script);
    });

    // Wait for nextCampaign to be available
    await this.waitForNextCampaign();

    // Initialize with API key
    if (window.nextCampaign && this.apiKey) {
      window.nextCampaign.config({ apiKey: this.apiKey });
      this.logger.debug('NextCampaign configured with API key');

      // Fire initial page view event to match standalone script behavior
      this.fireInitialPageView();
    }
  }

  /**
   * Fire initial page view event on load
   */
  private fireInitialPageView(): void {
    // Wait for window load to match standalone script behavior
    if (document.readyState === 'complete') {
      // Already loaded, fire immediately
      this.sendPageView();
    } else {
      // Wait for window load event
      window.addEventListener('load', () => {
        this.sendPageView();
      });
    }
  }

  /**
   * Send page view event to NextCampaign
   */
  private sendPageView(): void {
    try {
      if (window.nextCampaign) {
        window.nextCampaign.event('page_view', {
          title: document.title,
          url: window.location.href,
        });
        this.logger.info('Initial page_view event sent to NextCampaign');
      }
    } catch (error) {
      this.logger.error(
        'Error sending initial page view to NextCampaign:',
        error
      );
    }
  }

  /**
   * Wait for nextCampaign object to be available
   */
  private async waitForNextCampaign(timeout: number = 5000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.nextCampaign) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(checkInterval);
          reject(new Error('NextCampaign load timeout'));
        }
      }, 100);
    });
  }

  /**
   * Map DataLayer events to NextCampaign events
   * IMPORTANT: NextCampaign only tracks page_view events
   */
  private mapEvent(event: DataLayerEvent): { name: string; data: any } | null {
    // Only track page view events for NextCampaign
    switch (event.event) {
      case 'dl_page_view':
      case 'page_view':
        return {
          name: 'page_view',
          data: {
            title: document.title,
            url: window.location.href,
          },
        };

      default:
        // NextCampaign only tracks page_view events, ignore all others
        return null;
    }
  }
}

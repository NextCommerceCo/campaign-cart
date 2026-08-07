/**
 * Simple Exit Intent Enhancer
 * One method, handles everything internally
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { EXIT_INTENT_STORAGE_KEY } from '@/core/storage';
import {
  isMobileDevice,
  saveToSessionStorage,
  setupEventListeners,
  triggerExitIntent,
} from './simple-exit-intent.handlers';
import {
  createImagePopup,
  createTemplatePopup,
  hidePopupElements,
} from './simple-exit-intent.renderer';
import type {
  ExitIntentPopupContext,
  SimpleExitIntentOptions,
} from './simple-exit-intent.types';

export class ExitIntentEnhancer extends BaseEnhancer {
  private isEnabled = false;
  private triggerCount = 0;
  private lastTriggerTime = 0;
  private maxTriggers = 1; // Default to 1 trigger
  private cooldownPeriod = 30000; // 30 seconds
  private imageUrl = '';
  private templateName = ''; // Name for template (e.g., 'exit-intent')
  private templateElement: HTMLTemplateElement | null = null; // Reference to template element
  private action: (() => void | Promise<void>) | null = null;
  private popupElement: HTMLElement | null = null;
  private overlayElement: HTMLElement | null = null;
  private mouseLeaveHandler: ((e: MouseEvent) => void) | null = null;
  private scrollHandler: ((e: Event) => void) | null = null;
  private disableOnMobile = true; // Default to desktop-only like the reference code
  private mobileScrollTrigger = false; // Explicitly enable mobile scroll trigger
  private sessionStorageKey = EXIT_INTENT_STORAGE_KEY;
  private useSessionStorage = true; // Enable session storage by default
  private overlayClosable = true; // Allow overlay click to close
  private showCloseButton = false; // Show close button on modal
  private imageClickable = true; // Make image clickable (default true for backward compat)
  private actionButtonText = ''; // Text for action button

  constructor() {
    super(document.body);
  }

  public async initialize(): Promise<void> {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise<void>(resolve => {
        document.addEventListener('DOMContentLoaded', () => resolve());
      });
    }

    // Load trigger count from session storage if available
    if (
      this.useSessionStorage &&
      typeof window !== 'undefined' &&
      window.sessionStorage
    ) {
      try {
        const storedData = sessionStorage.getItem(this.sessionStorageKey);
        if (storedData) {
          const data = JSON.parse(storedData);
          this.triggerCount = data.triggerCount || 0;
          this.lastTriggerTime = data.lastTriggerTime || 0;
        }
      } catch (error) {
        this.logger.debug('Failed to load session storage data:', error);
      }
    }
  }

  // Implement abstract update method
  public async update(data?: any): Promise<void> {
    // Update configuration if data is provided
    if (data && typeof data === 'object') {
      if (data.image) {
        this.setup(data);
      }
    }
  }

  public setup(options: SimpleExitIntentOptions): void {
    // Validate that either image or template is provided
    if (!options.image && !options.template) {
      this.logger.error(
        'Exit intent requires either an image URL or a template name'
      );
      return;
    }

    this.imageUrl = options.image || '';
    this.templateName = options.template || '';
    this.action = options.action || null;
    this.disableOnMobile =
      options.disableOnMobile !== undefined ? options.disableOnMobile : true; // Default true
    this.mobileScrollTrigger = options.mobileScrollTrigger || false;
    this.maxTriggers =
      options.maxTriggers !== undefined ? options.maxTriggers : 1; // Default to 1
    this.useSessionStorage =
      options.useSessionStorage !== undefined
        ? options.useSessionStorage
        : true;
    this.overlayClosable =
      options.overlayClosable !== undefined ? options.overlayClosable : true;
    this.showCloseButton = options.showCloseButton || false;
    this.imageClickable =
      options.imageClickable !== undefined ? options.imageClickable : true;
    this.actionButtonText = options.actionButtonText || '';
    if (options.sessionStorageKey) {
      this.sessionStorageKey = options.sessionStorageKey;
    }

    // Find template element if template name is provided
    if (this.templateName) {
      // Look for <template data-template="name">
      this.templateElement = document.querySelector(
        `template[data-template="${this.templateName}"]`
      ) as HTMLTemplateElement;
      if (!this.templateElement) {
        this.logger.error(
          `Exit intent template not found: <template data-template="${this.templateName}">`
        );
        return;
      }
    }

    // Check if we should enable based on device
    if (this.disableOnMobile && isMobileDevice()) {
      this.logger.debug('Exit intent disabled on mobile device');
      return;
    }

    this.isEnabled = true;
    this.setupEventListeners();
    this.logger.debug('Simple exit intent setup complete');
  }

  public disable(): void {
    this.isEnabled = false;
    this.cleanupEventListeners();
    this.hidePopup();
  }

  public reset(): void {
    // Reset the trigger count and clear session storage
    this.triggerCount = 0;
    this.lastTriggerTime = 0;

    if (
      this.useSessionStorage &&
      typeof window !== 'undefined' &&
      window.sessionStorage
    ) {
      try {
        sessionStorage.removeItem(this.sessionStorageKey);
      } catch (error) {
        this.logger.debug('Failed to clear session storage:', error);
      }
    }
  }

  private setupEventListeners(): void {
    const listeners = setupEventListeners({
      mobileScrollTrigger: this.mobileScrollTrigger,
      getTriggerState: () => ({
        isEnabled: this.isEnabled,
        hasPopup: this.popupElement !== null,
        triggerCount: this.triggerCount,
        maxTriggers: this.maxTriggers,
        lastTriggerTime: this.lastTriggerTime,
        cooldownPeriod: this.cooldownPeriod,
        disableOnMobile: this.disableOnMobile,
      }),
      triggerExitIntent: () => this.triggerExitIntent(),
    });
    this.mouseLeaveHandler = listeners.mouseLeaveHandler;
    this.scrollHandler = listeners.scrollHandler;
  }

  private triggerExitIntent(): void {
    triggerExitIntent({
      incrementTriggerCount: () => {
        this.triggerCount++;
      },
      setLastTriggerTime: time => {
        this.lastTriggerTime = time;
      },
      saveToSessionStorage: () => this.saveToSessionStorage(),
      showPopup: () => this.showPopup(),
    });
  }

  private saveToSessionStorage(): void {
    saveToSessionStorage(
      this.useSessionStorage,
      this.sessionStorageKey,
      this.triggerCount,
      this.lastTriggerTime,
      this.logger
    );
  }

  private showPopup(): void {
    const ctx = this.getPopupContext();
    const elements = this.templateElement
      ? createTemplatePopup(ctx)
      : createImagePopup(ctx);
    this.popupElement = elements.popupElement;
    this.overlayElement = elements.overlayElement;
    this.emit('exit-intent:shown', {
      imageUrl: this.imageUrl,
      template: this.templateName,
    });
  }

  private getPopupContext(): ExitIntentPopupContext {
    return {
      imageUrl: this.imageUrl,
      templateName: this.templateName,
      templateElement: this.templateElement,
      action: this.action,
      overlayClosable: this.overlayClosable,
      showCloseButton: this.showCloseButton,
      imageClickable: this.imageClickable,
      actionButtonText: this.actionButtonText,
      logger: this.logger,
      emit: this.emit.bind(this),
      hidePopup: () => this.hidePopup(),
      saveToSessionStorage: () => this.saveToSessionStorage(),
    };
  }

  public hidePopup(): void {
    hidePopupElements(
      {
        popupElement: this.popupElement,
        overlayElement: this.overlayElement,
      },
      {
        getPopupElement: () => this.popupElement,
        getOverlayElement: () => this.overlayElement,
      },
      {
        popup: () => {
          this.popupElement = null;
        },
        overlay: () => {
          this.overlayElement = null;
        },
      }
    );
  }

  /**
   * Base `destroy()` calls this after unsubscribing, so there is no `destroy()`
   * override here — one that called `this.cleanupEventListeners()` before
   * `super.destroy()` would only run this twice.
   */
  protected override cleanupEventListeners(): void {
    if (this.mouseLeaveHandler) {
      document.documentElement.removeEventListener(
        'mouseout',
        this.mouseLeaveHandler
      );
      this.mouseLeaveHandler = null;
    }

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    this.hidePopup();
  }
}

/**
 * Offer Condition Display Enhancer
 * Displays offer conditions, requirements, and progress indicators
 *
 * This enhancer shows requirements like "Buy 2 items to get discount"
 * and displays progress towards meeting those conditions.
 *
 * @example
 * <!-- Simple condition display -->
 * <div data-next-offer-condition
 *      data-next-offer-id="123">
 *   <div data-condition-description></div>
 *   <div data-condition-status></div>
 * </div>
 *
 * <!-- With progress bar -->
 * <div data-next-offer-condition
 *      data-next-offer-id="123"
 *      data-next-show-progress="true">
 *   <div data-condition-description></div>
 *   <div data-condition-progress-bar>
 *     <div data-condition-progress-fill></div>
 *   </div>
 *   <div data-condition-progress-text></div>
 * </div>
 *
 * <!-- With validation messages -->
 * <div data-next-offer-condition
 *      data-next-offer-id="123"
 *      data-next-show-validation="true">
 *   <div data-condition-met-message>You qualify for this offer!</div>
 *   <div data-condition-not-met-message>Add 1 more item to qualify</div>
 * </div>
 *
 * Attributes:
 * - data-next-offer-condition: Main identifier
 * - data-next-offer-id: Offer ID from campaign
 * - data-next-show-progress: Show progress bar/indicator (default: false)
 * - data-next-show-validation: Show validation messages (default: true)
 * - data-next-auto-hide-when-met: Hide when condition is met (default: false)
 *
 * Display Elements:
 * - [data-condition-description] - Condition description text
 * - [data-condition-type] - Condition type (any, count, etc.)
 * - [data-condition-value] - Required value
 * - [data-condition-current] - Current value
 * - [data-condition-remaining] - Remaining to meet condition
 * - [data-condition-status] - Met or not met status
 * - [data-condition-progress-bar] - Progress bar container
 * - [data-condition-progress-fill] - Progress bar fill element
 * - [data-condition-progress-text] - Progress text (e.g., "2/3")
 * - [data-condition-progress-percent] - Progress percentage
 * - [data-condition-met-message] - Message when condition is met
 * - [data-condition-not-met-message] - Message when not met
 *
 * Events:
 * - condition:met - When condition is satisfied
 * - condition:not-met - When condition is no longer satisfied
 * - condition:progress-changed - When progress changes
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCartStore } from '@/stores/cartStore';
import type { Offer, OfferCondition } from '@/types/campaign';
import type { CartState } from '@/types/global';

interface ConditionProgress {
  current: number;
  required: number;
  remaining: number;
  percent: number;
  isMet: boolean;
}

export class OfferConditionDisplayEnhancer extends BaseEnhancer {
  private offerId?: number;
  private offerData?: Offer;
  private condition?: OfferCondition;
  private showProgress: boolean = false;
  private showValidation: boolean = true;
  private autoHideWhenMet: boolean = false;
  private lastProgress?: ConditionProgress;
  private displayElements: Map<string, HTMLElement[]> = new Map();

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    const offerIdAttr = this.getAttribute('data-next-offer-id');
    this.offerId = offerIdAttr ? parseInt(offerIdAttr, 10) : undefined;

    this.showProgress = this.getAttribute('data-next-show-progress') === 'true';
    this.showValidation = this.getAttribute('data-next-show-validation') !== 'false';
    this.autoHideWhenMet = this.getAttribute('data-next-auto-hide-when-met') === 'true';

    // Load offer data
    if (this.offerId) {
      await this.loadOfferData();
    }

    // Find display elements
    this.findDisplayElements();

    // Render initial state
    this.renderCondition();

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Initial progress check
    this.updateProgress(useCartStore.getState());

    this.logger.debug('OfferConditionDisplayEnhancer initialized:', {
      offerId: this.offerId,
      hasCondition: !!this.condition
    });
  }

  private async loadOfferData(): Promise<void> {
    try {
      const campaignStore = useCampaignStore.getState();
      const campaign = campaignStore.campaign;

      if (campaign?.offers && this.offerId) {
        this.offerData = campaign.offers.find(offer => offer.ref_id === this.offerId);

        if (this.offerData) {
          this.condition = this.offerData.condition;
          this.logger.debug('Loaded offer condition:', this.condition);
        } else {
          this.logger.warn(`Offer ${this.offerId} not found in campaign`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load offer data:', error);
    }
  }

  private findDisplayElements(): void {
    const selectors = [
      'data-condition-description',
      'data-condition-type',
      'data-condition-value',
      'data-condition-current',
      'data-condition-remaining',
      'data-condition-status',
      'data-condition-progress-bar',
      'data-condition-progress-fill',
      'data-condition-progress-text',
      'data-condition-progress-percent',
      'data-condition-met-message',
      'data-condition-not-met-message'
    ];

    selectors.forEach(selector => {
      const elements = this.element.querySelectorAll(`[${selector}]`);
      if (elements.length > 0) {
        this.displayElements.set(selector, Array.from(elements) as HTMLElement[]);
      }
    });
  }

  private renderCondition(): void {
    if (!this.condition) {
      this.logger.debug('No condition to render');
      return;
    }

    // Render condition description
    this.updateElements('data-condition-description', this.condition.description);

    // Render condition type
    this.updateElements('data-condition-type', this.condition.type);

    // Render required value
    this.updateElements('data-condition-value', this.condition.value.toString());

    // Add CSS class
    this.element.classList.add(`condition-type-${this.condition.type}`);
    this.element.setAttribute('data-condition-loaded', 'true');
  }

  private handleCartUpdate(cartState: CartState): void {
    this.updateProgress(cartState);
  }

  private updateProgress(cartState: CartState): void {
    if (!this.condition) return;

    const progress = this.calculateProgress(cartState);

    // Check if progress changed
    const progressChanged = !this.lastProgress ||
      this.lastProgress.current !== progress.current ||
      this.lastProgress.isMet !== progress.isMet;

    if (progressChanged) {
      this.renderProgress(progress);

      // Emit events
      if (progress.isMet && (!this.lastProgress || !this.lastProgress.isMet)) {
        this.emit('condition:met', {
          offerId: this.offerId,
          progress
        });
      } else if (!progress.isMet && this.lastProgress?.isMet) {
        this.emit('condition:not-met', {
          offerId: this.offerId,
          progress
        });
      }

      if (progressChanged) {
        this.emit('condition:progress-changed', {
          offerId: this.offerId,
          progress
        });
      }

      this.lastProgress = progress;
    }
  }

  private calculateProgress(cartState: CartState): ConditionProgress {
    if (!this.condition) {
      return {
        current: 0,
        required: 0,
        remaining: 0,
        percent: 0,
        isMet: false
      };
    }

    let current = 0;
    const required = this.condition.value;

    switch (this.condition.type) {
      case 'count':
        // Count items in cart
        current = cartState.totalQuantity;
        break;

      case 'any':
        // Any purchase qualifies
        current = cartState.items.length > 0 ? 1 : 0;
        break;

      default:
        current = 0;
    }

    const remaining = Math.max(0, required - current);
    const percent = required > 0 ? Math.min(100, (current / required) * 100) : 0;
    const isMet = current >= required;

    return {
      current,
      required,
      remaining,
      percent,
      isMet
    };
  }

  private renderProgress(progress: ConditionProgress): void {
    // Update current value
    this.updateElements('data-condition-current', progress.current.toString());

    // Update remaining value
    this.updateElements('data-condition-remaining', progress.remaining.toString());

    // Update status
    const statusText = progress.isMet ? 'met' : 'not-met';
    this.updateElements('data-condition-status', statusText);

    // Update progress text
    if (this.showProgress) {
      const progressText = `${progress.current}/${progress.required}`;
      this.updateElements('data-condition-progress-text', progressText);

      // Update progress percentage
      const percentText = `${Math.round(progress.percent)}%`;
      this.updateElements('data-condition-progress-percent', percentText);

      // Update progress bar fill
      const progressFills = this.displayElements.get('data-condition-progress-fill');
      if (progressFills) {
        progressFills.forEach(fill => {
          fill.style.width = `${progress.percent}%`;
          fill.setAttribute('data-progress', progress.percent.toString());
        });
      }
    }

    // Show/hide validation messages
    if (this.showValidation) {
      const metMessages = this.displayElements.get('data-condition-met-message');
      const notMetMessages = this.displayElements.get('data-condition-not-met-message');

      if (metMessages) {
        metMessages.forEach(msg => {
          msg.style.display = progress.isMet ? '' : 'none';
        });
      }

      if (notMetMessages) {
        notMetMessages.forEach(msg => {
          msg.style.display = progress.isMet ? 'none' : '';

          // Update message with remaining count
          if (progress.remaining > 0 && this.condition) {
            const itemText = progress.remaining === 1 ? 'item' : 'items';
            const defaultMessage = `Add ${progress.remaining} more ${itemText} to qualify`;
            if (!msg.hasAttribute('data-original-text')) {
              msg.setAttribute('data-original-text', msg.textContent || '');
            }
            const originalText = msg.getAttribute('data-original-text') || defaultMessage;
            msg.textContent = originalText.replace('{remaining}', progress.remaining.toString());
          }
        });
      }
    }

    // Update CSS classes
    this.element.classList.toggle('condition-met', progress.isMet);
    this.element.classList.toggle('condition-not-met', !progress.isMet);
    this.element.setAttribute('data-condition-met', progress.isMet.toString());

    // Auto-hide if configured
    if (this.autoHideWhenMet) {
      this.element.style.display = progress.isMet ? 'none' : '';
    }

    this.logger.debug('Updated condition progress:', progress);
  }

  private updateElements(selector: string, value: string): void {
    const elements = this.displayElements.get(selector);

    if (!elements || elements.length === 0) return;

    elements.forEach(element => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
      } else {
        element.textContent = value;
      }

      element.setAttribute('data-value', value);
    });
  }

  public update(): void {
    const cartState = useCartStore.getState();
    this.updateProgress(cartState);
  }

  public async refreshCondition(): Promise<void> {
    await this.loadOfferData();
    this.renderCondition();
    this.update();
  }

  public getProgress(): ConditionProgress | undefined {
    return this.lastProgress;
  }

  public isMet(): boolean {
    return this.lastProgress?.isMet ?? false;
  }

  public override destroy(): void {
    this.displayElements.clear();

    if (this.condition) {
      this.element.classList.remove(`condition-type-${this.condition.type}`);
    }

    this.element.classList.remove('condition-met', 'condition-not-met');

    super.destroy();
  }
}

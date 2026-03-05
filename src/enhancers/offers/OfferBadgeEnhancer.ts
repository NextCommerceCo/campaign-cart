/**
 * Offer Badge Enhancer
 * Dynamically displays and manages offer badges (Most Popular, Best Deal, etc.)
 *
 * This enhancer automatically applies badges to offer packages based on
 * configuration or dynamically based on offer conditions and savings.
 *
 * @example
 * <!-- Static badge -->
 * <div data-next-offer-badge
 *      data-next-badge-text="Most Popular"
 *      data-next-badge-type="popular">
 * </div>
 *
 * <!-- Dynamic badge based on offer -->
 * <div data-next-offer-badge
 *      data-next-offer-id="123"
 *      data-next-auto-detect="true">
 * </div>
 *
 * <!-- Badge with custom styling -->
 * <div data-next-offer-badge
 *      data-next-badge-text="Limited Time"
 *      data-next-badge-type="limited"
 *      data-next-badge-icon="⭐"
 *      data-next-badge-position="top-right">
 * </div>
 *
 * Attributes:
 * - data-next-offer-badge: Main identifier
 * - data-next-badge-text: Static badge text
 * - data-next-badge-type: Badge type (popular, deal, limited, discount, new)
 * - data-next-badge-icon: Icon/emoji to show (optional)
 * - data-next-badge-position: Position (top-left, top-right, bottom-left, bottom-right)
 * - data-next-offer-id: Offer ID for dynamic detection
 * - data-next-auto-detect: Auto-detect badge type from offer data
 * - data-next-show-savings: Show savings percentage in badge
 * - data-next-highlight: Highlight/animate the badge
 *
 * Badge Types:
 * - popular: Most Popular
 * - deal: Best Deal / Best Value
 * - limited: Limited Time / Limited Offer
 * - discount: Discount percentage
 * - new: New Offer
 * - recommended: Recommended
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCampaignStore } from '@/stores/campaignStore';
import type { Offer } from '@/types/campaign';

type BadgeType = 'popular' | 'deal' | 'limited' | 'discount' | 'new' | 'recommended' | 'custom';
type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BadgeConfig {
  text: string;
  type: BadgeType;
  icon?: string;
  position: BadgePosition;
  showSavings: boolean;
  highlight: boolean;
  savingsPercent?: number;
}

export class OfferBadgeEnhancer extends BaseEnhancer {
  private badgeConfig: BadgeConfig;
  private badgeElement?: HTMLElement;
  private offerId?: number;
  private offerData?: Offer;
  private autoDetect: boolean = false;

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    const badgeText = this.getAttribute('data-next-badge-text');
    const badgeType = (this.getAttribute('data-next-badge-type') || 'custom') as BadgeType;
    const badgeIcon = this.getAttribute('data-next-badge-icon') || undefined;
    const badgePosition = (this.getAttribute('data-next-badge-position') || 'top-right') as BadgePosition;
    const showSavings = this.getAttribute('data-next-show-savings') === 'true';
    const highlight = this.getAttribute('data-next-highlight') === 'true';
    const offerIdAttr = this.getAttribute('data-next-offer-id');
    this.offerId = offerIdAttr ? parseInt(offerIdAttr, 10) : undefined;
    this.autoDetect = this.getAttribute('data-next-auto-detect') === 'true';

    // Load offer data if offer ID provided
    if (this.offerId) {
      await this.loadOfferData();
    }

    // Build badge configuration
    this.badgeConfig = {
      text: badgeText || '',
      type: badgeType,
      icon: badgeIcon,
      position: badgePosition,
      showSavings,
      highlight
    };

    // Auto-detect badge type if enabled
    if (this.autoDetect && this.offerData) {
      this.detectBadgeFromOffer();
    }

    // Create badge element
    this.createBadge();

    this.logger.debug('OfferBadgeEnhancer initialized:', {
      type: this.badgeConfig.type,
      text: this.badgeConfig.text,
      position: this.badgeConfig.position
    });
  }

  private async loadOfferData(): Promise<void> {
    try {
      const campaignStore = useCampaignStore.getState();
      const campaign = campaignStore.campaign;

      if (campaign?.offers && this.offerId) {
        this.offerData = campaign.offers.find(offer => offer.ref_id === this.offerId);

        if (this.offerData) {
          this.logger.debug('Loaded offer data for badge:', this.offerData);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load offer data:', error);
    }
  }

  private detectBadgeFromOffer(): void {
    if (!this.offerData) return;

    const benefit = this.offerData.benefit;

    // Calculate savings percentage
    if (benefit && (benefit.type === 'package_percentage' ||
                    benefit.type === 'order_percentage' ||
                    benefit.type === 'shipping_percentage')) {

      const savingsPercent = parseFloat(benefit.value);
      this.badgeConfig.savingsPercent = savingsPercent;

      // Auto-detect badge type based on savings
      if (savingsPercent >= 60) {
        this.badgeConfig.type = 'deal';
        this.badgeConfig.text = 'Best Deal';
        this.badgeConfig.icon = this.badgeConfig.icon || '⭐';
      } else if (savingsPercent >= 50) {
        this.badgeConfig.type = 'popular';
        this.badgeConfig.text = 'Most Popular';
        this.badgeConfig.icon = this.badgeConfig.icon || '🔥';
      } else if (savingsPercent >= 40) {
        this.badgeConfig.type = 'discount';
        this.badgeConfig.text = `${savingsPercent}% OFF`;
      } else {
        this.badgeConfig.type = 'discount';
        this.badgeConfig.text = `Save ${savingsPercent}%`;
      }
    }

    // Check for voucher type (limited/exclusive)
    if (this.offerData.type === 'voucher') {
      this.badgeConfig.type = 'limited';
      this.badgeConfig.text = this.badgeConfig.text || 'Limited Offer';
    }

    this.logger.debug('Auto-detected badge:', {
      type: this.badgeConfig.type,
      text: this.badgeConfig.text,
      savings: this.badgeConfig.savingsPercent
    });
  }

  private createBadge(): void {
    // Check if badge element already exists in the DOM
    let existingBadge = this.element.querySelector('.next-offer-badge') as HTMLElement;

    if (existingBadge) {
      this.badgeElement = existingBadge;
      this.updateBadgeContent();
    } else {
      // Create new badge element
      this.badgeElement = document.createElement('div');
      this.badgeElement.className = 'next-offer-badge';

      // Add content
      this.updateBadgeContent();

      // Add to element
      this.element.appendChild(this.badgeElement);
    }

    // Apply positioning
    this.applyBadgePosition();

    // Apply styling classes
    this.applyBadgeClasses();

    // Make element position relative if not already
    const elementPosition = window.getComputedStyle(this.element).position;
    if (elementPosition === 'static') {
      this.element.style.position = 'relative';
    }
  }

  private updateBadgeContent(): void {
    if (!this.badgeElement) return;

    let content = '';

    // Add icon if present
    if (this.badgeConfig.icon) {
      content += `<span class="badge-icon">${this.badgeConfig.icon}</span>`;
    }

    // Add text
    if (this.badgeConfig.text) {
      content += `<span class="badge-text">${this.badgeConfig.text}</span>`;
    }

    // Add savings if configured
    if (this.badgeConfig.showSavings && this.badgeConfig.savingsPercent) {
      content += `<span class="badge-savings">${this.badgeConfig.savingsPercent}% OFF</span>`;
    }

    this.badgeElement.innerHTML = content;

    // Set data attributes
    this.badgeElement.setAttribute('data-badge-type', this.badgeConfig.type);
    if (this.badgeConfig.savingsPercent) {
      this.badgeElement.setAttribute('data-savings', this.badgeConfig.savingsPercent.toString());
    }
  }

  private applyBadgePosition(): void {
    if (!this.badgeElement) return;

    // Remove all position classes
    this.badgeElement.classList.remove(
      'badge-top-left',
      'badge-top-right',
      'badge-bottom-left',
      'badge-bottom-right'
    );

    // Add current position class
    this.badgeElement.classList.add(`badge-${this.badgeConfig.position}`);

    // Apply CSS positioning
    switch (this.badgeConfig.position) {
      case 'top-left':
        this.badgeElement.style.top = '0';
        this.badgeElement.style.left = '0';
        this.badgeElement.style.right = 'auto';
        this.badgeElement.style.bottom = 'auto';
        break;

      case 'top-right':
        this.badgeElement.style.top = '0';
        this.badgeElement.style.right = '0';
        this.badgeElement.style.left = 'auto';
        this.badgeElement.style.bottom = 'auto';
        break;

      case 'bottom-left':
        this.badgeElement.style.bottom = '0';
        this.badgeElement.style.left = '0';
        this.badgeElement.style.right = 'auto';
        this.badgeElement.style.top = 'auto';
        break;

      case 'bottom-right':
        this.badgeElement.style.bottom = '0';
        this.badgeElement.style.right = '0';
        this.badgeElement.style.left = 'auto';
        this.badgeElement.style.top = 'auto';
        break;
    }
  }

  private applyBadgeClasses(): void {
    if (!this.badgeElement) return;

    // Add type class
    this.badgeElement.classList.add(`badge-${this.badgeConfig.type}`);

    // Add highlight class if configured
    if (this.badgeConfig.highlight) {
      this.badgeElement.classList.add('badge-highlight');
    }

    // Add to parent element as well for CSS targeting
    this.element.classList.add('has-offer-badge');
    this.element.setAttribute('data-badge-type', this.badgeConfig.type);
  }

  public updateBadgeText(text: string): void {
    this.badgeConfig.text = text;
    this.updateBadgeContent();
  }

  public updateBadgeType(type: BadgeType): void {
    if (this.badgeElement) {
      // Remove old type class
      this.badgeElement.classList.remove(`badge-${this.badgeConfig.type}`);
      this.element.classList.remove(`badge-${this.badgeConfig.type}`);
    }

    this.badgeConfig.type = type;

    if (this.badgeElement) {
      // Add new type class
      this.badgeElement.classList.add(`badge-${type}`);
      this.element.setAttribute('data-badge-type', type);
    }
  }

  public updateBadgePosition(position: BadgePosition): void {
    this.badgeConfig.position = position;
    this.applyBadgePosition();
  }

  public showBadge(): void {
    if (this.badgeElement) {
      this.badgeElement.style.display = '';
      this.element.classList.add('has-offer-badge');
    }
  }

  public hideBadge(): void {
    if (this.badgeElement) {
      this.badgeElement.style.display = 'none';
      this.element.classList.remove('has-offer-badge');
    }
  }

  public toggleHighlight(enable: boolean): void {
    this.badgeConfig.highlight = enable;

    if (this.badgeElement) {
      this.badgeElement.classList.toggle('badge-highlight', enable);
    }
  }

  public getBadgeConfig(): BadgeConfig {
    return { ...this.badgeConfig };
  }

  public override destroy(): void {
    if (this.badgeElement && this.badgeElement.parentNode) {
      this.badgeElement.parentNode.removeChild(this.badgeElement);
    }

    this.element.classList.remove('has-offer-badge');
    this.element.removeAttribute('data-badge-type');

    super.destroy();
  }
}

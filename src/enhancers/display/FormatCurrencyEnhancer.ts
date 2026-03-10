/**
 * Format Currency Enhancer
 * Formats a static numeric value as currency using the campaign currency or an explicit override.
 *
 * Usage:
 *   <!-- Use element text content as value, campaign currency -->
 *   <span data-next-format-currency>29.99</span>
 *
 *   <!-- Explicit value via attribute -->
 *   <span data-next-format-currency data-value="29.99"></span>
 *
 *   <!-- Override currency -->
 *   <span data-next-format-currency data-currency="EUR">29.99</span>
 *
 *   <!-- Hide zero cents ($29 instead of $29.00) -->
 *   <span data-next-format-currency data-hide-zero-cents="true">29.00</span>
 */

import { BaseEnhancer } from '../base/BaseEnhancer';
import { CurrencyFormatter } from '@/utils/currencyFormatter';

export class FormatCurrencyEnhancer extends BaseEnhancer {
  /** Raw numeric value to format (captured at init time) */
  private rawValue: number | null = null;
  /** Explicit currency override from data-currency attribute */
  private currencyOverride: string | undefined;
  private hideZeroCents: boolean = false;
  private currencyChangeHandler: () => void;

  constructor(element: HTMLElement) {
    super(element);
    this.currencyChangeHandler = () => {
      CurrencyFormatter.clearCache();
      this.render();
    };
  }

  public initialize(): void {
    // Resolve raw value: data-value attr takes priority, then text content
    const attrValue = this.getAttribute('data-value');
    const textValue = this.element.textContent?.trim() ?? '';
    const raw = attrValue !== null ? attrValue : textValue;

    const parsed = parseFloat(raw);
    this.rawValue = isNaN(parsed) ? null : parsed;

    this.currencyOverride = this.getAttribute('data-currency') ?? undefined;
    this.hideZeroCents = this.getAttribute('data-hide-zero-cents') === 'true';

    // Listen for currency changes so formatting stays up to date
    document.addEventListener('next:currency-changed', this.currencyChangeHandler);

    this.render();
    this.logger.debug('FormatCurrencyEnhancer initialized', {
      rawValue: this.rawValue,
      currency: this.currencyOverride ?? '(campaign default)',
    });
  }

  public update(): void {
    this.render();
  }

  public override destroy(): void {
    document.removeEventListener('next:currency-changed', this.currencyChangeHandler);
    super.destroy();
  }

  private render(): void {
    if (this.rawValue === null) {
      this.logger.warn('FormatCurrencyEnhancer: no valid numeric value to format', this.element);
      return;
    }

    const formatted = CurrencyFormatter.formatCurrency(
      this.rawValue,
      this.currencyOverride,
      { hideZeroCents: this.hideZeroCents }
    );

    if (this.element instanceof HTMLInputElement || this.element instanceof HTMLTextAreaElement) {
      this.element.value = formatted;
    } else {
      this.element.textContent = formatted;
    }
  }
}

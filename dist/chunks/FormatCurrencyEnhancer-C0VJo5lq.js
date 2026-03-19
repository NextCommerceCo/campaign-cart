import { B as BaseEnhancer } from "./index-WbFNZle8.js";
import { y as CurrencyFormatter } from "./utils-CQa_9vcu.js";
class FormatCurrencyEnhancer extends BaseEnhancer {
  constructor(element) {
    super(element);
    this.rawValue = null;
    this.hideZeroCents = false;
    this.currencyChangeHandler = () => {
      CurrencyFormatter.clearCache();
      this.render();
    };
  }
  initialize() {
    const attrValue = this.getAttribute("data-value");
    const textValue = this.element.textContent?.trim() ?? "";
    const raw = attrValue !== null ? attrValue : textValue;
    const parsed = parseFloat(raw);
    this.rawValue = isNaN(parsed) ? null : parsed;
    this.currencyOverride = this.getAttribute("data-currency") ?? void 0;
    this.hideZeroCents = this.getAttribute("data-hide-zero-cents") === "true";
    document.addEventListener("next:currency-changed", this.currencyChangeHandler);
    this.render();
    this.logger.debug("FormatCurrencyEnhancer initialized", {
      rawValue: this.rawValue,
      currency: this.currencyOverride ?? "(campaign default)"
    });
  }
  update() {
    this.render();
  }
  destroy() {
    document.removeEventListener("next:currency-changed", this.currencyChangeHandler);
    super.destroy();
  }
  render() {
    if (this.rawValue === null) {
      this.logger.warn("FormatCurrencyEnhancer: no valid numeric value to format", this.element);
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
export {
  FormatCurrencyEnhancer
};

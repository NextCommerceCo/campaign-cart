import { a as useCampaignStore, c as configStore, g as useParameterStore } from "./state-Cak3W8JX.js";
import { c as createLogger } from "./analytics-rw-aPuCY.js";
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const nameEQ = `${name}=`;
  for (const raw of document.cookie.split(";")) {
    const cookie = raw.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  return null;
}
const _CurrencyFormatter = class _CurrencyFormatter {
  /**
   * Get the current currency from stores
   */
  static getCurrentCurrency() {
    return useCampaignStore.getState()?.currency ?? configStore.getState().getCurrency();
  }
  /**
   * Get the user's locale (checking for override first)
   */
  static getUserLocale() {
    const selectedLocale = sessionStorage.getItem("next_selected_locale");
    if (selectedLocale) {
      return selectedLocale;
    }
    return navigator.language || "en-US";
  }
  /**
   * Clear all cached formatters (call when locale or currency changes)
   */
  static clearCache() {
    this.formatters.clear();
    this.formattersNoZeroCents.clear();
    this.numberFormatter = null;
  }
  /**
   * Get or create a currency formatter
   */
  static getCurrencyFormatter(currency, hideZeroCents = false) {
    const locale = this.getUserLocale();
    const key = `${locale}-${currency}-${hideZeroCents}`;
    const cache = hideZeroCents ? this.formattersNoZeroCents : this.formatters;
    if (!cache.has(key)) {
      const options = {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol"
        // Use narrowSymbol to avoid A$, CA$, etc.
      };
      if (hideZeroCents) {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 2;
      }
      cache.set(key, new Intl.NumberFormat(locale, options));
    }
    return cache.get(key);
  }
  /**
   * Get or create a number formatter
   */
  static getNumberFormatter() {
    const locale = this.getUserLocale();
    if (!this.numberFormatter) {
      this.numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    return this.numberFormatter;
  }
  /**
   * Format a value as currency
   */
  static formatCurrency(value, currency, options) {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return "";
    }
    const currencyCode = currency || this.getCurrentCurrency();
    const formatter = this.getCurrencyFormatter(
      currencyCode,
      options?.hideZeroCents
    );
    return formatter.format(numValue);
  }
  /**
   * Format a number (non-currency)
   */
  static formatNumber(value) {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return "";
    }
    return this.getNumberFormatter().format(numValue);
  }
  /**
   * Format a percentage
   */
  static formatPercentage(value, decimals = 0) {
    return `${Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)}%`;
  }
  /**
   * Extract currency symbol from current currency
   */
  static getCurrencySymbol(currency) {
    const currencyCode = currency || this.getCurrentCurrency();
    const formatter = this.getCurrencyFormatter(currencyCode);
    const formatted = formatter.format(0);
    return formatted.replace(/[0-9.,\s]/g, "").trim();
  }
  /**
   * Check if a string is already formatted with the current currency
   */
  static isAlreadyFormatted(value, currency) {
    if (typeof value !== "string") return false;
    const symbol = this.getCurrencySymbol(currency);
    return value.includes(symbol);
  }
};
_CurrencyFormatter.formatters = /* @__PURE__ */ new Map();
_CurrencyFormatter.formattersNoZeroCents = /* @__PURE__ */ new Map();
_CurrencyFormatter.numberFormatter = null;
let CurrencyFormatter = _CurrencyFormatter;
const formatCurrency = CurrencyFormatter.formatCurrency.bind(CurrencyFormatter);
const formatNumber = CurrencyFormatter.formatNumber.bind(CurrencyFormatter);
const formatPercentage = CurrencyFormatter.formatPercentage.bind(CurrencyFormatter);
CurrencyFormatter.getCurrencySymbol.bind(CurrencyFormatter);
function formatDiscountPercentage(value) {
  if (value == null || value === "") return "";
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "";
  return formatPercentage(n, Number.isInteger(n) ? 0 : 2);
}
const currencyFormatter = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  CurrencyFormatter,
  formatCurrency,
  formatDiscountPercentage,
  formatNumber,
  formatPercentage
});
function replaceVarsPreservingTemplates(html, vars) {
  const parts = html.split(/(<template[\s\S]*?<\/template>)/gi);
  return parts.map(
    (part, i) => i % 2 === 1 ? part : part.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "")
  ).join("");
}
function renderDiscountContainers(root, data) {
  root.querySelectorAll("[data-next-discounts]").forEach((container) => {
    const filter = container.getAttribute("data-next-discounts") ?? "";
    let items;
    switch (filter) {
      case "offer":
        items = data.offerDiscounts;
        break;
      case "voucher":
        items = data.voucherDiscounts;
        break;
      default:
        items = [...data.offerDiscounts, ...data.voucherDiscounts];
        break;
    }
    renderInto(container, items);
  });
}
function renderFlatDiscountContainers(root, discounts) {
  root.querySelectorAll("[data-next-discounts]").forEach((container) => {
    renderInto(container, discounts);
  });
}
function renderInto(container, items) {
  const tpl = container.querySelector(
    ":scope > template"
  );
  if (!tpl) return;
  const templateHTML = tpl.innerHTML.trim();
  clearChildren(container);
  const empty = items.length === 0;
  container.classList.toggle("next-discounts-empty", empty);
  container.classList.toggle("next-discounts-has-items", !empty);
  for (const d of items) {
    const html = renderItem(templateHTML, d);
    const node = htmlToNode(html);
    if (node) container.appendChild(node);
  }
}
function renderItem(template, d) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    switch (key) {
      case "discount.name":
        return d.name ?? "";
      case "discount.amount":
        return formatCurrency(d.amount);
      case "discount.description":
        return d.description ?? "";
      case "discount.percentage":
        return formatDiscountPercentage(d.percentage);
      default:
        return "";
    }
  });
}
function htmlToNode(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}
function clearChildren(container) {
  for (const node of Array.from(container.childNodes)) {
    if (node.tagName?.toLowerCase() !== "template") {
      node.parentNode?.removeChild(node);
    }
  }
}
function isTruthyVar(value) {
  if (value == null || value === "") return false;
  return value !== "hide" && value !== "false";
}
function applySlotConditionals(root, vars) {
  root.querySelectorAll("[data-next-show]").forEach((el) => {
    const key = el.getAttribute("data-next-show");
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? "" : "none";
      el.removeAttribute("data-next-show");
    }
  });
  root.querySelectorAll("[data-next-hide]").forEach((el) => {
    const key = el.getAttribute("data-next-hide");
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? "none" : "";
      el.removeAttribute("data-next-hide");
    }
  });
}
class TemplateRenderer {
  /**
   * Renders a template string by replacing {placeholder} patterns with actual values
   * @param template - Template string with {key.subkey} placeholders
   * @param options - Data, formatters, and default values
   * @returns Rendered HTML string
   */
  static render(template, options) {
    const { data, formatters = {}, defaultValues = {} } = options;
    const replacer = (part) => part.replace(/\{([^}]+)\}/g, (_, placeholder) => {
      try {
        const value = this.getValue(data, placeholder);
        const formattedValue = this.formatValue(
          value,
          placeholder,
          formatters
        );
        if (formattedValue === "" || formattedValue === null || formattedValue === void 0) {
          return defaultValues[placeholder] || "";
        }
        return String(formattedValue);
      } catch (error) {
        console.warn(
          `Template rendering error for placeholder ${placeholder}:`,
          error
        );
        return defaultValues[placeholder] || "";
      }
    });
    const parts = template.split(/(<template[\s\S]*?<\/template>)/gi);
    return parts.map((part, i) => i % 2 === 1 ? part : replacer(part)).join("");
  }
  /**
   * Extracts nested property value from data object
   * Handles paths like "item.price", "item.price.raw", "item.showUpsell"
   */
  static getValue(data, path) {
    const keys = path.split(".");
    let current = data;
    for (const key of keys) {
      if (current === null || current === void 0) {
        return void 0;
      }
      current = current[key];
    }
    return current;
  }
  /**
   * Applies formatting based on placeholder path and available formatters
   */
  static formatValue(value, placeholder, formatters) {
    if (placeholder.endsWith(".raw")) {
      return value;
    }
    const currencyFields = [
      "price",
      "total",
      "savings",
      "amount",
      "cost",
      "fee",
      "charge",
      "compare",
      "retail",
      "recurring",
      "subtotal",
      "tax",
      "shipping",
      "discount",
      "credit",
      "balance",
      "payment",
      "refund"
    ];
    const shouldFormatAsCurrency = currencyFields.some(
      (field) => placeholder.toLowerCase().includes(field.toLowerCase())
    );
    if (shouldFormatAsCurrency && typeof value === "number") {
      return formatters.currency ? formatters.currency(value) : value;
    }
    if (shouldFormatAsCurrency && typeof value === "string" && !isNaN(parseFloat(value))) {
      return formatters.currency ? formatters.currency(parseFloat(value)) : value;
    }
    if (placeholder.includes("date") || placeholder.includes("created_at")) {
      return formatters.date ? formatters.date(value) : value;
    }
    if (typeof value === "string" && (placeholder.includes("name") || placeholder.includes("title") || placeholder.includes("description"))) {
      return formatters.escapeHtml ? formatters.escapeHtml(value) : value;
    }
    return value;
  }
  /**
   * Validates template for common issues
   * Returns list of potential problems
   */
  static validateTemplate(template, availablePlaceholders) {
    const issues = [];
    const usedPlaceholders = this.extractPlaceholders(template);
    for (const placeholder of usedPlaceholders) {
      const basePlaceholder = placeholder.replace(".raw", "");
      if (!availablePlaceholders.some((p) => p.startsWith(basePlaceholder))) {
        issues.push(`Unknown placeholder: {${placeholder}}`);
      }
    }
    const unclosed = template.match(/\{[^}]*$/g);
    if (unclosed) {
      issues.push(`Unclosed placeholders found: ${unclosed.join(", ")}`);
    }
    return issues;
  }
  /**
   * Extracts all placeholders from template
   */
  static extractPlaceholders(template) {
    const matches = template.match(/\{([^}]+)\}/g) || [];
    return matches.map((match) => match.slice(1, -1));
  }
  /**
   * Creates default formatters that both cart and order enhancers can use
   */
  static createDefaultFormatters() {
    return {
      currency: (amount) => {
        const { formatCurrency: formatCurrency2 } = require("@/utils/currencyFormatter");
        return formatCurrency2(amount);
      },
      date: (dateValue) => {
        if (!dateValue) return "";
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return String(dateValue);
          return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }).format(date);
        } catch {
          return String(dateValue);
        }
      },
      escapeHtml: (text) => {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      }
    };
  }
}
function preserveQueryParams(targetUrl, preserveParams = "all") {
  try {
    const url = new URL(targetUrl, window.location.origin);
    if (preserveParams === "all") {
      const paramStore = useParameterStore.getState();
      const storedParams = paramStore.params;
      const currentParams = new URLSearchParams(window.location.search);
      const currentParamsObj = {};
      currentParams.forEach((value, key) => {
        currentParamsObj[key] = value;
      });
      if (Object.keys(currentParamsObj).length > 0) {
        paramStore.mergeParams(currentParamsObj);
      }
      const allParams = { ...storedParams, ...currentParamsObj };
      Object.entries(allParams).forEach(([key, value]) => {
        if (!url.searchParams.has(key)) {
          url.searchParams.append(key, value);
        }
      });
    } else {
      const currentParams = new URLSearchParams(window.location.search);
      preserveParams.forEach((param) => {
        const value = currentParams.get(param);
        if (value && !url.searchParams.has(param)) {
          url.searchParams.append(param, value);
        }
      });
    }
    return url.href;
  } catch (error) {
    console.error("[URL Utils] Error preserving query parameters:", error);
    return targetUrl;
  }
}
class FieldFinder {
  /**
   * Find a field by name using multiple selector strategies
   */
  static findField(fieldName, options = {}) {
    const container = options.container || document;
    const defaultSelectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `input[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `#${fieldName}`,
      `[data-field="${fieldName}"]`,
      `[data-field-name="${fieldName}"]`
    ];
    const selectors = options.customSelectors || defaultSelectors;
    for (const selector of selectors) {
      try {
        const element = container.querySelector(selector);
        if (element) {
          const htmlElement = element;
          if (!options.includeHidden && htmlElement.offsetParent === null) {
            continue;
          }
          if (!options.includeDisabled && "disabled" in htmlElement) {
            const inputElement = htmlElement;
            if (inputElement.disabled) continue;
          }
          return htmlElement;
        }
      } catch (e) {
        console.warn(`Invalid selector: ${selector}`);
      }
    }
    return null;
  }
  /**
   * Find multiple fields by names
   */
  static findFields(fieldNames, options = {}) {
    const fields = /* @__PURE__ */ new Map();
    fieldNames.forEach((name) => {
      const field = this.findField(name, options);
      if (field) {
        fields.set(name, field);
      }
    });
    return fields;
  }
  /**
   * Find field wrapper element
   */
  static findFieldWrapper(field, customSelectors) {
    const wrapperSelectors = customSelectors || [
      ".form-group",
      ".frm-flds",
      ".form-input",
      ".select-form-wrapper",
      ".field-wrapper",
      ".input-wrapper",
      ".form-field"
    ];
    for (const selector of wrapperSelectors) {
      const wrapper = field.closest(selector);
      if (wrapper) return wrapper;
    }
    return field.parentElement;
  }
  /**
   * Find form container for a field
   */
  static findFormContainer(field) {
    return field.closest("form");
  }
  /**
   * Find label for a field
   */
  static findFieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label;
    }
    let parent = field.parentElement;
    while (parent) {
      const label = parent.querySelector("label");
      if (label) return label;
      if (parent.tagName === "LABEL") {
        return parent;
      }
      parent = parent.parentElement;
    }
    const wrapper = this.findFieldWrapper(field);
    if (wrapper) {
      const label = wrapper.querySelector("label");
      if (label) return label;
    }
    return null;
  }
  /**
   * Find all form fields in a container
   */
  static findAllFormFields(container, options = {}) {
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      "select",
      "textarea"
    ];
    if (options.includeButtons) {
      selectors.push("button", 'input[type="submit"]', 'input[type="button"]');
    }
    const fields = [];
    const elements = container.querySelectorAll(selectors.join(", "));
    elements.forEach((element) => {
      fields.push(element);
    });
    return fields;
  }
  /**
   * Find fields by attribute pattern
   */
  static findFieldsByAttribute(attributeName, pattern, container = document.body) {
    const fields = [];
    const selector = pattern ? `[${attributeName}]` : `[${attributeName}]`;
    const elements = container.querySelectorAll(selector);
    elements.forEach((element) => {
      const attrValue = element.getAttribute(attributeName);
      if (!pattern || !attrValue) {
        fields.push(element);
      } else if (typeof pattern === "string") {
        if (attrValue.includes(pattern)) {
          fields.push(element);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(attrValue)) {
          fields.push(element);
        }
      }
    });
    return fields;
  }
  /**
   * Check if element is a form field
   */
  static isFormField(element) {
    const fieldTags = ["INPUT", "SELECT", "TEXTAREA"];
    return fieldTags.includes(element.tagName);
  }
  /**
   * Get field type
   */
  static getFieldType(field) {
    if (field instanceof HTMLInputElement) {
      return field.type || "text";
    } else if (field instanceof HTMLSelectElement) {
      return "select";
    } else if (field instanceof HTMLTextAreaElement) {
      return "textarea";
    }
    return "unknown";
  }
  /**
   * Get field value safely
   */
  static getFieldValue(field) {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      return field.value;
    }
    return "";
  }
  /**
   * Set field value safely
   */
  static setFieldValue(field, value) {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }
}
const DEFAULT_OPTIONS = {
  wrapperClass: "form-group",
  errorClass: "next-error-field",
  errorLabelClass: "next-error-label",
  successClass: "no-error",
  iconErrorClass: "addErrorIcon",
  iconSuccessClass: "addTick"
};
class ErrorDisplayManager {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  /**
   * Show error on a field with consistent styling
   */
  showFieldError(field, message) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    if (!wrapper) return;
    this.clearFieldError(field);
    field.classList.add("has-error", this.options.errorClass);
    field.classList.remove(this.options.successClass);
    wrapper.classList.add(this.options.iconErrorClass);
    wrapper.classList.remove(this.options.iconSuccessClass);
    const errorElement = document.createElement("div");
    errorElement.className = this.options.errorLabelClass;
    errorElement.textContent = message;
    errorElement.setAttribute("role", "alert");
    errorElement.setAttribute("aria-live", "polite");
    const formGroup = field.closest(`.${this.options.wrapperClass}`);
    if (formGroup) {
      formGroup.appendChild(errorElement);
    } else {
      wrapper.appendChild(errorElement);
    }
  }
  /**
   * Clear error from a field
   */
  clearFieldError(field) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    field.classList.remove("has-error", this.options.errorClass);
    if (wrapper) {
      wrapper.classList.remove(this.options.iconErrorClass);
      const errorLabel = wrapper.querySelector(`.${this.options.errorLabelClass}`);
      if (errorLabel) {
        errorLabel.remove();
      }
      const formGroup = field.closest(`.${this.options.wrapperClass}`);
      if (formGroup) {
        const formGroupError = formGroup.querySelector(`.${this.options.errorLabelClass}`);
        if (formGroupError) {
          formGroupError.remove();
        }
      }
    }
  }
  /**
   * Show field as valid with success styling
   */
  showFieldValid(field) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    this.clearFieldError(field);
    field.classList.add(this.options.successClass);
    if (wrapper) {
      wrapper.classList.add(this.options.iconSuccessClass);
    }
  }
  /**
   * Clear all error displays in a container
   */
  clearAllErrors(container) {
    const errorLabels = container.querySelectorAll(`.${this.options.errorLabelClass}`);
    errorLabels.forEach((label) => label.remove());
    const errorFields = container.querySelectorAll(`.${this.options.errorClass}, .has-error`);
    errorFields.forEach((field) => {
      field.classList.remove("has-error", this.options.errorClass);
    });
    const errorWrappers = container.querySelectorAll(`.${this.options.iconErrorClass}`);
    errorWrappers.forEach((wrapper) => {
      wrapper.classList.remove(this.options.iconErrorClass);
    });
  }
  /**
   * Display multiple field errors at once
   */
  displayErrors(errors, container) {
    this.clearAllErrors(container);
    Object.entries(errors).forEach(([fieldName, message]) => {
      const field = this.findField(fieldName, container);
      if (field) {
        this.showFieldError(field, message);
      }
    });
  }
  /**
   * Find a field by name within a container
   */
  findField(fieldName, container) {
    const selectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `[name="${fieldName}"]`,
      `#${fieldName}`
    ];
    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field) return field;
    }
    return null;
  }
  /**
   * Show a toast error message
   */
  static showToastError(message, duration = 1e4) {
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (!(toastHandler instanceof HTMLElement)) return;
    const messageElement = toastHandler.querySelector('[data-os-message="error"]');
    if (messageElement instanceof HTMLElement) {
      messageElement.textContent = message;
      toastHandler.style.display = "flex";
      setTimeout(() => {
        if (toastHandler.style.display === "flex") {
          toastHandler.style.display = "none";
        }
      }, duration);
    }
  }
  /**
   * Hide toast error message
   */
  static hideToastError() {
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (toastHandler instanceof HTMLElement) {
      toastHandler.style.display = "none";
    }
  }
}
class EventHandlerManager {
  constructor() {
    this.handlers = /* @__PURE__ */ new Map();
    this.bindings = [];
  }
  /**
   * Add an event handler with automatic cleanup tracking
   */
  addHandler(element, event, handler, options) {
    if (!element) return;
    if (!this.handlers.has(element)) {
      this.handlers.set(element, /* @__PURE__ */ new Map());
    }
    const elementHandlers = this.handlers.get(element);
    if (elementHandlers.has(event)) {
      const existingHandler = elementHandlers.get(event);
      element.removeEventListener(event, existingHandler);
    }
    element.addEventListener(event, handler, options);
    elementHandlers.set(event, handler);
    const binding = { element, event, handler };
    if (options !== void 0) {
      binding.options = options;
    }
    this.bindings.push(binding);
  }
  /**
   * Add multiple handlers at once
   */
  addHandlers(bindings) {
    bindings.forEach((binding) => {
      this.addHandler(
        binding.element,
        binding.event,
        binding.handler,
        binding.options
      );
    });
  }
  /**
   * Remove a specific handler
   */
  removeHandler(element, event) {
    if (!element) return;
    const elementHandlers = this.handlers.get(element);
    if (!elementHandlers) return;
    const handler = elementHandlers.get(event);
    if (handler) {
      element.removeEventListener(event, handler);
      elementHandlers.delete(event);
      this.bindings = this.bindings.filter(
        (b) => !(b.element === element && b.event === event)
      );
    }
    if (elementHandlers.size === 0) {
      this.handlers.delete(element);
    }
  }
  /**
   * Remove all handlers for a specific element
   */
  removeElementHandlers(element) {
    const elementHandlers = this.handlers.get(element);
    if (!elementHandlers) return;
    elementHandlers.forEach((handler, event) => {
      element.removeEventListener(event, handler);
    });
    this.handlers.delete(element);
    this.bindings = this.bindings.filter((b) => b.element !== element);
  }
  /**
   * Remove all handlers
   */
  removeAllHandlers() {
    this.handlers.forEach((elementHandlers, element) => {
      elementHandlers.forEach((handler, event) => {
        element.removeEventListener(event, handler);
      });
    });
    this.handlers.clear();
    this.bindings = [];
  }
  /**
   * Add event delegation handler
   */
  addDelegatedHandler(container, selector, event, handler) {
    const delegatedHandler = (e) => {
      const target = e.target;
      const matchedElement = target.closest(selector);
      if (matchedElement && container.contains(matchedElement)) {
        handler(e, matchedElement);
      }
    };
    this.addHandler(container, event, delegatedHandler);
  }
  /**
   * Add handler with debounce
   */
  addDebouncedHandler(element, event, handler, delay = 300) {
    let timeoutId;
    const debouncedHandler = (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handler(e);
      }, delay);
    };
    this.addHandler(element, event, debouncedHandler);
  }
  /**
   * Add handler with throttle
   */
  addThrottledHandler(element, event, handler, limit = 300) {
    let inThrottle = false;
    const throttledHandler = (e) => {
      if (!inThrottle) {
        handler(e);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
    this.addHandler(element, event, throttledHandler);
  }
  /**
   * Add one-time handler that auto-removes
   */
  addOnceHandler(element, event, handler) {
    const onceHandler = (e) => {
      handler(e);
      this.removeHandler(element, event);
    };
    this.addHandler(element, event, onceHandler);
  }
  /**
   * Get all active bindings (for debugging)
   */
  getActiveBindings() {
    return [...this.bindings];
  }
  /**
   * Check if element has handler for event
   */
  hasHandler(element, event) {
    const elementHandlers = this.handlers.get(element);
    return elementHandlers ? elementHandlers.has(event) : false;
  }
}
function createCloseButton(onClose) {
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "pac-close-button";
  closeButton.innerHTML = "×";
  closeButton.setAttribute("aria-label", "Close suggestions");
  closeButton.style.cssText = `
    position: absolute;
    top: 0.4rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 20px;
    line-height: 24px;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
    width: 24px;
    height: 24px;
  `;
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.backgroundColor = "#f3f4f6";
  });
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.backgroundColor = "transparent";
  });
  closeButton.addEventListener("click", onClose);
  return closeButton;
}
function getSuccessUrl() {
  const metaTag = document.querySelector('meta[name="next-success-url"]') || document.querySelector('meta[name="next-next-url"]') || document.querySelector('meta[name="os-next-page"]');
  if (metaTag?.content) {
    if (metaTag.content.startsWith("http://") || metaTag.content.startsWith("https://")) {
      return metaTag.content;
    }
    const path = metaTag.content.startsWith("/") ? metaTag.content : "/" + metaTag.content;
    return window.location.origin + path;
  }
  return window.location.origin + "/success";
}
function getFailureUrl() {
  const metaTag = document.querySelector('meta[name="next-failure-url"]') || document.querySelector('meta[name="os-failure-url"]');
  if (metaTag?.content) {
    if (metaTag.content.startsWith("http://") || metaTag.content.startsWith("https://")) {
      return metaTag.content;
    }
    const path = metaTag.content.startsWith("/") ? metaTag.content : "/" + metaTag.content;
    return window.location.origin + path;
  }
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("payment_failed", "true");
  return currentUrl.href;
}
function getNextPageUrlFromMeta(refId) {
  const metaTag = document.querySelector('meta[name="next-success-url"]') || document.querySelector('meta[name="next-next-url"]') || document.querySelector('meta[name="os-next-page"]');
  if (!metaTag?.content) {
    return null;
  }
  const nextPagePath = metaTag.content;
  const redirectUrl = nextPagePath.startsWith("http") ? new URL(nextPagePath) : new URL(nextPagePath, window.location.origin);
  if (refId) {
    redirectUrl.searchParams.append("ref_id", refId);
  }
  return redirectUrl.href;
}
function handleOrderRedirect(order, logger2, emitCallback) {
  let redirectUrl;
  if (order.payment_complete_url) {
    logger2.debug(`Using payment_complete_url from API: ${order.payment_complete_url}`);
    redirectUrl = order.payment_complete_url;
  } else {
    const nextPageUrl = getNextPageUrlFromMeta(order.ref_id);
    if (nextPageUrl) {
      logger2.debug(`Using success URL from meta tag: ${nextPageUrl}`);
      redirectUrl = nextPageUrl;
    } else if (order.order_status_url) {
      logger2.debug(`Using order_status_url from API: ${order.order_status_url}`);
      redirectUrl = order.order_status_url;
    } else {
      logger2.warn("No order_status_url found in API response - using fallback URL");
      redirectUrl = `${window.location.origin}/checkout/confirmation/?ref_id=${order.ref_id || ""}`;
    }
  }
  if (redirectUrl) {
    const finalUrl = preserveQueryParams(redirectUrl);
    logger2.info("Redirecting to:", finalUrl);
    window.location.href = finalUrl;
  } else {
    logger2.error("No redirect URL could be determined");
    emitCallback("order:redirect-missing", { order });
  }
}
const logger = createLogger("PaymentAvailability");
function isApplePayAvailable() {
  try {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      logger.debug("Android device detected - hiding Apple Pay");
      return false;
    }
    logger.debug("Apple Pay available (non-Android device)");
    return true;
  } catch (error) {
    logger.warn("Error checking Apple Pay availability:", error);
    return true;
  }
}
function isGooglePayAvailable() {
  return true;
}
function isPayPalAvailable() {
  return true;
}
function getPaymentCapabilities() {
  return {
    applePay: isApplePayAvailable(),
    googlePay: isGooglePayAvailable(),
    paypal: isPayPalAvailable(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || "unknown"
  };
}
export {
  CurrencyFormatter as C,
  ErrorDisplayManager as E,
  FieldFinder as F,
  TemplateRenderer as T,
  formatPercentage as a,
  renderFlatDiscountContainers as b,
  formatDiscountPercentage as c,
  replaceVarsPreservingTemplates as d,
  applySlotConditionals as e,
  formatCurrency as f,
  getCookie as g,
  EventHandlerManager as h,
  isTruthyVar as i,
  createCloseButton as j,
  getPaymentCapabilities as k,
  isApplePayAvailable as l,
  isGooglePayAvailable as m,
  isPayPalAvailable as n,
  getFailureUrl as o,
  preserveQueryParams as p,
  getSuccessUrl as q,
  renderDiscountContainers as r,
  handleOrderRedirect as s,
  formatNumber as t,
  currencyFormatter as u
};

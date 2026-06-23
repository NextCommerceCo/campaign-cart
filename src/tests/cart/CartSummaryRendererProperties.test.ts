/**
 * Unit tests for the [data-next-item-properties] rendering path inside
 * `buildLineElement` (CartSummaryEnhancer.renderer.ts).
 *
 * happy-dom v18 does not support the `:scope >` child combinator selector, so
 * `propertiesContainer.querySelector(':scope > template')` always returns null
 * in this environment. To let the tests exercise the real rendering logic, a
 * vi.spyOn patches `Element.prototype.querySelector` so that any call with the
 * selector `':scope > template'` falls back to finding the first <template>
 * child element directly. All other selector calls are forwarded to the
 * original implementation unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildLineElement } from '@/enhancers/cart/CartSummary/CartSummaryEnhancer.renderer';
import type { SummaryLine } from '@/types/api';

// ─── happy-dom :scope > workaround ───────────────────────────────────────────

/**
 * happy-dom does not implement the `:scope >` child combinator, so
 * `querySelector(':scope > template')` always returns null even when a
 * <template> child is present. Patch it for the duration of each test so
 * the rendering logic under test can actually reach the template element.
 */
function installScopeTemplatePolyfill() {
  const originalQS = Element.prototype.querySelector;
  vi.spyOn(Element.prototype, 'querySelector').mockImplementation(
    function (this: Element, selector: string): Element | null {
      if (selector === ':scope > template') {
        return (
          Array.from(this.children).find(
            c => c.tagName.toLowerCase() === 'template'
          ) ?? null
        );
      }
      return originalQS.call(this, selector);
    }
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<SummaryLine> = {}): SummaryLine {
  return {
    package_id: 1,
    quantity: 1,
    discounts: [],
    original_unit_price: '10.00',
    original_package_price: '10.00',
    unit_price: '10.00',
    package_price: '10.00',
    subtotal: '10.00',
    total_discount: '0.00',
    total: '10.00',
    ...overrides,
  };
}

/** Template with NO [data-next-item-properties] container. */
const BARE_TEMPLATE = '<div class="item"><span>{item.packageId}</span></div>';

/** Template WITH [data-next-item-properties] container and inner <template>. */
const PROPS_TEMPLATE = `<div class="item">
  <div data-next-item-properties>
    <template><span class="prop">{property.key}:{property.value}</span></template>
  </div>
</div>`;

/** Template WITH [data-next-item-properties] container but NO <template> child. */
const PROPS_NO_TEMPLATE = `<div class="item">
  <div data-next-item-properties></div>
</div>`;

/**
 * Template with multiple occurrences of both tokens in a single template item.
 * Also has the key token in a data-attribute to verify attribute replacement.
 */
const MULTI_TOKEN_TEMPLATE = `<div class="item">
  <div data-next-item-properties>
    <template><span data-key="{property.key}">{property.key} = {property.value} ({property.value})</span></template>
  </div>
</div>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return only the non-<template> children of the properties container. */
function renderedPropertyChildren(container: Element): Element[] {
  return Array.from(container.children).filter(
    c => c.tagName.toLowerCase() !== 'template'
  );
}

function getPropsContainer(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-next-item-properties]');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildLineElement — [data-next-item-properties] rendering', () => {
  // Polyfill is only needed for tests that exercise the properties path.
  // Tests 1 and 2 do not need it (either no container or no template child).
  describe('without the :scope > polyfill (no properties container / no template)', () => {
    // 1. Template WITHOUT [data-next-item-properties] — renders normally, no crash
    it('renders without crash when there is no [data-next-item-properties] container', () => {
      const el = buildLineElement(BARE_TEMPLATE, makeLine());
      expect(el).not.toBeNull();
      expect(el!.querySelector('[data-next-item-properties]')).toBeNull();
    });

    // 2. Container with NO <template> child — no crash, no children appended
    it('does not crash when the properties container has no <template> child', () => {
      const el = buildLineElement(
        PROPS_NO_TEMPLATE,
        makeLine({ properties: { color: 'red' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(container).not.toBeNull();
      // Nothing was appended — no children at all
      expect(container!.children.length).toBe(0);
    });
  });

  describe('with the :scope > template polyfill active', () => {
    beforeEach(() => {
      installScopeTemplatePolyfill();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // 3. Container with <template>, line has no properties (undefined)
    it('adds next-summary-empty and appends no property children when line.properties is undefined', () => {
      const el = buildLineElement(PROPS_TEMPLATE, makeLine({ properties: undefined }));
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(container!.classList.contains('next-summary-empty')).toBe(true);
      expect(container!.classList.contains('next-summary-has-items')).toBe(false);
      expect(renderedPropertyChildren(container!).length).toBe(0);
    });

    // 4. Container with <template>, line has empty properties ({})
    it('adds next-summary-empty and appends no property children when line.properties is {}', () => {
      const el = buildLineElement(PROPS_TEMPLATE, makeLine({ properties: {} }));
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(container!.classList.contains('next-summary-empty')).toBe(true);
      expect(container!.classList.contains('next-summary-has-items')).toBe(false);
      expect(renderedPropertyChildren(container!).length).toBe(0);
    });

    // 5. Container with <template>, one property — one child, next-summary-has-items
    it('renders one child and sets next-summary-has-items when there is one property', () => {
      const el = buildLineElement(
        PROPS_TEMPLATE,
        makeLine({ properties: { color: 'red' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(container!.classList.contains('next-summary-has-items')).toBe(true);
      expect(container!.classList.contains('next-summary-empty')).toBe(false);
      expect(renderedPropertyChildren(container!).length).toBe(1);
    });

    // 6. Container with <template>, multiple properties — one child per property
    it('renders one child per property when there are multiple properties', () => {
      const properties = { color: 'red', size: 'M', material: 'cotton' };
      const el = buildLineElement(PROPS_TEMPLATE, makeLine({ properties }));
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(renderedPropertyChildren(container!).length).toBe(3);
    });

    // 7. Tokens {property.key} and {property.value} replaced correctly
    it('replaces {property.key} and {property.value} tokens in each rendered child', () => {
      const el = buildLineElement(
        PROPS_TEMPLATE,
        makeLine({ properties: { color: 'blue' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      const children = renderedPropertyChildren(container!);
      expect(children[0].textContent).toBe('color:blue');
    });

    it('replaces tokens correctly for each property in a multi-property line', () => {
      const properties = { color: 'red', size: 'XL' };
      const el = buildLineElement(PROPS_TEMPLATE, makeLine({ properties }));
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      const texts = renderedPropertyChildren(container!).map(c => c.textContent);
      expect(texts).toContain('color:red');
      expect(texts).toContain('size:XL');
    });

    // 8. next-summary-empty is toggled off (removed) when properties are present
    it('does not set next-summary-empty when at least one property is present', () => {
      const el = buildLineElement(
        PROPS_TEMPLATE,
        makeLine({ properties: { color: 'green' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      expect(container!.classList.contains('next-summary-empty')).toBe(false);
    });

    // 9. Multiple token occurrences in one template item — all replaced
    it('replaces every occurrence of {property.key} and {property.value} in a single template item', () => {
      const el = buildLineElement(
        MULTI_TOKEN_TEMPLATE,
        makeLine({ properties: { size: 'M' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      const children = renderedPropertyChildren(container!);
      expect(children.length).toBe(1);
      // Template: <span data-key="{property.key}">{property.key} = {property.value} ({property.value})</span>
      // After replacement: <span data-key="size">size = M (M)</span>
      expect(children[0].textContent).toBe('size = M (M)');
      expect(children[0].getAttribute('data-key')).toBe('size');
    });

    // 10. Property value containing HTML special chars — inserted as raw HTML (no escaping)
    it('inserts property values with HTML special characters as raw HTML (no entity escaping)', () => {
      // The renderer uses string.replace — the value is injected verbatim into
      // the HTML string before parsing. A value like '<b>bold</b>' becomes an
      // actual <b> element in the parsed DOM; '&' and '>' stay as-is in text.
      const el = buildLineElement(
        PROPS_TEMPLATE,
        makeLine({ properties: { note: '<b>bold</b> & more > less' } })
      );
      expect(el).not.toBeNull();
      const container = getPropsContainer(el!);
      const children = renderedPropertyChildren(container!);
      expect(children.length).toBe(1);
      // The key token is replaced literally — "note" appears in text content
      // before the colon; the value is parsed as HTML so <b>bold</b> becomes
      // a child element contributing "bold" to the text content.
      const text = children[0].textContent ?? '';
      expect(text).toContain('note:');
      expect(text).toContain('bold');
      expect(text).toContain('& more > less');
    });
  });
});

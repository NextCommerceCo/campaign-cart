/**
 * Shared discount rendering utility for `[data-next-discounts]` containers.
 *
 * Used by CartSummary, BundleSelector, and PackageToggle renderers to populate
 * discount lists from a `<template>` child element.
 *
 * Template variables: `{discount.name}`, `{discount.amount}`, `{discount.description}`
 */

import { formatCurrency } from '@/utils/currencyFormatter';

// ─── Template-safe variable replacement ───────────────────────────────────────

/**
 * Replaces `{key}` placeholders in an HTML string while preserving content
 * inside `<template>` tags. Without this, nested `<template>` content (e.g.
 * discount row templates) has its placeholders wiped by the outer replacement
 * because unknown keys fall back to `''`.
 */
export function replaceVarsPreservingTemplates(
  html: string,
  vars: Record<string, string>,
): string {
  // Split by <template>...</template> blocks; odd indices are template blocks
  const parts = html.split(/(<template[\s\S]*?<\/template>)/gi);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? ''),
    )
    .join('');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiscountItem = {
  name?: string;
  amount: string;
  description?: string;
};

interface DiscountsByType {
  offerDiscounts: DiscountItem[];
  voucherDiscounts: DiscountItem[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders all `[data-next-discounts]` containers inside `root` with
 * offer/voucher filter support.
 *
 * - `data-next-discounts` or `data-next-discounts=""` → all discounts
 * - `data-next-discounts="offer"` → offer discounts only
 * - `data-next-discounts="voucher"` → voucher discounts only
 */
export function renderDiscountContainers(
  root: HTMLElement,
  data: DiscountsByType,
): void {
  root
    .querySelectorAll<HTMLElement>('[data-next-discounts]')
    .forEach(container => {
      const filter = container.getAttribute('data-next-discounts') ?? '';
      let items: DiscountItem[];
      switch (filter) {
        case 'offer':
          items = data.offerDiscounts;
          break;
        case 'voucher':
          items = data.voucherDiscounts;
          break;
        default:
          items = [...data.offerDiscounts, ...data.voucherDiscounts];
          break;
      }
      renderInto(container, items);
    });
}

/**
 * Renders all `[data-next-discounts]` containers inside `root` with a flat
 * discount list (no offer/voucher filter). Used at line, slot, and toggle
 * level where the API does not split discounts by type.
 */
export function renderFlatDiscountContainers(
  root: HTMLElement,
  discounts: DiscountItem[],
): void {
  root
    .querySelectorAll<HTMLElement>('[data-next-discounts]')
    .forEach(container => {
      renderInto(container, discounts);
    });
}

// ─── Internals ────────────────────────────────────────────────────────────────

function renderInto(container: HTMLElement, items: DiscountItem[]): void {
  const tpl = container.querySelector(
    ':scope > template',
  ) as HTMLTemplateElement | null;
  if (!tpl) return;

  const templateHTML = tpl.innerHTML.trim();
  clearChildren(container);

  const empty = items.length === 0;
  container.classList.toggle('next-discounts-empty', empty);
  container.classList.toggle('next-discounts-has-items', !empty);

  for (const d of items) {
    const html = renderItem(templateHTML, d);
    const node = htmlToNode(html);
    if (node) container.appendChild(node);
  }
}

function renderItem(template: string, d: DiscountItem): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    switch (key) {
      case 'discount.name':
        return d.name ?? '';
      case 'discount.amount':
        return formatCurrency(d.amount);
      case 'discount.description':
        return d.description ?? '';
      default:
        return '';
    }
  });
}

function htmlToNode(html: string): Element | null {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}

function clearChildren(container: HTMLElement): void {
  for (const node of Array.from(container.childNodes)) {
    if ((node as Element).tagName?.toLowerCase() !== 'template') {
      node.parentNode?.removeChild(node);
    }
  }
}

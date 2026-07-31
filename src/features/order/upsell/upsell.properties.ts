/**
 * Value resolution for UpsellEnhancer — reads what the offer should send to the
 * API out of the DOM and out of neighbouring features (a linked
 * `PackageSelectorEnhancer` / `BundleSelectorEnhancer`).
 *
 * Every function here is read-only: it looks something up and returns it, and
 * never mutates enhancer state. They are called at click time so the values
 * always reflect the current selection.
 */

import type { UpsellBundleItem } from './upsell.types';

/**
 * Resolve the selected package from a linked PackageSelectorEnhancer element
 * (data-next-package-selector-id="<id>"). Called at click time so it always
 * reflects the current selection.
 */
export function resolveExternalSelection(
  packageSelectorId: string | undefined
): number | undefined {
  if (!packageSelectorId) return undefined;
  const el = document.querySelector<HTMLElement>(
    `[data-next-package-selector][data-next-selector-id="${packageSelectorId}"]`
  );
  if (!el) return undefined;
  const fn = (el as unknown as Record<string, unknown>)[
    '_getSelectedPackageId'
  ];
  return typeof fn === 'function' ? (fn() as number | undefined) : undefined;
}

export function resolveExternalBundleItems(
  bundleSelectorId: string | undefined
): UpsellBundleItem[] | null {
  if (!bundleSelectorId) return null;
  const el = document.querySelector<HTMLElement>(
    `[data-next-bundle-selector][data-next-selector-id="${bundleSelectorId}"]`
  );
  if (!el) return null;
  const fn = (el as unknown as Record<string, unknown>)[
    '_getSelectedBundleItems'
  ];
  return typeof fn === 'function' ? (fn() as UpsellBundleItem[] | null) : null;
}

export function resolveExternalBundleVouchers(
  bundleSelectorId: string | undefined
): string[] {
  if (!bundleSelectorId) return [];
  const el = document.querySelector<HTMLElement>(
    `[data-next-bundle-selector][data-next-selector-id="${bundleSelectorId}"]`
  );
  if (!el) return [];
  const fn = (el as unknown as Record<string, unknown>)[
    '_getSelectedBundleVouchers'
  ];
  return typeof fn === 'function' ? (fn() as string[]) : [];
}

export function collectDefaultProperties(): Record<string, string> {
  const result: Record<string, string> = {};
  document
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('[data-next-default-property]')
    .forEach(el => {
      const key = el.getAttribute('data-next-default-property');
      if (key && el.value) result[key] = el.value;
    });
  return result;
}

export function collectContainerProperties(
  element: HTMLElement
): Record<string, string> {
  const result: Record<string, string> = {};
  element
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('[data-next-property]')
    .forEach(el => {
      const key = el.getAttribute('data-next-property');
      if (key && el.value) result[key] = el.value;
    });
  return result;
}

export function resolveProperties(
  element: HTMLElement
): Record<string, string> | undefined {
  const merged = {
    ...collectDefaultProperties(),
    ...collectContainerProperties(element),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

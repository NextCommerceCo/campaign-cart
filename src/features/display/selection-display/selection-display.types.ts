import type { Package, SelectorItem, CartState } from '@/types/global';

/**
 * State a selection-price calculation needs, threaded in explicitly instead
 * of read off the enhancer instance.
 */
export interface SelectionPriceContext {
  selectedItem: SelectorItem | null;
  packageData: Package | undefined;
  cartState: CartState | undefined;
}

/**
 * Result of attempting to (re)load package data for the current selection.
 * `changed` distinguishes "looked it up and it's still unresolved" from
 * "guard failed, leave the previous value alone" — the two guard-fail and
 * not-found cases are not the same and must not be conflated.
 */
export interface LoadPackageDataResult {
  changed: boolean;
  packageData?: Package;
}

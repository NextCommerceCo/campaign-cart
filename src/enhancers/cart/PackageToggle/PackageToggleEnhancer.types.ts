export interface PackageDef {
  packageId: number;
  selected?: boolean;
  [key: string]: unknown;
}

export interface ToggleCard {
  element: HTMLElement;
  packageId: number;
  name: string;
  image: string;
  productId: number | null;
  variantId: number | null;
  variantName: string;
  productName: string;
  sku: string | null;
  isPreSelected: boolean;
  isSelected: boolean;
  quantity: number;
  isSyncMode: boolean;
  syncPackageIds: number[];
  isUpsell: boolean;
  stateContainer: HTMLElement;
  addText: string | null;
  removeText: string | null;
  // Price fields (initialized from campaign data, updated by API)
  price: number;
  unitPrice: number;
  originalPrice: number | null;
  originalUnitPrice: number | null;
  discountAmount: number;
  discountPercentage: number;
  hasDiscount: boolean;
  currency: string;
  isRecurring: boolean;
  recurringPrice: number | null;
  originalRecurringPrice: number | null;
  interval: 'day' | 'month' | null;
  intervalCount: number | null;
  frequency: string;
  /** Per-line discounts from the price calculation. */
  discounts: import('@/shared/utils/discountRenderer').DiscountItem[];
}

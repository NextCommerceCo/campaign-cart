import type { Campaign } from '@/types/global';
import type { Package, VariantAttribute } from '@/types/campaign';

// ---------------------------------------------------------------------------
// Internal cache shape — not exported to consumers
// ---------------------------------------------------------------------------

export interface CachedCampaignData {
  campaign: Campaign;
  timestamp: number;
  /** Ties the cache entry to a specific API key so stale entries are ignored. */
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Core state
// ---------------------------------------------------------------------------

export interface CampaignState {
  data: Campaign | null;
  /** Active currency ISO 4217 code (e.g. `'USD'`). Null until campaign is loaded. */
  currency: string | null;
  packages: Package[];
  isLoading: boolean;
  error: string | null;
  isFromCache?: boolean;
  cacheAge?: number;
}

// ---------------------------------------------------------------------------
// Derived / computed shapes returned by query actions
// ---------------------------------------------------------------------------

export interface VariantGroup {
  productId: number;
  productName: string;
  variants: Array<{
    variantId: number;
    variantName: string;
    packageRefId: number;
    attributes: VariantAttribute[];
    sku?: string | null;
    price: string;
    availability: {
      purchase: string;
      inventory: string;
    };
  }>;
  /** e.g. ['color', 'size'] */
  attributeTypes: string[];
}

// ---------------------------------------------------------------------------
// Slice interfaces
// ---------------------------------------------------------------------------

export interface CampaignItemsSlice {
  processPackagesWithVariants: (packages: Package[]) => Package[];
  getPackage: (id: number) => Package | null;
  getProduct: (id: number) => Package | null;
  setError: (error: string | null) => void;
  reset: () => void;
  clearCache: () => void;
  getCacheInfo: () => {
    cached: boolean;
    expiresIn?: number;
    apiKey?: string;
    currency?: string;
  } | null;
}

export interface CampaignVariantsSlice {
  getVariantsByProductId: (productId: number) => VariantGroup | null;
  getAvailableVariantAttributes: (
    productId: number,
    attributeCode: string
  ) => string[];
  getPackageByVariantSelection: (
    productId: number,
    selectedAttributes: Record<string, string>
  ) => Package | null;
}

export interface CampaignApiSlice {
  loadCampaign: (
    apiKey: string,
    options?: { forceFresh?: boolean }
  ) => Promise<void>;
}

export type CampaignStore = CampaignState &
  CampaignItemsSlice &
  CampaignVariantsSlice &
  CampaignApiSlice;

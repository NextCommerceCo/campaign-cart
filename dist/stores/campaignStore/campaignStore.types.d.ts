import { Campaign } from '../../types/global';
import { Package, VariantAttribute } from '../../types/campaign';
export interface CachedCampaignData {
    campaign: Campaign;
    timestamp: number;
    apiKey: string;
}
export interface CampaignState {
    data: Campaign | null;
    currency: string | null;
    packages: Package[];
    isLoading: boolean;
    error: string | null;
    isFromCache?: boolean;
    cacheAge?: number;
}
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
    attributeTypes: string[];
}
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
    getAvailableVariantAttributes: (productId: number, attributeCode: string) => string[];
    getPackageByVariantSelection: (productId: number, selectedAttributes: Record<string, string>) => Package | null;
}
export interface CampaignApiSlice {
    loadCampaign: (apiKey: string, options?: {
        forceFresh?: boolean;
    }) => Promise<void>;
}
export type CampaignStore = CampaignState & CampaignItemsSlice & CampaignVariantsSlice & CampaignApiSlice;
//# sourceMappingURL=campaignStore.types.d.ts.map
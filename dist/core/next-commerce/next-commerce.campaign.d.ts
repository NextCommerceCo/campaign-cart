import { Campaign } from '../../types/global';
export declare function getCampaignData(): Campaign | null;
export declare function getPackage(id: number): any | null;
export declare function getVariantsByProductId(productId: number): any | null;
export declare function getAvailableVariantAttributes(productId: number, attributeCode: string): string[];
export declare function getPackageByVariantSelection(productId: number, selectedAttributes: Record<string, string>): any | null;
export declare function createVariantKey(attributes: Record<string, string>): string;
//# sourceMappingURL=next-commerce.campaign.d.ts.map
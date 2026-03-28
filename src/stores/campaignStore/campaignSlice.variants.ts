import type { StateCreator } from 'zustand';
import type { Package } from '@/types/campaign';
import type { VariantAttribute } from '@/types/campaign';
import type {
  CampaignVariantsSlice,
  CampaignStore,
  VariantGroup,
} from './campaignStore.types';

export const createCampaignVariantsSlice: StateCreator<
  CampaignStore,
  [],
  [],
  CampaignVariantsSlice
> = (_set, get) => ({
  getVariantsByProductId: (productId: number): VariantGroup | null => {
    const productPackages = get().packages.filter(
      pkg => pkg.product_id === productId
    );

    if (productPackages.length === 0) return null;

    const attributeTypes = new Set<string>();
    productPackages.forEach(pkg => {
      pkg.product_variant_attribute_values?.forEach((attr: VariantAttribute) => {
        attributeTypes.add(attr.code);
      });
    });

    const firstPackage = productPackages[0];
    return {
      productId,
      productName: firstPackage.product_name ?? '',
      attributeTypes: Array.from(attributeTypes),
      variants: productPackages.map(pkg => ({
        variantId: pkg.product_variant_id ?? 0,
        variantName: pkg.product_variant_name ?? '',
        packageRefId: pkg.ref_id,
        attributes: pkg.product_variant_attribute_values ?? [],
        sku: pkg.product_sku,
        price: pkg.price,
        availability: {
          purchase: pkg.product_purchase_availability ?? 'available',
          inventory: pkg.product_inventory_availability ?? 'untracked',
        },
      })),
    };
  },

  getAvailableVariantAttributes: (
    productId: number,
    attributeCode: string
  ): string[] => {
    const variantGroup = get().getVariantsByProductId(productId);
    if (!variantGroup) return [];

    const values = new Set<string>();
    variantGroup.variants.forEach(variant => {
      const attr = variant.attributes.find(a => a.code === attributeCode);
      if (attr) values.add(attr.value);
    });

    return Array.from(values).sort();
  },

  getPackageByVariantSelection: (
    productId: number,
    selectedAttributes: Record<string, string>
  ): Package | null => {
    return (
      get().packages.find(pkg => {
        if (pkg.product_id !== productId) return false;

        for (const [code, value] of Object.entries(selectedAttributes)) {
          const hasMatch = pkg.product_variant_attribute_values?.some(
            (attr: VariantAttribute) =>
              attr.code === code && attr.value === value
          );
          if (!hasMatch) return false;
        }

        return true;
      }) ?? null
    );
  },

});

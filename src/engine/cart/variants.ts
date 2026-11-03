import type { Package } from '../types';

export interface VariantOption {
  value: string;
  packageId?: number;
}

export interface VariantChoice {
  code: string;
  name: string;
  value?: string;
  options: VariantOption[];
}

export function variantChoices(packages: Package[], packageId: number): VariantChoice[] {
  const current = packages.find((p) => p.ref_id === packageId);
  const own = current?.product_variant_attribute_values ?? [];
  if (!current?.product_id || !own.length) return [];
  const family = packages.filter((p) => p.product_id === current.product_id);
  const attributes = family.flatMap((p) => p.product_variant_attribute_values ?? []);
  const selected = Object.fromEntries(own.map((a) => [a.code, a.value]));
  const matching = (wanted: Record<string, string>) =>
    family.find(
      (p) =>
        p.product_purchase_availability !== 'unavailable' &&
        Object.entries(wanted).every(([code, value]) =>
          p.product_variant_attribute_values?.some((a) => a.code === code && a.value === value),
        ),
    );
  return [...new Map(attributes.map((a) => [a.code, a.name]))].map(([code, name]) => ({
    code,
    name,
    value: selected[code],
    options: [...new Set(attributes.filter((a) => a.code === code).map((a) => a.value))].map((value) => ({
      value,
      packageId: matching({ ...selected, [code]: value })?.ref_id,
    })),
  }));
}

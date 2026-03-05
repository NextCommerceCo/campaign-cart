/**
 * Variant Helper Utilities
 * Provides helper functions for working with product variants
 */

import type { Package, VariantAttribute } from '@/types/campaign';

export interface VariantOptionInfo {
  value: string;
  packageId: number;
  package: Package;
  isAvailable: boolean;
  sku?: string | null;
}

export interface VariantAttributeInfo {
  code: string;
  name: string;
  values: string[];
  options: VariantOptionInfo[];
}

/**
 * Extract all unique variant attributes from a set of packages
 */
export function extractVariantAttributes(packages: Package[]): VariantAttributeInfo[] {
  const attributeMap = new Map<string, VariantAttributeInfo>();

  packages.forEach(pkg => {
    const attributes = pkg.product?.variant?.attributes;
    if (!attributes) return;

    attributes.forEach(attr => {
      let attrInfo = attributeMap.get(attr.code);

      if (!attrInfo) {
        attrInfo = {
          code: attr.code,
          name: attr.name,
          values: [],
          options: []
        };
        attributeMap.set(attr.code, attrInfo);
      }

      // Add unique value
      if (!attrInfo.values.includes(attr.value)) {
        attrInfo.values.push(attr.value);

        attrInfo.options.push({
          value: attr.value,
          packageId: pkg.ref_id,
          package: pkg,
          isAvailable: isPackageAvailable(pkg),
          sku: pkg.product?.variant?.sku
        });
      }
    });
  });

  return Array.from(attributeMap.values());
}

/**
 * Get packages that share the same product but have different variant values
 */
export function getRelatedVariants(
  packages: Package[],
  basePackage: Package
): Package[] {
  const baseProductId = basePackage.product_id;
  if (!baseProductId) return [basePackage];

  return packages.filter(pkg => pkg.product_id === baseProductId);
}

/**
 * Find a package by variant attribute values
 * @example findPackageByVariant(packages, { size: 'Large', color: 'Red' })
 */
export function findPackageByVariant(
  packages: Package[],
  variantValues: Record<string, string>
): Package | undefined {
  return packages.find(pkg => {
    const attributes = pkg.product?.variant?.attributes;
    if (!attributes) return false;

    // Check if all specified variant values match
    return Object.entries(variantValues).every(([code, value]) => {
      const attr = attributes.find(a => a.code === code);
      return attr?.value === value;
    });
  });
}

/**
 * Get all possible values for a specific variant attribute
 */
export function getVariantValues(
  packages: Package[],
  attributeCode: string
): string[] {
  const values = new Set<string>();

  packages.forEach(pkg => {
    const attr = pkg.product?.variant?.attributes?.find(
      a => a.code === attributeCode
    );
    if (attr) {
      values.add(attr.value);
    }
  });

  return Array.from(values);
}

/**
 * Get variant attribute from a package
 */
export function getVariantAttribute(
  pkg: Package,
  attributeCode: string
): VariantAttribute | undefined {
  return pkg.product?.variant?.attributes?.find(
    attr => attr.code === attributeCode
  );
}

/**
 * Check if package is available for purchase
 */
export function isPackageAvailable(pkg: Package): boolean {
  const inventoryAvailable = pkg.product?.inventory_availability !== 'out_of_stock';
  const purchaseAvailable = pkg.product?.purchase_availability === 'available';
  return inventoryAvailable && purchaseAvailable;
}

/**
 * Build a variant matrix for multi-attribute selection
 * Useful for size/color combinations
 */
export interface VariantMatrixEntry {
  combination: Record<string, string>;
  package: Package;
  isAvailable: boolean;
}

export function buildVariantMatrix(
  packages: Package[],
  attributeCodes: string[]
): VariantMatrixEntry[] {
  return packages.map(pkg => {
    const combination: Record<string, string> = {};
    const attributes = pkg.product?.variant?.attributes || [];

    attributeCodes.forEach(code => {
      const attr = attributes.find(a => a.code === code);
      if (attr) {
        combination[code] = attr.value;
      }
    });

    return {
      combination,
      package: pkg,
      isAvailable: isPackageAvailable(pkg)
    };
  }).filter(entry => Object.keys(entry.combination).length === attributeCodes.length);
}

/**
 * Find the package that matches the current variant selection
 * accounting for multiple attributes
 */
export function resolveVariantPackage(
  packages: Package[],
  selectedVariants: Record<string, string>
): Package | undefined {
  return packages.find(pkg => {
    const attributes = pkg.product?.variant?.attributes || [];

    return Object.entries(selectedVariants).every(([code, value]) => {
      const attr = attributes.find(a => a.code === code);
      return attr?.value === value;
    });
  });
}

/**
 * Get display name for variant option (useful for UI)
 */
export function formatVariantOption(
  attributeCode: string,
  value: string,
  pkg?: Package
): string {
  if (pkg?.product?.variant?.name) {
    return pkg.product.variant.name;
  }
  return value;
}

/**
 * Check if two packages are variants of the same product
 */
export function areSameProduct(pkg1: Package, pkg2: Package): boolean {
  if (pkg1.product_id && pkg2.product_id) {
    return pkg1.product_id === pkg2.product_id;
  }
  // Fallback to product name comparison
  return pkg1.product_name === pkg2.product_name;
}

/**
 * Get all variant combinations for a product
 */
export function getVariantCombinations(packages: Package[]): Map<string, Package> {
  const combinations = new Map<string, Package>();

  packages.forEach(pkg => {
    const attributes = pkg.product?.variant?.attributes;
    if (!attributes) return;

    // Create a key from sorted attribute values
    const key = attributes
      .map(attr => `${attr.code}:${attr.value}`)
      .sort()
      .join('|');

    combinations.set(key, pkg);
  });

  return combinations;
}

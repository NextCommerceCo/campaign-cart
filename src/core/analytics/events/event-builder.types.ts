// Define minimal types to avoid external dependencies
export interface MinimalCartItem {
  id?: string | number;
  packageId?: string | number;
  package_id?: string | number;
  title?: string;
  name?: string;
  product_title?: string;
  price?:
    | number
    | string
    | {
        excl_tax: { value: number; formatted: string };
        incl_tax: { value: number; formatted: string };
        original: { value: number; formatted: string };
        savings: { value: number; formatted: string };
        value?: number;
      };
  price_incl_tax?: number | string;
  price_retail?: number | string;
  quantity?: number;
  qty?: number;
  package_profile?: string;
  variant?: string;
  product?: {
    title?: string;
    image?: string;
    sku?: string;
  };
  image?: string;
  imageUrl?: string;
  image_url?: string;
  // Cart store fields
  productId?: string | number;
  productName?: string;
  variantId?: string | number;
  variantName?: string;
  variantSku?: string;
  sku?: string;
  [key: string]: any; // Allow additional properties
}

export interface Campaign {
    currency: string;
    language: string;
    name: string;
    packages: Package[];
    payment_env_key: string;
    shipping_methods: ShippingOption[];
    offers?: Offer[];
    available_currencies?: Array<{
        code: string;
        label: string;
    }>;
    available_shipping_countries?: Array<{
        code: string;
        label: string;
    }>;
    available_express_payment_methods?: Array<{
        code: string;
        label: string;
    }>;
    available_payment_methods?: Array<{
        code: string;
        label: string;
    }>;
}
export interface VariantAttribute {
    code: string;
    name: string;
    value: string;
}
export interface ProductVariant {
    id: number;
    name: string;
    attributes: VariantAttribute[];
    sku?: string | null;
}
export interface Product {
    id: number;
    name: string;
    variant: ProductVariant;
    purchase_availability: 'available' | 'unavailable' | string;
    inventory_availability: 'untracked' | 'tracked' | 'out_of_stock' | string;
}
export interface Package {
    ref_id: number;
    external_id: number;
    name: string;
    price: string;
    price_total: string;
    price_retail?: string;
    price_retail_total?: string;
    price_recurring?: string;
    price_recurring_total?: string;
    qty: number;
    image: string;
    is_recurring: boolean;
    interval?: 'day' | 'month' | null;
    interval_count?: number | null;
    product?: Product;
    product_variant_id?: number;
    product_variant_name?: string;
    product_id?: number;
    product_name?: string;
    product_sku?: string | null;
    product_purchase_availability?: string;
    product_inventory_availability?: string;
    product_variant_attribute_values?: VariantAttribute[];
}
export interface ShippingOption {
    ref_id: number;
    code: string;
    price: string;
}
export type BenefitType = 'package_percentage' | 'shipping_percentage' | 'order_percentage';
export type ConditionType = 'any' | 'count';
export type OfferType = 'offer' | 'voucher';
export interface OfferBenefit {
    description: string;
    type: BenefitType;
    value: string;
}
export interface OfferCondition {
    description: string;
    type: ConditionType;
    value: number;
}
export interface OfferPackage {
    package_id: number;
    package_image: string | null;
    package_name: string;
    package_price: string;
    package_price_before_discount: string;
    package_unit_qty: number;
    product_name: string;
    product_variant_name: string;
    unit_price: string;
    unit_price_before_discount: string;
}
export interface OfferShippingMethod {
    code: string;
    price: string;
    price_before_discount: string;
    ref_id: number;
}
export interface Offer {
    benefit: OfferBenefit;
    code?: string;
    condition: OfferCondition;
    name: string;
    packages: OfferPackage[];
    ref_id: number;
    shipping_methods: OfferShippingMethod[];
    type: OfferType;
}
//# sourceMappingURL=campaign.d.ts.map
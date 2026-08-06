export interface ShippingMethodInfo {
    ref_id: number;
    code: string;
    price: string;
}
export interface SelectedShippingMethod {
    id: number;
    name: string;
    price: number;
    code: string;
}
export declare function getShippingMethods(): ShippingMethodInfo[];
export declare function getSelectedShippingMethod(): SelectedShippingMethod | null;
export declare function setShippingMethod(methodId: number): Promise<void>;
//# sourceMappingURL=next-commerce.shipping.d.ts.map
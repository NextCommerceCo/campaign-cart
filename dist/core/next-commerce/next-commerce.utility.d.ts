declare global {
    interface Window {
        __NEXT_SDK_VERSION__?: string;
    }
}
export declare function getVersion(): string;
export declare function formatPrice(amount: number, currency?: string): string;
export declare function validateCheckout(): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=next-commerce.utility.d.ts.map
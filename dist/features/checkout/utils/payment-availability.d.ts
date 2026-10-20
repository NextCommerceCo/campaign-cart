export declare function isApplePayAvailable(): boolean;
export declare function isGooglePayAvailable(): boolean;
export declare function isShopPayAvailable(): boolean;
export declare function isPayPalAvailable(): boolean;
export declare function isLinkAvailable(): boolean;
export declare function getPaymentCapabilities(): {
    applePay: boolean;
    googlePay: boolean;
    shopPay: boolean;
    paypal: boolean;
    link: boolean;
    userAgent: string;
    platform: string;
};
//# sourceMappingURL=payment-availability.d.ts.map
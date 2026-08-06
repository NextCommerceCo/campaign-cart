export declare function purchaseTransactionId(order: any): string | null;
export declare function isAwaitingGatewayPayment(order: any): boolean;
export declare function rememberCheckoutReturnPaths(successUrl: string | undefined, failureUrl: string | undefined): void;
export declare function isPaymentFailureLanding(): boolean;
export declare function rememberCheckoutCoupon(code: string | undefined): void;
export declare function recallCheckoutCoupon(): string | null;
export declare function reportedPurchaseId(event: {
    ecommerce?: {
        transaction_id?: string;
    } | undefined;
}): string | null;
export declare function hasPurchaseBeenReported(transactionId: string): boolean;
export declare function markPurchaseReported(transactionId: string): void;
export declare function resetReportedPurchases(): void;
//# sourceMappingURL=purchase-tracking.d.ts.map
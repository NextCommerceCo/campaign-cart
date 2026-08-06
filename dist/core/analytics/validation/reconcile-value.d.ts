export interface ReconcileResult {
    reconciles: boolean;
    diff: number;
    tolerance: number;
    expected: string;
    diagnosis?: string;
}
export declare function reconcileValue(itemsTotal: number, value: number, tax?: number, shipping?: number): ReconcileResult;
//# sourceMappingURL=reconcile-value.d.ts.map
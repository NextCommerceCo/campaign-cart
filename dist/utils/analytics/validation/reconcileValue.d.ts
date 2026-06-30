export declare const RECONCILE_TOLERANCE_ABS = 0.01;
export declare const RECONCILE_TOLERANCE_REL = 0.005;
export interface ReconcileResult {
    reconciles: boolean;
    diff: number;
    tolerance: number;
    expected: string;
    diagnosis?: string;
}
export declare function reconcileValue(itemsTotal: number, value: number, tax?: number, shipping?: number): ReconcileResult;
//# sourceMappingURL=reconcileValue.d.ts.map
import { Logger } from '../../../core/logger';
export type QuantityAction = 'increase' | 'decrease' | 'set';
export interface QuantityConstraints {
    min: number;
    max: number;
    step: number;
}
export interface HandlerContext {
    packageId: number;
    action: QuantityAction;
    constraints: QuantityConstraints;
    logger: Logger;
    setProcessing: (value: boolean) => void;
    emitQuantityChanged: (oldQty: number, newQty: number) => void;
}
//# sourceMappingURL=quantity-control.types.d.ts.map
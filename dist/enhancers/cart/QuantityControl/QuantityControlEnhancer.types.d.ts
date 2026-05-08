import { Logger } from '../../../utils/logger';
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
//# sourceMappingURL=QuantityControlEnhancer.types.d.ts.map
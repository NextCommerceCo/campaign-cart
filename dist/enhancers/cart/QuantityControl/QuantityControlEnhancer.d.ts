import { BaseCartEnhancer } from '../../base/BaseCartEnhancer';
import { CartState } from '../../../types/global';
import { QuantityConstraints } from './QuantityControlEnhancer.types';
export declare class QuantityControlEnhancer extends BaseCartEnhancer {
    private action;
    private packageId;
    private constraints;
    private readonly boundHandleClick;
    private readonly boundHandleChange;
    private readonly boundHandleBlur;
    private readonly boundHandleInput;
    initialize(): Promise<void>;
    update(): void;
    private makeHandlerContext;
    private setupEventListeners;
    protected handleCartUpdate(state: CartState): void;
    protected cleanupEventListeners(): void;
    getCurrentQuantity(): number;
    setQuantity(quantity: number): Promise<void>;
    getConstraints(): QuantityConstraints;
}
//# sourceMappingURL=QuantityControlEnhancer.d.ts.map
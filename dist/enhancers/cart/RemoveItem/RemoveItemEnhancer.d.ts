import { BaseCartEnhancer } from '../../base/BaseCartEnhancer';
import { CartState } from '../../../types/global';
export declare class RemoveItemEnhancer extends BaseCartEnhancer {
    private packageId;
    private confirmRemoval;
    private confirmMessage;
    private readonly boundHandleClick;
    initialize(): Promise<void>;
    update(): void;
    protected handleCartUpdate(state: CartState): void;
    protected cleanupEventListeners(): void;
    private makeHandlerContext;
    getCurrentQuantity(): number;
    isInCart(): boolean;
    setConfirmation(enabled: boolean, message?: string): void;
}
//# sourceMappingURL=RemoveItemEnhancer.d.ts.map
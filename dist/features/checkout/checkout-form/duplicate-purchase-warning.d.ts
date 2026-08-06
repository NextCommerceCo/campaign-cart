import { Logger } from '../../../core/logger';
import { UIService } from '../services/ui-service';
export interface DuplicatePurchaseWarningContext {
    logger: Logger;
    ui: UIService | undefined;
    clearAllCheckoutFields: () => void;
}
export declare function handlePurchaseEvent(ctx: DuplicatePurchaseWarningContext): Promise<void>;
//# sourceMappingURL=duplicate-purchase-warning.d.ts.map
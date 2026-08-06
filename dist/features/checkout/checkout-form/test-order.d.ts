import { Logger } from '../../../core/logger';
import { CheckoutValidator } from '../validation/checkout-validator';
import { UIService } from '../services/ui-service';
export interface TestDataFillContext {
    fields: Map<string, HTMLElement>;
    ui: UIService;
    populateFormData: () => void;
}
export interface KonamiTestOrderContext {
    validator: CheckoutValidator;
    logger: Logger;
    populateFormData: () => void;
    createTestOrder: () => Promise<any>;
    handleOrderRedirect: (order: any) => void;
}
export declare function handleTestDataFilled(ctx: TestDataFillContext): void;
export declare function handleKonamiActivation(ctx: KonamiTestOrderContext, event: Event): Promise<void>;
//# sourceMappingURL=test-order.d.ts.map
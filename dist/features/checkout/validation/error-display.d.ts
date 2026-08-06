import { Logger } from '../../../core/logger';
import { CreditCardService } from '../services/credit-card-service';
import { ErrorDisplayManager } from '../utils/error-display-utils';
export interface ErrorDisplayContext {
    errors: Map<string, string>;
    errorManager: ErrorDisplayManager;
    creditCardService?: CreditCardService;
    logger: Logger;
}
export declare function setError(ctx: ErrorDisplayContext, fieldName: string, message: string): void;
export declare function clearError(ctx: ErrorDisplayContext, fieldName: string): void;
export declare function clearAllErrors(ctx: ErrorDisplayContext): void;
export declare function showError(ctx: ErrorDisplayContext, fieldName: string, message: string): void;
export declare function hideErrorOnly(ctx: ErrorDisplayContext, fieldName: string): void;
//# sourceMappingURL=error-display.d.ts.map
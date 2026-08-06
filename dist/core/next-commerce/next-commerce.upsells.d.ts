import { EventBus } from '../events';
import { Logger } from '../logger';
export interface AddUpsellOptions {
    packageId?: number;
    quantity?: number;
    items?: Array<{
        packageId: number;
        quantity?: number;
    }>;
}
export declare function addUpsell(ctx: {
    logger: Logger;
    eventBus: EventBus;
}, options: AddUpsellOptions): Promise<any>;
export declare function canAddUpsells(): boolean;
export declare function getCompletedUpsells(): string[];
export declare function isUpsellAlreadyAdded(packageId: number): boolean;
//# sourceMappingURL=next-commerce.upsells.d.ts.map
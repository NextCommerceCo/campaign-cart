import { Logger } from '../../../core/logger';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
export interface ProspectCartLifecycleContext {
    form: HTMLFormElement;
    logger: Logger;
    listen: (target: HTMLElement, type: string, handler: (event: Event) => void) => void;
}
export declare function initializeProspectCart(ctx: ProspectCartLifecycleContext): Promise<ProspectCartEnhancer | undefined>;
//# sourceMappingURL=prospect-cart-lifecycle.d.ts.map
import { Iti } from 'intl-tel-input';
import { Logger } from '../../../core/logger';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
export interface ContactPersistenceContext {
    prospectCartEnhancer: ProspectCartEnhancer | undefined;
    phoneInputs: Map<string, Iti>;
    logger: Logger;
}
export declare function persistContactField(ctx: ContactPersistenceContext, fieldName: string, value: string): void;
//# sourceMappingURL=contact-persistence.d.ts.map
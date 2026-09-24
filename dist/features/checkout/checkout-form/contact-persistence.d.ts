import { Logger } from '../../../core/logger';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
import { PhoneNumberSource } from '../validation/phone-validation';
export interface ContactPersistenceContext {
    prospectCartEnhancer: ProspectCartEnhancer | undefined;
    phoneInputs: ReadonlyMap<string, PhoneNumberSource>;
    logger: Logger;
}
export declare function persistContactField(ctx: ContactPersistenceContext, fieldName: string, value: string): void;
//# sourceMappingURL=contact-persistence.d.ts.map
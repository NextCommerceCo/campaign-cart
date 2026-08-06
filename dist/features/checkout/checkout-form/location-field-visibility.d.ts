import { EventBus } from '../../../core/events';
import { Logger } from '../../../core/logger';
export interface LocationFieldsContext {
    form: HTMLFormElement;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    logger: Logger;
    eventBus: EventBus;
    listen: (target: Document | Window | HTMLElement, type: string, handler: (event: Event) => void) => void;
}
export interface LocationFieldVisibility {
    initialize(): void;
    showLocationFields(): void;
    showBillingLocationFields(): void;
}
export declare function createLocationFieldVisibility(ctx: LocationFieldsContext): LocationFieldVisibility;
//# sourceMappingURL=location-field-visibility.d.ts.map
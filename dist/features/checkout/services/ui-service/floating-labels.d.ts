import { Logger } from '../../../../core/logger';
import { EventHandlerManager } from '../../utils/event-handler-utils';
export interface FloatingLabelContext {
    form: HTMLFormElement;
    labels: Map<HTMLElement, HTMLLabelElement>;
    events: EventHandlerManager;
    periodicCheck: {
        value: number | undefined;
    };
    logger: Logger;
}
export declare function initializeFloatingLabels(ctx: FloatingLabelContext): void;
export declare function handleSpreedlyFieldFocus(ctx: FloatingLabelContext, fieldName: 'number' | 'cvv'): void;
export declare function handleSpreedlyFieldBlur(ctx: FloatingLabelContext, fieldName: 'number' | 'cvv', hasValue: boolean): void;
export declare function handleSpreedlyFieldInput(ctx: FloatingLabelContext, fieldName: 'number' | 'cvv', hasValue: boolean): void;
export declare function setupFloatingLabel(ctx: FloatingLabelContext, field: HTMLInputElement | HTMLSelectElement, label?: HTMLLabelElement): void;
export declare function updateLabelsForPopulatedData(ctx: FloatingLabelContext): void;
export declare function handleResponsiveUI(ctx: FloatingLabelContext): void;
//# sourceMappingURL=floating-labels.d.ts.map
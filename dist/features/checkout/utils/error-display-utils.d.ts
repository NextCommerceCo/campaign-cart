export interface ErrorDisplayOptions {
    wrapperClass?: string;
    errorClass?: string;
    errorLabelClass?: string;
    successClass?: string;
    iconErrorClass?: string;
    iconSuccessClass?: string;
}
export declare const ERROR_OWNER_ATTR = "data-next-error-for";
export declare function holdsOneFieldAtMost(container: Element): boolean;
export declare function fieldKey(field: HTMLElement): string | null;
export declare class ErrorDisplayManager {
    private options;
    constructor(options?: ErrorDisplayOptions);
    showFieldError(field: HTMLElement, message: string): void;
    clearFieldError(field: HTMLElement): void;
    private clearUnownedLabelIn;
    showFieldValid(field: HTMLElement): void;
    clearAllErrors(container: HTMLElement): void;
    displayErrors(errors: Record<string, string>, container: HTMLElement): void;
    private findField;
    static showToastError(message: string, duration?: number): void;
    static hideToastError(): void;
}
//# sourceMappingURL=error-display-utils.d.ts.map
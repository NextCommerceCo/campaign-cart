export interface ExpirationFieldsContext {
    fields: Map<string, HTMLElement>;
}
export declare function scanExpirationFields(ctx: ExpirationFieldsContext): void;
export declare function populateYearOptions(yearField: HTMLSelectElement, currentYear: number, currentMonth: number, selectedMonth?: number): void;
export declare function populateExpirationFields(ctx: ExpirationFieldsContext): void;
//# sourceMappingURL=expiration-fields.d.ts.map
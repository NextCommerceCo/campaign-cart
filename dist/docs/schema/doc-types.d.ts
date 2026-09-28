export interface AttributeValue {
    value: string;
    description: string;
}
export interface AttributeDoc {
    name: string;
    group?: string;
    type: string;
    required?: boolean;
    default?: string;
    description?: string;
    values?: AttributeValue[] | string;
    notes?: string;
}
export interface ErrorDoc {
    message: string;
    kind: 'recoverable' | 'fatal';
    cause: string;
    fix: string;
    fromApi?: boolean;
}
export interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    where: string;
    hasContext: boolean;
}
//# sourceMappingURL=doc-types.d.ts.map
import { DlEventEntry, SchemaField, SharedShape } from './extract-analytics-events-types';
export declare function extractDlEvents(eventsFile: string): DlEventEntry[];
export declare function extractEventSchemas(schemasFile: string): {
    schemas: Record<string, SchemaField[]>;
    shared: Record<SharedShape, SchemaField[]>;
};
//# sourceMappingURL=extract-analytics-events-schemas.d.ts.map
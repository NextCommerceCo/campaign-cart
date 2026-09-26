import { MessageSource } from '../../../core/country-service';
export type { MessageSource };
export type MessageKey = 'blank' | 'invalid' | 'invalid_characters' | 'contains_emoji';
export declare function fieldMessage(source: MessageSource | undefined, key: MessageKey, field: string, { country, example }?: {
    country?: string;
    example?: string;
}): string;
export declare function postalMessage(source: MessageSource | undefined, field: string, country: string, config: {
    postcodeExample: string | null;
}): string;
export declare function emojiErrors(source: MessageSource | undefined, values: Readonly<Record<string, unknown>> | undefined, country?: string): Record<string, string>;
//# sourceMappingURL=field-messages.d.ts.map
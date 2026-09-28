import { ErrorDoc } from '../schema/doc-types';
export interface CoreErrorDoc extends ErrorDoc {
    owner: string;
    file: string;
    caught?: string;
    extracted?: string;
}
export declare const CORE_ERRORS: CoreErrorDoc[];
//# sourceMappingURL=core-errors.d.ts.map
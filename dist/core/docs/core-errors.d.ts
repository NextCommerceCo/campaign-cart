import { ErrorDoc } from './feature-manifest';
export interface CoreErrorDoc extends ErrorDoc {
    owner: string;
    file: string;
    caught?: string;
    extracted?: string;
}
export declare const CORE_ERRORS: CoreErrorDoc[];
//# sourceMappingURL=core-errors.d.ts.map
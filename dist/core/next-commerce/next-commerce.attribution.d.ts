import { Logger } from '../logger';
export declare function addMetadata(logger: Logger, key: string, value: any): void;
export declare function setMetadata(logger: Logger, metadata: Record<string, any>): void;
export declare function clearMetadata(logger: Logger): void;
export declare function getMetadata(logger: Logger): Record<string, any> | undefined;
export declare function setAttribution(logger: Logger, attribution: Record<string, any>): void;
export declare function getAttribution(logger: Logger): Record<string, any> | undefined;
export declare function debugAttribution(logger: Logger): void;
//# sourceMappingURL=next-commerce.attribution.d.ts.map
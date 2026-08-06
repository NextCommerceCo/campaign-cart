import { Logger } from '../logger';
export declare function setParam(logger: Logger, key: string, value: string): void;
export declare function setParams(logger: Logger, params: Record<string, string>): void;
export declare function getParam(key: string): string | null;
export declare function getAllParams(): Record<string, string>;
export declare function hasParam(key: string): boolean;
export declare function clearParam(logger: Logger, key: string): void;
export declare function clearAllParams(logger: Logger): void;
export declare function mergeParams(logger: Logger, params: Record<string, string>): void;
//# sourceMappingURL=next-commerce.url-params.d.ts.map
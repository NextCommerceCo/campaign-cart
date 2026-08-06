import { Logger } from '../../../../core/logger';
export interface LoadingStateContext {
    form: HTMLFormElement;
    loadingStates: Map<string, boolean>;
    logger: Logger;
}
export declare function showLoading(ctx: LoadingStateContext, section: string): void;
export declare function hideLoading(ctx: LoadingStateContext, section: string): void;
export declare function updateProgress(ctx: LoadingStateContext, step: number): void;
//# sourceMappingURL=loading-state.d.ts.map
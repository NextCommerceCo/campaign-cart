import { ConfigState } from '../../types/global';
interface ConfigActions {
    loadFromMeta: () => void;
    loadFromWindow: () => void;
    updateConfig: (config: Partial<ConfigState>) => void;
    setSpreedlyEnvironmentKey: (key: string) => void;
    reset: () => void;
    getCurrency: () => string;
}
export declare const configStore: import('zustand').UseBoundStore<import('zustand').StoreApi<ConfigState & ConfigActions>>;
export { configStore as useConfigStore };
//# sourceMappingURL=config.state.d.ts.map
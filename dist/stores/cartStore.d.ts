import { CartStore } from './cartStore.types';
export declare const cartStore: import('zustand').UseBoundStore<Omit<Omit<import('zustand').StoreApi<CartStore>, "persist"> & {
    persist: {
        setOptions: (options: Partial<import('zustand/middleware').PersistOptions<CartStore, CartStore>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: CartStore) => void) => () => void;
        onFinishHydration: (fn: (state: CartStore) => void) => () => void;
        getOptions: () => Partial<import('zustand/middleware').PersistOptions<CartStore, CartStore>>;
    };
}, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: CartStore, previousSelectedState: CartStore) => void): () => void;
        <U>(selector: (state: CartStore) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
}>;
export declare const useCartStore: import('zustand').UseBoundStore<Omit<Omit<import('zustand').StoreApi<CartStore>, "persist"> & {
    persist: {
        setOptions: (options: Partial<import('zustand/middleware').PersistOptions<CartStore, CartStore>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: CartStore) => void) => () => void;
        onFinishHydration: (fn: (state: CartStore) => void) => () => void;
        getOptions: () => Partial<import('zustand/middleware').PersistOptions<CartStore, CartStore>>;
    };
}, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: CartStore, previousSelectedState: CartStore) => void): () => void;
        <U>(selector: (state: CartStore) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
}>;
//# sourceMappingURL=cartStore.d.ts.map
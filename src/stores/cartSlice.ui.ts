import type { StateCreator } from 'zustand';
import type { CartUiSlice, CartStore } from './cartStore.types';

export const createCartUiSlice: StateCreator<
  CartStore,
  [],
  [],
  CartUiSlice
> = set => ({
  swapInProgress: false,
  setSwapInProgress: value => set({ swapInProgress: value }),
});

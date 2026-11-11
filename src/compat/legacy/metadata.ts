import type { Engine } from '../../engine/engine';

type Metadata = Record<string, string | number>;

export interface LegacyMetadataApi {
  /** @deprecated Use `next.actions.setMetadata({ key: value })`. Merges into what the page set before, as in 0.4.x. */
  setMetadata(metadata: Record<string, unknown>): void;
  /** @deprecated Use `next.actions.setMetadata({ [key]: value })`. */
  addMetadata(key: string, value: unknown): void;
  /** @deprecated Use `next.context().attribution`. The metadata an order placed now carries, the SDK's own keys among it. */
  getMetadata(): Metadata;
  /** @deprecated Use `next.actions.setMetadata({ key: undefined })` for each key. Removes what the page set. */
  clearMetadata(): void;
}

/** @deprecated The legacy chunk's 0.4.x `window.next` methods: the attribution metadata a page sets after load. */
export function legacyMetadataApi(engine: Engine): LegacyMetadataApi {
  const set = (metadata: Record<string, unknown>) =>
    engine.visit.setMetadata({ ...engine.getState().visit.metadata, ...(metadata as Metadata) });
  return {
    setMetadata: set,
    addMetadata: (key, value) => set({ [key]: value }),
    getMetadata: () => engine.attribution().metadata,
    clearMetadata: () => engine.visit.setMetadata({}),
  };
}

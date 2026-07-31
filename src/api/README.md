# api/

**Every HTTP call the SDK makes**, and nothing else. No stores, no Zustand, no DOM, no
business rules — this layer knows endpoints and payload shapes, and that is all. A feature
decides *when* to create an order; this decides *what* `POST /api/v1/orders/` looks like.

| File | What it is |
|------|------------|
| `client.types.ts` | `IApiClient` — the fourteen calls, as an interface. **This is what features should depend on.** |
| `client.ts` | `ApiClient` — the one implementation. Owns the base URL, the `Authorization` header, rate-limit handling, error enrichment, and telling an aborted request apart from a failed one |

## Depend on the interface, not the class

If you only need to *call* the API, type it as `IApiClient`:

```ts
import type { IApiClient } from '@/api/client.types';

export class OrderManager {
  constructor(private apiClient: IApiClient) {}
}
```

Two reasons, and the first is the one that bites:

- **A test can hand you a fake the compiler checks.** The alternative is
  `vi.mock('@/api/client', …)`, which swaps the module for a whole test file and is keyed
  on a *path string* — move or rename `client.ts` and the mock silently stops applying
  while the test keeps passing. A fake typed against `IApiClient` fails to compile the
  moment the real surface changes.
- **The implementation can be swapped** — the transport rework in the `sdk-structure`
  skill §6, or a recording client for E2E — without touching a feature.

Import the concrete `ApiClient` only where one is actually **constructed**. Several
enhancers still do (`new ApiClient(useConfigStore.getState().apiKey)`) and hold the result
in an `IApiClient` field: the seam is already in place, so moving construction to a
composition root changes one line each and no types. That move is its own phase — see the
skill's §6.

## Why domain methods and not `get`/`post`

The skill sketches this seam as a transport facade (`http.get()`, `http.post()`). That is
the right shape for the *inside* of `ApiClient` — auth, retries and error conversion
written once, which `request()` already does — but the wrong shape for a feature to
depend on. A feature calling `http.post('/api/v1/orders/', …)` would put endpoint paths
and payload shapes *in the feature*, which is precisely what this folder exists to hold.

So the seam features see is the typed endpoint list, and the transport stays private to
`ApiClient`. Do not "fix" `IApiClient` into `get`/`post`.

## The surface is gated

[`src/tests/contract/api-surface.test.ts`](../tests/contract/api-surface.test.ts) asserts
the class and the interface describe the same methods, **in both directions**.
`implements` only proves the class satisfies the interface; add an endpoint to `ApiClient`
and forget `IApiClient` and nothing else would complain, leaving the new call unreachable
through the seam. Add both, or the gate fails by name.

`getApiKey` / `setApiKey` are on the interface too, so a caller that re-keys an existing
client does not need the concrete class either.

## Known rough edge

The prospect-cart calls and `getAddressesAutocomplete` are typed `Promise<any>` on both
the class and the interface. The interface mirrors the class deliberately, so adopting it
changed no types anywhere. Tightening them is worth doing as its own change, where the
fallout is visible rather than mixed into a refactor — `AddressAutocomplete` in
[`@/types/api`](../types/api.ts) is already the right return type for the last one.

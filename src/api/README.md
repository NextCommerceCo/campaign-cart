# api/

**Every HTTP call the SDK makes**, and nothing else. No stores, no Zustand, no DOM, no
business rules — this layer knows endpoints and payload shapes, and that is all. A feature
decides *when* to create an order; this decides *what* `POST /api/v1/orders/` looks like.

| File | What it is |
|------|------------|
| `client.types.ts` | `IApiClient` — the thirteen calls, as an interface. **This is what features should depend on.** |
| `client.ts` | `ApiClient` — the one implementation. Owns the base URL, the `Authorization` header, rate-limit handling, error enrichment, and telling an aborted request apart from a failed one |

One more file matters and it lives outside this folder:
[`src/client.ts`](../client.ts) — the composition root, which hands out **the** client.

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

## Get the client from the composition root, never with `new`

There is **one** `ApiClient` per page, and [`src/client.ts`](../client.ts) owns it:

```ts
import { getApiClient } from '@/client';

const order = await getApiClient().getOrder('ORD-1234');
```

`getApiClient()` memoizes, and defaults its key from `useConfigStore.getState().apiKey`.
Pass a key — `getApiClient(apiKey)` — only if you were already handed one, as the campaign
and cart state layers are; a key that differs from the current instance's builds a new
instance. It compares against the key read *off the instance* (`getApiKey()`), not a copy
kept beside it, so the memo and the client it hands out cannot disagree — re-key the shared
client behind its back and the next call replaces it instead of handing on credentials
nobody asked for. Before this existed, twelve places each ran
`new ApiClient(useConfigStore.getState().apiKey)`, so a page carried a dozen clients that
differed in nothing.

Sharing one is safe because `ApiClient` holds no per-caller state — a base URL, the key,
and a logger, with every method a one-shot `fetch`. There is no request cache, no
in-flight map, and no abort controller inside it; an `AbortSignal` is passed in per call
by whoever owns it. **If you ever add per-caller state to `ApiClient`, that assumption
breaks and every holder shares it** — put the state in the caller instead.

So import the concrete `ApiClient` only in `src/client.ts`, where the one instance is
built. Everywhere else, type the field `IApiClient` and get the value from
`getApiClient()`.

Two known layering wrinkles, live rather than hidden: `src/state/cart/cart-calculator.ts`
and `src/state/campaign/api.slice.ts` reach up to `@/client`, and `src/core/` does too
(`sdk-initializer.ts`, `next-commerce.ts`) — the `sdk-structure` skill §2 has `state` and
`core` importing nothing above them. Both state files do it behind an existing `await
import('@/client')`, which is what keeps the cycle they were already avoiding broken. The
real fix is the next phase of §6: features and stores receive the client instead of
fetching it.

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

One member is exempt by name: **`setApiKey` is public on the class and deliberately not on
`IApiClient`**. There is one client per page, so re-keying it changes the credentials of
every holder at once, including holders that cached the instance and will never ask again.
Changing the key belongs to `src/client.ts` — call `getApiClient(newKey)`. The gate lists
that one exemption and asserts the method still exists on the class, so it cannot rot into
hiding a missing endpoint; every *endpoint* still has to appear on both sides.

`getApiKey` stays on the interface — reading the key is harmless, and `getApiClient` is
built on it.

## Known rough edge

The prospect-cart calls and `getAddressesAutocomplete` are typed `Promise<any>` on both
the class and the interface. The interface mirrors the class deliberately, so adopting it
changed no types anywhere. Tightening them is worth doing as its own change, where the
fallout is visible rather than mixed into a refactor — `AddressAutocomplete` in
[`@/types/api`](../types/api.ts) is already the right return type for the last one.

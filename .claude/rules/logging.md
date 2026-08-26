# Logging Rules

Applies to every line the SDK prints in a browser.

---

## 1. Everything goes through `Logger`

Obtain one with `createLogger(name)`, or use `this.logger` inside an enhancer. Then
`this.logger.{debug,info,warn,error}`.

`Logger` is the only thing that gates output. In a production bundle `debug`, `info`
and `warn` are dropped unless the page asked for debug mode — `?debug=true`,
`?debugger=true`, or `window.nextConfig.debug` / `.debugger`
(`core/logger.ts › isDebugModeEnabled`). `error` always prints, by design: an error a
shopper hits is one the developer has to be able to see.

A bare `console.log` is gated by nothing. It prints on every shopper's page, on every
visit, with whatever it was handed. `npm run check:console` is the ratchet that keeps
new ones out; CI runs it.

| Level | Prints in production | Use for |
|---|---|---|
| `error` | always | A failure the developer must see |
| `warn` | debug mode only | A recoverable problem |
| `info` | debug mode only | A boot or lifecycle milestone |
| `debug` | debug mode only | Everything else |

## 2. A payload is identifiers and shapes, not submitted values

The browser console is visible to whoever has the page open, and a checkout page's
console is open on a shopper's machine. So a log on a checkout, order, or address
path names **what happened** and **which record it happened to** — not the contents
of what the shopper typed.

| Log | Instead |
|---|---|
| The card data object handed to the tokenizer | `logger.debug('Tokenizing credit card')` |
| A form field's value | The field name, and whether it validated |
| A full address or contact object | The order or session ref, and the field names present |

This is not a rule about debug mode. Debug mode is a URL parameter anyone can add, so
"it only prints in debug mode" does not make a payload safe to print — it makes it
one parameter away.

`console.log('🟢 [CreditCardService] Calling Spreedly.tokenizeCreditCard with:',
cardData)` was both mistakes at once: ungated, and printing the object. The same
method already logged the same fact through `Logger` one screen up.

## 3. When a raw `console.*` is right

Only inside a function whose entire purpose is to print a report to a developer who
invoked it — `useAttributionStore.getState().debug()`, the debug overlay's panels,
the enhancement performance report. Routing those through `Logger` would gate the
output a developer just asked for.

Everything frozen in `scripts/check-console.baseline.json` is that, and each file has
a `notes` entry saying which function and why. If you add one, it needs the same:
`npm run check:console:update`, plus the note. If you cannot name the function a
developer calls, it is not this case.

## 4. Documenting a log

A new or changed log message updates the feature's `guide/reference/logs.md` in the
same change — level, exact string, when it appears, whether it is expected
([guide.md](./guide.md)'s sync table). Core logs are generated: their source is
[`src/docs/content/core-logs.sources.ts`](../../src/docs/content/core-logs.sources.ts),
and `src/tests/docs/coreLogs.test.ts` fails when the page drifts from it.

---

## Checklist

- [ ] Every new line goes through `createLogger` / `this.logger`, at the level §1 names.
- [ ] No payload carries a value the shopper typed.
- [ ] `npm run check:console` passes without a baseline update.
- [ ] A new or changed message is in the feature's `guide/reference/logs.md`.

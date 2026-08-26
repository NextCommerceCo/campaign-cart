# Worked review: the postal-code formatter

The review that produced [`../../../rules/code-quality.md`](../../../rules/code-quality.md).
Read it for the shape of the pass, not for the postcode domain. Issue #92, 2026-08-26.

## What was reported

Address autocomplete filled a UK postcode and the SDK's own validation then
rejected it: `CR2 6XH` came back as `CR26 XH`. The reporter suggested a patch —
apply the format template only when the cleaned code exactly fills the pattern's
placeholder count — and noted that Canada was clean, and that "the other thirteen
countries whose patterns carry a separator all round trip clean".

## Lens 1 — the contract

`formatPostalCode(postalCode, countryConfig)` had no stated contract. Written out,
it is: *given a postcode and a country config, return the postcode in that
country's written form; for anything it cannot place, return the input.*

The existing code had no such Z branch. It had two substitutes, both of which read
as success:

- a trailing `if (charIndex < cleanCode.length) formatted += cleanCode.substring(charIndex)`
- and, in the sibling validator, `return true` when the regex fails to compile.

Naming the contract is what made the rest of the pass mechanical.

## Lens 2 — the measurement

The authority is the countries CDN: every country ships its own `postcodeFormat`,
`postcodeRegex`, `postcodeMinLength`, `postcodeMaxLength`. So the domain was
generated from each country's own regex, run through a port of the formatter, and
checked against that same regex.

All 250 countries, 47 with a `postcodeFormat`:

| | count |
|---|---|
| valid inputs sampled | 26,099 |
| that the formatter turns invalid | **2,034 (7.8%)** |
| countries affected | **6** |
| countries clean | 41 |

Per country, and note that only the first was reported:

| CC | format | sampled | broken |
|---|---|---|---|
| GB | `AANN NAA` | 600 | 451 |
| IM | `IMN NAA` | 600 | 600 |
| JE | `JEN NAA` | 600 | 600 |
| LT | `LT-NNNNN` | 598 | 282 |
| MC | `980NN` | 100 | 100 |
| GI | `GX11 1AA` | 1 | 1 |

The reported claim that thirteen other separator countries round-tripped clean did
not survive the count. Five of them do not, and three of the five fail on 100% of
their input.

## The class, not the instance

Three mechanisms produce all six, and none of them is UK-specific:

1. **Variable-length code, separator anchored from the start.** The walk emits
   literals at fixed offsets from the left, so a shorter code takes the separator at
   a different position than the country's rule puts it. GB (5–7), IM and JE
   (`\d{1,2}`).
2. **No escaping in the pattern language.** A literal that collides with the
   placeholder alphabet `N X A # 9` is consumed as a placeholder: the `9` in Monaco's
   `980NN`, the `X` and the digits in Gibraltar's `GX11 1AA`.
3. **Literal prefix emitted a second time.** The input already carries what the
   pattern also writes: `LT-`, `IM`, `JE`.

Mechanism 2 is the one that rules out a per-country patch. The
patterns arrive from a service this repo does not own, so any country added later
with a literal `A`, `N`, `X`, `9` or `#` breaks the same way, with nothing to
report it.

## The design, chosen by measurement

Both candidates were ported and run over the same 26,099 inputs.

| Design | valid in → invalid out | Notes |
|---|---|---|
| Today | 2,034 | — |
| Reported patch (length equals placeholder count) | 0 | Also disables formatting for GB's 5- and 6-character codes, so `sw1a1aa` formats and `m11ae` does not. Leaves GI unformatted |
| Candidates gated by the country's own regex | **0** | Try today's left-anchored output; if the country's regex rejects it, try the same walk anchored from the right; if that is rejected too, return the input uppercased |

The gate is what makes it safe, and it is safe for a reason worth keeping in mind:
the length check inside `validatePostalCode` rejects partial input on its own, so a
half-typed `M11A` is left alone rather than becoming `M 11A`. Right-anchoring
without the gate would have shipped that, and would also have broken 5-digit US
ZIPs, which the gate catches.

Trying today's output first is what buys zero regressions across the other 41
countries.

## The eleven findings, in three buckets

**In the change** — 🔴 the pattern-alphabet semantics, 🔴 the trailing append,
🔴 no unit test for the module at all, 🔴 the fail-open branch becoming the gate's
load-bearing path, 🟡 the alphabet as an inline five-way `||`, 🟡 the per-call
`new RegExp`.

**Next to it** — 🟠 two comments naming a `"XXX XXX"` Canadian pattern that no
country ships.

**Separate issues** — 🔴 the caret restore's `cursor + lengthDiff` (off by the diff
whenever the length changes after the caret), 🟠 the unused `_countryCode` parameter
in a public signature, 🟠 the hardcoded fallback GB regex disagreeing with the CDN's
on lowercase, 🟡 the validate-and-build-error block copied across three files in
`features/checkout/validation/`.

## What the entry point turned out to be

The report left it open. Autocomplete sets the field value and dispatches `change`;
the form's handler routes it to `formatPostalCodeInPlace`, which calls
`countryService.formatPostalCode`. The same handler is bound to `input`, which is
why partial input is part of the domain.

One thing the trace turned up that is not part of the fix: after the field has been
formatted, the autocomplete writes its own raw value into the store, so the store
and the field can hold different strings. Filed separately rather than folded in.

## What to copy from this

- The count is the argument. "UK looks off" and "2,034 of 26,099 across 6
  countries" lead to different fixes.
- Sampling from the authority's own definition of valid found five countries no
  human had noticed, including three at 100%.
- Naming the mechanism, not the input, is what rules out the per-case branch.
- Two candidate designs, one harness, one table. The reported patch held for every
  case it named; it was scoped narrower than the class.

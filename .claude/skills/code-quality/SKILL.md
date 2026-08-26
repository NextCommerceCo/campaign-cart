---
name: code-quality
description: >-
  How to judge and improve code in the Campaign Cart SDK against the five
  qualities — readable, maintainable, reusable, reliable, efficient. Load when
  reviewing a change (yours or a PR), before calling any change done, when a bug
  reached production past a green test suite, when deciding whether to extract a
  helper or leave a second copy, when a fix could be written as a per-case branch,
  or when a comment and the code it describes disagree. Carries the review order,
  the domain-sampling technique that turns "looks fine" into a count, the fail
  signatures that have actually shipped in this repo, and the scoping convention
  for findings you are not fixing. Pairs with .claude/rules/code-quality.md
  (policy), .claude/rules/typescript.md (style and dead-code gates) and the
  sdk-structure skill (where code lives).
---

# Code Quality

Good code is readable, maintainable, reusable, reliable, and efficient.

> **North star:** the review question is never "does this work on the reported
> input". It is **"what is the contract, and over what domain does it hold"**. Every
> finding in [`references/worked-review.md`](./references/worked-review.md) came
> from asking the second question about code that passed the first.

## 0. The five lenses, in review order

Review in this order because each one narrows what the next has to look at.

| # | Lens | What you do |
|---|---|---|
| 1 | **Contract** (reliable) | Write the contract in one sentence. If you cannot, that is the finding |
| 2 | **Domain** (reliable) | Sample the input space from its authority and count failures (§2) |
| 3 | **Single home** (maintainable) | For each fact the change touches, name its one home |
| 4 | **Copies** (reusable) | Grep the distinctive line; count how many files carry it |
| 5 | **Comments** (readable) | Check each one against the code, then against whether it earns its place (§5) |
| 6 | **Frequency** (efficient) | Find what triggers the function; hoist per-call setup |

Altitude comes first of all, before lens 1: is this solved at the right layer, and
does it match how the codebase already solves this kind of thing? A change can pass
all five lenses and still sit in a file it does not belong in. The `sdk-structure`
skill owns that call.

## 1. Lens 1 — write the contract down

One sentence, in the form *"given X, this returns Y, and for anything else it
returns Z"*. Two things fall out of it immediately:

- **The Z branch is where bugs live.** A function with no stated Z branch usually
  has one anyway, written as "append whatever is left over" or "return true so we
  do not block". Both read as success and neither is.
- **The sentence becomes the test name.** `formats a postcode its country's own
  regex accepts, and returns the input untouched otherwise` is a test name. `works`
  is not.

If the code has a fallback path, say what it means: *declining* to act (return the
input) or *guessing* (return something derived). Declining is safe to leave;
guessing needs the guard from lens 2.

## 2. Lens 2 — count, do not eyeball

The technique that matters most in this repo. When the valid input space is defined
by something outside the repo — a CDN pattern, a backend regex, an API enum — do
not hand-pick examples. Generate from the authority, run the function, count.

```
for each country config from the live CDN:
    samples = generate_from(config.postcodeRegex)     # the authority's own truth
    broken  = [s for s in samples if not matches(config.postcodeRegex, format(s))]
    report(country, len(samples), len(broken))
```

That harness turned "UK looks off" into **2,034 of 26,099 valid inputs across 6
countries**, and turned "the suggested fix works" into **0 of 26,099, with 0
regressions on the other 41**. It also found 5 countries nobody had reported.

Rules for this pass:

- **Sample from the authority, not from your model of it.** The `postcodeExample`
  field found 5 broken countries; sampling the regex found the same 5 plus the
  scale of each.
- **Test the round trip both ways.** Valid input must stay valid; and input with
  its separators stripped must come back valid, because repairing that is what the
  function is for.
- **Include the partial inputs.** Anything on an `input` handler receives every
  prefix of the final value. `M11A` is an input to the postcode formatter, and a
  candidate fix that returns `M 11A` for it is not a fix.
- **Keep the negative control.** A pass where every assertion is "something good
  came out" cannot fail. Include inputs the function must leave alone.
- Throwaway harnesses go in the scratchpad; the table they produce goes into the
  Vitest test as frozen fixture data. Tests never reach the network
  ([e2e.md](../../rules/e2e.md) §4 is the same rule for specs).

## 3. Fail signatures seen in this repo

Each row has actually shipped here. Recognising the shape is faster than
re-deriving the finding.

| Signature | Why it is a defect | Repo example |
|---|---|---|
| Comment assigns distinct meanings to values the code treats identically | The next reader trusts the comment; the divergence is invisible | `country-service.postal-code.ts` — `N`/`X`/`#`/`9`/`A` documented as different, all five accept any character |
| Comment names data that does not exist | Same, one step worse: it is checkable and nobody checked | The same file's `"XXX XXX" for Canadian postal codes`; the CDN sends `ANA NAN` |
| "Append what is left over" tail on a formatter | Emits a value longer than the target's own max length and reads as success | `formatPostalCode`'s trailing branch produced a 12-character value for an 8-character country |
| Fail-open (`return true`) that a later caller leans on | Fine where it was written, load-bearing once something gates on it | `validatePostalCode`'s invalid-regex branch |
| Index math assuming where the edit happened | `caret + lengthDiff` is only right when the length changed before the caret | `postal-code-format.ts` caret restore |
| A mini-language with no escaping | Any literal that collides with the placeholder alphabet is misparsed, silently, for data you do not control | `postcodeFormat` patterns `980NN` and `GX11 1AA` |
| Hardcoded fallback of remote data | Two answers to one question; which one you get depends on network timing | `getDefaultCountryConfig` vs the CDN's GB regex (one accepts lowercase, one does not) |
| Unused positional parameter in a public signature | Every call site must invent a value; removing it later is a breaking change | `validatePostalCode(value, _countryCode, config)` |
| Byte-identical block differing by one word | The next edit lands in 2 of 3 places | The postcode validate + error-message block in `form-validation.ts`, `step-validation.ts`, `billing-address-validation.ts` |
| A test that mocks the unit under test | Suite stays green while the real function is broken | `tests/postal-code-format.test.ts` mocks `formatPostalCode` |
| Per-call `new RegExp` on an event handler | Recompiles on every keystroke | `validatePostalCode` |

## 4. Extract, or leave the copy?

Extract when **both** hold: the block is the same behaviour (not a coincidence of
shape), and the extraction can live in a layer both callers already import. This
repo has the precedent written down — `postal-code-format.ts`'s own header says it
became a module because the shipping and billing branches ran byte-identical
copies, with the differing `<select>` turned into a parameter. That is the pattern:
**the difference becomes an argument.**

Leave the copy when the extraction would need to know which caller it is serving.
A helper with an `isBilling` flag that changes three behaviours is two functions
wearing one name. Prefer passing the differing *value*, never the caller's
identity.

Check [typescript.md](../../rules/typescript.md) before deleting the old export —
`declaration: true` and the generated-docs extractors both keep symbols alive that
look dead.

## 5. Lens 5 — comments earn their place

Two questions per comment, in order. **Is it true** — checkable against the code
and the data it names; the first two rows of §3 are both failures of this half.
**Does it earn its place** — the default is no comment, and one is justified only
by the non-obvious *why*: a deliberate choice that would otherwise invite a
"simplification" that breaks something, or a trap the next reader would walk into.
The policy is [code-quality.md](../../rules/code-quality.md) §2, under *Comments*.

Three shapes to delete on sight in a file the change already opens: a restatement
(`// Remove all spaces and special characters for processing` over the `replace`
that removes them), statement-by-statement narration, and a TSDoc summary that
says the function's own name back (`Format postal code based on country
configuration`). Trim instead of deleting when a long comment carries context the
code cannot express: keep the one sentence, drop the rest.

**Before and after, from the postcode fix.** `country-service.postal-code.ts`
carried a dozen line comments narrating each step, and a restating TSDoc summary on
each of its two exported functions. Out of the code the fix reworked, what came
through is the module header, a one-line note on an internal helper, and three
comments carrying a *why* the code cannot state itself:

- **the placeholder set** — all five slots accept any character and the pattern
  language has no escape, which is why every candidate is re-checked against the
  country's own regex;
- **the format example** — `GB AANN NAA + M11AE -> start M11A E, end M1 1AE`, one
  line in place of a paragraph;
- **the public contract** — what `formatPostalCode` returns when it cannot place
  the input, and why the pattern is tried from both ends.

The file also carried `// Default configurations for common countries` over the
one function the fix did not otherwise touch. It went with the rest: a restatement
in a file you already have open costs one line to delete.

## 6. Scoping what you found

Sort every finding into three buckets, and say which is which in the report:

1. **In this change** — the class the bug belongs to, plus anything that must move
   for the fix to be correct.
2. **Next to it** — a two-line comment or constant in a file the fix already opens.
   Cheap and it keeps the file honest.
3. **Separate issue** — a public-signature change, a different layer, a refactor
   across files the fix does not touch. Name it, do not silently fold it in.

Use the severity prefixes the global review rules use: 🔴 correctness or
reliability, 🟠 behaviour or altitude, 🟡 cleanup or conventions. A finding you
leave behind is reported in the conversation, and goes to the issue tracker if it
has to outlive it — never into a findings file in the repo
([code-quality.md](../../rules/code-quality.md) §5 says why). Describe behaviour
in neutral technical terms — what the code does and what it is scoped to, never
what it risks.

## 7. Closing the loop

A reliability finding closes with a test that has been **seen failing**. Revert the
fix, run it, watch it go red, restore. For anything a shopper sees, that test is a
Playwright spec, because CI does not run Playwright and a bug that got past the
unit suite is the definition of a hole the unit suite cannot close
([e2e.md](../../rules/e2e.md) §1, last row).

Then the docs: a changed behaviour, attribute, event, error, or business rule ships
its doc update in the same change ([documentation.md](../../rules/documentation.md)
§1).

## References

- [`references/worked-review.md`](./references/worked-review.md) — the postcode
  formatter review end to end: the measurement, the eleven findings, the three
  buckets, and the design that beat the reported patch.

# Code Quality Rules

> **Good code is readable, maintainable, reusable, reliable, and efficient.**

Applies to every change in this repo — a feature, a bug fix, a refactor, a test, a
generator. A change that works but fails one of the five is not done.

> How to *run* the five-lens pass — the order, the measurement technique, the fail
> signatures with their repo examples — lives in the **`code-quality` skill**
> (`.claude/skills/code-quality/`). Invoke it when reviewing a change or before
> calling one done. This file is the short, non-negotiable **policy**.

Sibling rules own their own slices and are not repeated here:
[typescript.md](./typescript.md) (aliases, strict mode, dead-code gates),
[testing.md](./testing.md) (what to unit-test),
[e2e.md](./e2e.md) (when a browser test is required),
[documentation.md](./documentation.md) (docs ship with the code). The
`sdk-structure` skill owns where code lives and the durable behavior contracts.

---

## 1. The five, each with the question it answers

| Quality | The question | It fails when |
|---|---|---|
| **Readable** | Can a reader who has never seen this file say what it does, and what it declines to do, in one pass? | A comment states behaviour the code does not implement |
| **Maintainable** | Does the next change land in exactly one place? | One fact has two homes that can drift apart |
| **Reusable** | Does a new call site get the existing helper? | A block is copied with one word changed |
| **Reliable** | Does the stated contract hold across the whole input domain? | Only the example was ever tried |
| **Efficient** | Is the cost proportional to what the code is for? | Per-call work in a per-keystroke path |

## 2. Non-negotiables

**Readable.** Every comment must be checkable against the code or the data it
names. A comment that assigns distinct meanings to values the code treats
identically is a defect, not a style issue: it is what a later reader will trust.
Which comments exist at all is the *Comments* subsection below.

**Maintainable.** If two places define the same fact — a hardcoded fallback and its
remote source, a constant and a doc page, a type and a manifest — a test asserts
they agree, or one of them goes. An unused parameter that every caller must still
fill is a defect: remove it, or record why it stays.

**Reusable.** The **second** copy is where you extract, not the third. Extract into
the layer that both callers already depend on, and never into a shared helper that
needs to know which caller it is serving.

**Reliable.** State the contract in one sentence before you write the code, then
test the domain, not the example:

- The contract goes in the code as the reason a guard exists, and in the test as
  its name.
- When the input space is defined by an external source (a CDN pattern, an API
  schema, a regex the backend owns), **generate inputs from that source's own
  definition and count the failures.** A hand-picked example proves nothing about
  the space around it.
- A function that cannot satisfy its contract for an input returns the input
  unchanged. It does not return a partial result that reads as a success.
- Fail-open (`return true` when a check cannot run) is allowed only where it is
  named and deliberate. It may never become the load-bearing path for a later
  caller.

**Efficient.** Know the call frequency before you decide it does not matter. A
function on an `input` handler, a store subscription, or a template re-render runs
orders of magnitude more often than one on submit. Hoist compiled regexes,
constant sets, and lookups out of the call; do not micro-optimise anything else.

### Comments

**The default is no comment.** A comment earns its place by carrying the
non-obvious *why*: a deliberate choice that would otherwise invite a
"simplification" that breaks something, or a trap the next reader would walk into.
Everything else is reading cost.

- **Never restate the code.** `// Postal code validation` over a block that
  validates a postal code, `// Remove all spaces` over a `replace` that removes
  them, and a TSDoc line that says the function's own name back all add nothing.
  Delete them on sight in code you are already editing.
- **No step-by-step narration.** A comment per statement turns a 10-line function
  into 20 lines to read.
- **Prefer the formula over prose.** When the logic is a calculation or a
  transformation, show it: `GB AANN NAA + M11AE -> start M11A E, end M1 1AE`.
- **A banner needs something to group.** A section banner is justified only when
  it binds several symbols a reader must take as one unit, never when it repeats
  the name of the single symbol below it.
- **Trim, do not drop.** A long pre-existing comment that carries real context
  keeps the one thing the code cannot express. Length alone is not a reason.

A comment that describes behaviour the code does not have is a defect, not a style
issue — see **Readable** above.

## 3. When they conflict

1. **Reliable** wins. Correct-and-duplicated ships; elegant-and-mangling does not.
2. **Readable** is a gate on the other four, not a trade against them. If a
   reliability guard needs a comment to be understood, write the comment.
3. **Maintainable** outranks **reusable**. Sharing that creates hidden coupling
   between two callers is worse than two honest copies with a test each.
4. **Efficient** is last, except on a hot path, where it moves up to just behind
   reliable.

## 4. Fix the class, not the instance

When a bug is one instance of a class the code allows, the fix addresses the class
and the change says so. Patching the reported input and leaving the mechanism that
produced it is a band-aid, and the next instance is already in the tree. If the
class is too large for one change, fix the class you can, and say in your report
which is which.

Never solve a class of input by adding a branch per case. A per-case branch for
data that arrives from outside the repo (per-country, per-currency, per-gateway)
means a new branch every time that data changes, and nothing tells you it is
missing.

## 5. Reporting what you did not fix

A review finding you are not fixing in this change is reported, not dropped, and
it is reported **to the person you are working with, in the conversation** — not
written into a file in the repo. A findings document goes stale, gets cited from
code comments, and sends the next reader somewhere that no longer describes the
tree. Use the severity prefixes from the global review rules — 🔴 correctness or
reliability, 🟠 behaviour or altitude, 🟡 cleanup or conventions — and say which
bucket each finding is in: fixed here, fixed next to it because the file was
already open, or left for a separate change with a reason. If a finding needs to
outlive the conversation, it goes in the issue tracker, which is where someone
will look for it.

---

## Checklist (run before calling a change done)

- [ ] The contract is stated in one sentence, and a test asserts it by that name.
- [ ] The input domain was sampled from its authority, not from the example.
- [ ] Every new comment is checkable against the code or data it names.
- [ ] No comment restates or narrates the code; the ones kept carry a *why*.
- [ ] No fact gained a second home without a test that they agree.
- [ ] No block was copied; the second call site got the extraction.
- [ ] The failure path returns the input, not a partial result.
- [ ] Call frequency was checked; per-call setup hoisted out of hot paths.
- [ ] The fix addresses the class; the remainder is named in the report.
- [ ] `npm run type-check`, `lint`, `test`, `check:unused`, and the E2E the change
      owes ([e2e.md](./e2e.md) §1) all pass.

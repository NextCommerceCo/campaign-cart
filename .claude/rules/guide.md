# Guide Writing Rules

> Applies to: `src/enhancers/{category}/{FeatureName}/guide/**.md`

---

## File Structure

```
guide/
├── overview.md
├── get-started.md
├── use-cases.md
├── relations.md
├── glossary.md
└── reference/
    ├── events.md
    ├── attributes.md
    ├── object-attributes.md
    ├── logs.md
    └── errors.md
```

---

## File Responsibilities

### `overview.md` — Understand It

**Readers:** New dev joining the team, Tech lead reviewing design

**Purpose:** Build a complete mental model of the feature before touching any code.

Must cover these sections in order:

#### What is it

One paragraph. Plain language, no code, no jargon. Answers: what problem does this solve in our product? A new dev who has never heard of this enhancer should finish this paragraph knowing exactly what it does.

#### Concept

The mental model. How does this enhancer think? Is it reactive, rule-based, event-driven? What is the core mechanism a dev must hold in their head to use it correctly? This is not a list of features — it is an explanation of the underlying idea.

Include a diagram here when the concept involves a sequence, a state machine, or a relationship between systems. A single clear diagram is worth more than three paragraphs of prose.

#### Business logic

The domain rules that live inside this enhancer. Conditions, constraints, edge cases, enforcement rules. Be explicit about:
- What triggers it
- What it enforces or prevents
- What the edge cases are
- What assumptions it makes about data or state

#### Decisions

3 to 5 bullet points explaining why it was designed this way. Captures the reasoning behind constraints so the same design debates do not happen again. Format: "We chose X over Y because Z."

#### Limitations

What this enhancer does NOT do. Be specific — vague limitations are useless. Prevents a dev from building on top of it incorrectly.

**Template:**
```md
# {FeatureName}

> Category: `{category}`
> Last reviewed: {YYYY-MM-DD}
> Owner: {team or person}

{One paragraph — what problem this solves in the product.}

## Concept

{The mental model. How it thinks, not what it does.}

{Diagram if the concept involves a sequence, state machine, or system relationship.}

## Business logic

{Domain rules, conditions, constraints, edge cases.}

## Decisions

- We chose X over Y because Z
- We chose X over Y because Z

## Limitations

- Does not handle ...
- Does not support ...
```

---

### `get-started.md` — Run It

**Readers:** Dev implementing a feature

**Purpose:** Get from zero to working in under 10 minutes. No theory — that is in `overview.md`. Just the steps.

Must cover:
- Prerequisites — what must be in place before starting
- Setup steps — numbered, each step doing one thing
- Minimal working code block — copy-paste ready, no placeholders
- Verify it is working — what to look for to confirm correct behavior (log output, UI change, event fired). A dev should not have to guess if it worked.
- Next steps — pointers to the most relevant use case or reference file so the dev knows where to go after setup

**Rules:**
- Every code block must be runnable as-is
- No `...` placeholders — use real values or clearly marked `{VARIABLE}` tokens
- Steps must be in the order a dev actually performs them

**Template:**
```md
# Get Started

## Prerequisites

- ...
- ...

## Setup

1. ...
2. ...
3. ...

{Minimal working code example}

## Verify it is working

After setup, you should see:

- {Expected log output, UI state, or event fired}
- {Another signal that confirms it is running correctly}

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure attributes: [reference/attributes.md](./reference/attributes.md)
- See what events it emits: [reference/events.md](./reference/events.md)
```

---

### `use-cases.md` — Recognize It

**Readers:** All four reader types, especially a dev unsure if this is the right tool

**Purpose:** Map real product situations to this enhancer. Helps a dev recognize when to use it and when not to.

Must cover:
- At least 2 real use cases from the product. Each use case answers: situation, effort signal, why this enhancer fits, what to watch out for.
- A "When NOT to use this" section — situations that look like a fit but are not, and what to use instead.

**Rules:**
- Use cases are product scenarios, not code patterns
- Each use case must include an effort signal so a dev and tech lead can plan correctly
- "When NOT to use" must name an alternative where one exists

**Effort signals:** `lightweight` / `moderate` / `requires backend changes` / `complex setup`

**Template:**
```md
# Use Cases

## {Situation title}

> Effort: {lightweight | moderate | requires backend changes | complex setup}

**When:** {Describe the product situation — what is happening, what the user is doing}

**Why this enhancer:** {Why this is the right tool for this situation}

**Watch out for:** {Edge case or gotcha specific to this use case}

---

## {Situation title}

> Effort: ...

...

---

## When NOT to use this

### {Situation that looks like a fit but is not}

**Why not:** {Explanation}

**Use instead:** `{OtherEnhancerName}` — {one line on why it is a better fit}
```

---

### `relations.md` — Connect It

**Readers:** Dev implementing a feature, Dev debugging production

**Purpose:** Explains how this enhancer relates to others in the system. Prevents integration bugs and "why is this behaving differently when X is also active" debugging sessions.

Must cover:
- Dependencies — enhancers or packages that must be present for this to work
- Conflicts — enhancers that cannot or should not be used alongside this one, and what breaks if they are
- Common combinations — enhancers frequently used together with this one and what the combination achieves

**Rules:**
- Every listed enhancer must have a one-line reason — no bare names
- Conflicts must explain what breaks, not just that a conflict exists

**Template:**
```md
# Relations

## Dependencies

- `{EnhancerName}` — required because ...
- `{package}` — used for ...

## Conflicts

- `{EnhancerName}` — conflicts because ... . If you need both, do ...

## Common combinations

- `{EnhancerName}` + this — achieves ...
- `{EnhancerName}` + this — achieves ...
```

---

### `glossary.md` — Domain Terms

**Readers:** New dev joining the team, any reader hitting an unfamiliar term

**Purpose:** Define the domain and business terms used across this feature's guide. Prevents the same questions from being asked repeatedly and ensures terms mean the same thing to everyone.

Must cover:
- Every domain term or business concept used in this guide that is not obvious to someone new
- Terms should be defined in product/business language, not technical language

**Rules:**
- Alphabetical order
- One definition per term — if a term means something different in another context, note it
- Do not define generic programming terms — only domain-specific and product-specific terms

**Template:**
```md
# Glossary

## {Term}

{Definition in plain business language. What does this mean in the context of this product?}

---

## {Term}

{Definition. If this term means something different elsewhere in the codebase, note it here.}
```

---

### `reference/events.md` — Events

**Readers:** Dev implementing a feature, Dev debugging production

**Purpose:** Complete reference for every event this enhancer emits.

Must cover for each event:
- Event name
- When it fires
- Payload shape with field descriptions in business terms
- Example payload

**Template:**
```md
# Events

## `{event.name}`

**When:** {Exact condition that fires this event}

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `field` | `string` | {Business meaning, not just the type} |
| `field` | `boolean` | {What true and false mean in product terms} |

**Example:**
```json
{
  "field": "value"
}
```

---
```

---

### `reference/attributes.md` — Attributes

**Readers:** Dev implementing a feature

**Purpose:** Complete reference for every configurable attribute.

Must cover for each attribute:
- Name, type, required or optional, default value
- What it does and how changing it affects behavior
- Valid values or constraints if any

**Template:**
```md
# Attributes

## `{attributeName}`

| | |
|---|---|
| Type | `{type}` |
| Required | yes / no |
| Default | `{value}` |

{What it does and how changing it affects behavior.}

**Valid values:** {range, enum, or constraint}

---
```

---

### `reference/object-attributes.md` — Object Attributes

**Readers:** Dev implementing a feature, Dev debugging production

**Purpose:** Complete reference for the data shape this enhancer works with.

Must cover for each object:
- Object name and what it represents in business terms
- Every field: name, type, nullable or not, and the business meaning

**Rules:**
- Field descriptions must use business language, not just restate the type
- Nullable fields must explain what null means in business terms

**Template:**
```md
# Object Attributes

## `{ObjectName}`

{One sentence — what this object represents in the product.}

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string` | no | Unique identifier for ... |
| `status` | `enum` | no | Current state. Values: `active`, `inactive` |
| `resolvedAt` | `datetime` | yes | null means not yet resolved |

---
```

---

### `reference/logs.md` — Logs

**Readers:** Dev debugging production

**Purpose:** Documents every log message this enhancer outputs so a dev can tell healthy output from a problem without guessing.

Must cover:
- The log prefix or namespace this enhancer uses
- Each log message: level, when it appears, what it means, whether it is expected
- What healthy output looks like end-to-end

**Rules:**
- Include the exact log string so a dev can search for it
- Always state whether a log is expected behavior or a signal of a problem
- Group by level: info, warn, debug, error

**Template:**
```md
# Logs

> This enhancer logs under the prefix: `{prefix}`

## Healthy output

When running correctly you should see:

```
{example of normal log sequence}
```

---

## Info

### `{exact log message}`

**When:** {Condition that produces this log}

**Meaning:** {What it tells you — expected behavior or signal of something}

---

## Warn

### `{exact log message}`

**When:** ...

**Meaning:** ...

**Action:** {What a dev should do when they see this, if anything}

---

## Debug

### `{exact log message}`

**When:** ...

**Meaning:** ...
```

---

### `reference/errors.md` — Errors

**Readers:** Dev debugging production, Dev implementing a feature

**Purpose:** Complete reference for every error this enhancer can throw. Structured so a dev can get unblocked fast.

Must cover for each error:
- Exact error message (searchable)
- Whether it is recoverable or fatal
- What caused it
- How to fix it

**Recoverable** — the system will retry or self-correct. Dev can monitor and wait.
**Fatal** — requires a code or config change. Dev must act.

**Rules:**
- Use the exact error string — no paraphrasing
- Recoverable vs fatal must be explicit on every entry
- Fix instructions must be actionable, not vague

**Template:**
```md
# Errors

## `{Exact error message}`

| | |
|---|---|
| Type | Recoverable / Fatal |
| Cause | {What produced this error} |

**Fix:**

{Actionable steps to resolve it}

```ts
// corrected code if applicable
```

---

## `{Exact error message}`

| | |
|---|---|
| Type | Recoverable / Fatal |
| Cause | ... |

**Fix:** ...
```

---

## Sync Rule — Update Guide on Every Change

A feature change without a guide update is **incomplete work**.

When any of the following change, update the guide in the **same PR or commit**:

| What changed | Update these files |
|---|---|
| New attribute added | `reference/attributes.md`, `get-started.md` |
| Attribute renamed or type changed | `reference/attributes.md` |
| New event added | `reference/events.md` |
| Event payload changed | `reference/events.md` |
| Object shape changed | `reference/object-attributes.md` |
| New log message added or changed | `reference/logs.md` |
| New error added or message changed | `reference/errors.md` |
| Business rule added or changed | `overview.md` business logic, `use-cases.md` |
| Behavior changed | `get-started.md`, `use-cases.md` |
| New dependency or conflict | `relations.md` |
| Limitation discovered | `overview.md` limitations |
| New use case identified | `use-cases.md` |
| New domain term introduced | `glossary.md` |

**If unsure which file to update -> update `overview.md` and note it under Limitations at minimum.**

---

## PR Checklist

Before merging any change to an enhancer, confirm:

- [ ] Did I add or change an attribute? -> `reference/attributes.md` updated
- [ ] Did I add or change an event? -> `reference/events.md` updated
- [ ] Did I change the object shape? -> `reference/object-attributes.md` updated
- [ ] Did I add or change a log message? -> `reference/logs.md` updated
- [ ] Did I add or change an error? -> `reference/errors.md` updated
- [ ] Did I change a business rule? -> `overview.md` business logic updated
- [ ] Did I add or remove a dependency or conflict? -> `relations.md` updated
- [ ] Did I introduce a new domain term? -> `glossary.md` updated
- [ ] Is `overview.md` Last reviewed date updated?
- [ ] Does every guide file still accurately describe the current behavior?

---

## Forbidden

- Do not write a single README.md covering everything
- Do not duplicate content across files — cross-link with relative paths instead
- Do not use vague words: "simple", "easy", "just", "straightforward"
- Do not leave `...` placeholders in code examples
- Do not list a conflict or dependency without explaining why
- Do not describe a limitation vaguely — be specific about what is not supported
- Do not document an error without stating whether it is recoverable or fatal
- Do not introduce a domain term in any file without adding it to `glossary.md`
- Do not merge a feature change without updating the guide
- Do not track version history here — that lives in the project CHANGELOG

---

## File Naming

| Rule | Detail |
|------|--------|
| File names | lowercase, no spaces, use hyphens if needed |
| Folder names | lowercase — `guide/` and `reference/` |
| Feature folder | `PascalCase` matching the exported name |
| Category folder | `kebab-case` — default; match existing convention if one already exists |
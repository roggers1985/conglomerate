---
name: code-readability
description: The owner's readability and optionality conventions, with examples. Covers one named condition per if, guard clauses, readable pipelines, handling null/undefined at the boundaries, empty collections instead of null, and when optional chaining is allowed. Use when writing or refactoring conditionals, data pipelines, or code that deals with missing values.
---

# Readability and optionality

**Readability is the top rule.** When another convention makes code harder to read, readability wins.

## One condition per `if`

Each `if` tests one named concept.

**Guards: split them.** Each guard documents one reason, and the body is just a return.

```ts
// Avoid
if (!user || !user.isActive || user.isBanned) {
    return;
}

// Prefer
if (!user) {
    return;
}

if (!user.isActive) {
    return;
}

if (user.isBanned) {
    return;
}
```

**A shared body: name the combined condition.** Splitting would duplicate the body, so the combination moves into a variable (or a function) whose name says what it means.

```ts
// Avoid: two ifs with the same body
if (isExpired) {
    notify();
    archive();
}
if (isRevoked) {
    notify();
    archive();
}

// Prefer
const isNoLongerValid = isExpired || isRevoked;

if (isNoLongerValid) {
    notify();
    archive();
}
```

**Lookups instead of chains of `===`:**

```ts
const KEYWORD_KINDS: Readonly<Record<string, ExportKind>> = { function: "function", class: "class", type: "type", interface: "type" };
```

**Ternaries:** one condition, never nested (Biome: `noNestedTernary`).

## Declarative by default

A chain of steps says *what* happens. A loop with changing variables makes the reader simulate *how*. Prefer the chain, even when it's long, as long as every step is simple.

```ts
// Avoid: the reader has to track `names` and the loop's control flow
const names: string[] = [];
for (const file of files) {
    if (!isSourceFile(file)) {
        continue;
    }
    for (const entry of findExports(read(file))) {
        if (entry.kind !== "type") {
            names.push(entry.name);
        }
    }
}

// Prefer: one step per line, each step a name or a short lambda
const names = files
    .filter(isSourceFile)
    .map(read)
    .flatMap(findExports)
    .filter(isValueExport)
    .map((entry) => entry.name);
```

Keep chains readable:

- **One step per line.** The formatter does this for long chains.
- **Name non-trivial steps.** A lambda longer than a line becomes a named function (`isValueExport`); its name documents the step.
- **Name an intermediate result when it's a concept of its own,** e.g. when it's used twice, or when its name explains the rest of the chain.
- **Prefer purpose-built operations over `reduce`:** `Object.groupBy`, `new Map(entries)`, `Object.fromEntries`, `flatMap`, `some`/`every`, `Math.max(...values)`. A `reduce` with a complex accumulator is usually harder to follow than the loop it replaced.
- **No side effects inside `map` or `filter`.** Use `for … of` (or `forEach` at the end of a chain) for effects.

Imperative code is the better choice where the logic really is stateful:

- a small parser that tracks state across lines (e.g. "inside a code block");
- early exits that depend on accumulated state;
- sequential async work with cancellation checks between steps;
- a hot loop where a measurement showed the chain is too slow.

Not dogma: when a loop reads more clearly, write the loop.

## Optionality at the boundaries

Normalise at the edge, and keep the core complete.

```ts
// Boundary: raw input may lack fields
function toJob(raw: RawJob): Job {
    return {
        id: raw.id,
        title: raw.title.trim(),
        tags: raw.tags ?? [], // missing collection becomes empty here, once
        salary: raw.salary ?? null, // deliberately "no value"
    };
}

// Core: no ?. or ?? needed
function hasTag(job: Job, tag: string): boolean {
    return job.tags.includes(tag);
}
```

## `null`, `undefined` and collections

| Situation | Use |
|---|---|
| A collection with nothing in it | an empty array, set, map or object; **never** `null` or `undefined` |
| An optional field or parameter (not provided) | `undefined`, via `?` in the type, at the boundaries only |
| A result that deliberately has no value | `null`, e.g. `latestReportDate(): string \| null` |
| A function with nothing to return | `void`; never an explicit `return undefined` |

## `?.` and `??`

Use them only on values whose type includes `null` or `undefined`. A `?.` on a value that can't be missing hides a missing boundary, or a type that is wrong.

```ts
job.salary?.amount; // fine: salary is `Salary | null`
job.tags?.length; // wrong: tags is always an array
```

Biome's `noUnnecessaryConditions` could enforce this, but it currently gives false positives (for example on `RegExp.exec`), so it is off. Enforcement is by review until Biome improves (ADR 0019).

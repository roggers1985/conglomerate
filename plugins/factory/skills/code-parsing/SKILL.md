---
name: code-parsing
description: The owner's conventions for parsing external data with schemas (Zod by default, via Standard Schema), and the line between schema parsing, assert and plain types. Use when reading data from outside the code (HTTP, env, files, config, databases, storage, URL params, SDK or LLM output), when writing a schema, or when deciding between parsing and assert.
---

# Parsing external data

**Parse, don't validate.** Data from outside becomes a typed value at the boundary, or it becomes an error result. After that, the code trusts its types.

## Parse, assert, or nothing?

| Where the data comes from | Mechanism | On failure |
|---|---|---|
| Outside our code: a trust boundary | **Schema parsing** | An expected error: a result like `{ kind: "invalid", errors }` with readable messages |
| Our own code, a case that should be impossible | **`assert`** | A bug: crash loudly |
| Between our own modules | **Types only** | Not applicable |

"Outside" includes more than it seems:
- HTTP requests *and* responses from external APIs;
- environment variables, CLI arguments, config and other files;
- database rows (schemas drift), `localStorage`, URL parameters, `postMessage`, message queues;
- **SDK results**: their types are promises, not guarantees;
- **LLM and tool output.**

## Strictness

| Shape | Schema | Why |
|---|---|---|
| Ours: our config, our API's input, our files | `z.strictObject` | An unknown key is almost always a typo |
| Someone else's: external APIs, other tools' formats | `z.object` / `z.looseObject` | They may add fields; that shouldn't break us |

- **No silent coercion.** `z.coerce` only where the source is text by nature (env vars, URL params), and explicitly.
- **Give our own rules readable messages:** `.regex(KEBAB_CASE, "must be kebab-case")`.

## How

~~~ts
import { z } from "zod";
import { parse } from "../lib/parse.ts"; // Standard Schema → { kind: "valid", value } | { kind: "invalid", errors }

const ConfigSchema = z.strictObject({
    port: z.number().int().positive(),
    environment: z.enum(["development", "production"]),
});

/** Types come from the schema; never write them a second time. */
export type Config = Readonly<z.infer<typeof ConfigSchema>>;

export function parseConfig(value: unknown): Parsed<Config> {
    return parse(ConfigSchema, value);
}
~~~

- **One schema per boundary shape, next to the code that reads it.** Export the inferred type.
- **Parse once, at the edge.** Pass the typed value on, and don't re-check it deeper in.
- **Hot paths:** parse once when the data comes in, not on every use. Skipping validation needs a measurement and a comment.
- **Specific types:** turn plain strings into specific types when mixing them up would be a bug, e.g. `z.string().brand<"JobId">()`.
- **Errors:** keep every issue, with its path (`checkups[0].name: must be kebab-case`), so they can all be fixed at once.
- **Tests:**
  - test schemas with valid *and* invalid input;
  - assert on *which fields* fail and on your own messages, not on the library's built-in wording, which changes between versions.
- **Refinements** (`.refine`, `.superRefine`) only run once the base shape is valid. So cross-field checks, like duplicates, report after the field errors are fixed.

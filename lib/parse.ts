import type { StandardSchemaV1 } from "@standard-schema/spec";
import { assert } from "./assert.ts";

/** The outcome of parsing untrusted data: the typed value, or every problem found, as readable messages. */
export type Parsed<T> =
    | { readonly kind: "valid"; readonly value: T }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

/** One segment of an issue path, as Standard Schema reports it. */
type PathSegment = PropertyKey | StandardSchemaV1.PathSegment;

const keyOf = (segment: PathSegment): PropertyKey => (typeof segment === "object" ? segment.key : segment);

/**
 * Formats an issue path the way it would be written in code.
 *
 * @param path - The path of a schema issue; `undefined` or empty for the value itself.
 * @returns E.g. `checkups[0].name`, or an empty string for the root.
 *
 * @example
 * ```ts
 * expect(formatPath(["checkups", 0, "name"])).toBe("checkups[0].name");
 * expect(formatPath([])).toBe("");
 * ```
 */
export function formatPath(path: readonly PathSegment[] | undefined): string {
    const keys = (path ?? []).map(keyOf);

    return keys
        .map((key, index) => {
            if (typeof key === "number") {
                return `[${key}]`;
            }

            return index === 0 ? String(key) : `.${String(key)}`;
        })
        .join("");
}

/**
 * Parses untrusted data with a schema: the one way external data enters typed code (ADR 0020).
 *
 * @remarks
 * Accepts any Standard Schema (Zod, Valibot, ArkType, …), so callers don't depend on one library. Only synchronous
 * schemas are supported: parsing at a boundary should not need I/O.
 *
 * @param schema - The schema that describes the expected shape.
 * @param value - The untrusted data, e.g. parsed JSON.
 * @returns The typed value, or every issue as `path: message`.
 * @throws Error (an `assert` invariant) when the schema validates asynchronously.
 *
 * @example
 * ```ts
 * const { z } = await import("zod");
 * const Port = z.strictObject({ port: z.number().int().positive() });
 *
 * expect(parse(Port, { port: 8080 })).toEqual({ kind: "valid", value: { port: 8080 } });
 * expect(parse(Port, { port: -1 })).toEqual({
 *     kind: "invalid",
 *     errors: ["port: Too small: expected number to be >0"],
 * });
 * ```
 */
export function parse<Schema extends StandardSchemaV1>(
    schema: Schema,
    value: unknown,
): Parsed<StandardSchemaV1.InferOutput<Schema>> {
    const result = schema["~standard"].validate(value);

    assert(!(result instanceof Promise), "parse only supports synchronous schemas");

    if (result.issues !== undefined) {
        return {
            kind: "invalid",
            errors: result.issues.map((issue) => {
                const path = formatPath(issue.path);

                return path.length === 0 ? issue.message : `${path}: ${issue.message}`;
            }),
        };
    }

    return { kind: "valid", value: result.value };
}

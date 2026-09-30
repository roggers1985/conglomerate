import { z } from "zod";
import { assert } from "./assert.ts";

/**
 * A Zod schema for required text: not blank, and at most `maxLength` characters (ADR 0032, 0034).
 *
 * @remarks
 * Blank means empty or only whitespace. The value is checked, not trimmed: parsing never changes the data.
 *
 * @param options.maxLength - The most characters accepted; a whole number, at least 1.
 * @returns A string schema.
 * @throws Error (an `assert` invariant) when `maxLength` is below 1 or not a whole number.
 *
 * @example
 * ```ts
 * const Description = requiredText({ maxLength: 20 });
 *
 * expect(Description.safeParse("A software factory.").success).toBe(true);
 * expect(Description.safeParse("  ").success).toBe(false);
 * expect(Description.safeParse("x".repeat(21)).success).toBe(false);
 * ```
 */
export function requiredText({ maxLength }: { readonly maxLength: number }): z.ZodString {
    assert(Number.isInteger(maxLength), `maxLength must be an integer, got ${maxLength}`);
    assert(maxLength >= 1, `maxLength must be at least 1, got ${maxLength}`);

    return z
        .string()
        .max(maxLength, `must be at most ${maxLength} characters`)
        .refine((text) => text.trim().length > 0, "is required");
}

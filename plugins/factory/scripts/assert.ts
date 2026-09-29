/**
 * Guards an invariant: throws when `condition` is falsy, and narrows the type when it holds.
 *
 * @remarks
 * The owner's negative-space programming convention: state what must be true, and fail loudly when it isn't.
 * Use it for invariants (programmer errors), not for validating user input, which should produce error messages.
 *
 * @param condition - The invariant that must hold.
 * @param message - What was expected; the thrown error reads `Assertion failed: <message>`.
 * @throws Error when `condition` is falsy.
 *
 * @example
 * ```ts
 * const port: number | undefined = 8080;
 *
 * assert(port !== undefined, "port must be configured");
 *
 * expect(port + 1).toBe(8081);
 * ```
 *
 * @example
 * ```ts
 * expect(() => assert(false, "unreachable")).toThrow("Assertion failed: unreachable");
 * ```
 */
export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

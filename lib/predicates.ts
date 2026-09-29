/**
 * Checks whether a value is `null`.
 *
 * @remarks
 * `value === null` narrows just as well inline. This predicate is for passing as a function, e.g. to `.filter()`.
 *
 * @param value - Any value.
 * @returns `true` for `null` only; `undefined` is not `null`.
 *
 * @example
 * ```ts
 * expect(isNull(null)).toBe(true);
 * expect(isNull(undefined)).toBe(false);
 * expect(isNull(0)).toBe(false);
 * ```
 */
export function isNull(value: unknown): value is null {
    return value === null;
}

/**
 * Checks whether a value is `undefined`.
 *
 * @param value - Any value.
 * @returns `true` for `undefined` only; `null` is not `undefined`.
 *
 * @example
 * ```ts
 * expect(isUndefined(undefined)).toBe(true);
 * expect(isUndefined(null)).toBe(false);
 * ```
 */
export function isUndefined(value: unknown): value is undefined {
    return value === undefined;
}

/**
 * Checks whether a value is `null` or `undefined`.
 *
 * @param value - Any value.
 * @returns `true` for `null` and `undefined`; `false` for every other value, including `0`, `""` and `false`.
 *
 * @example
 * ```ts
 * expect(isNil(null)).toBe(true);
 * expect(isNil(undefined)).toBe(true);
 * expect(isNil(0)).toBe(false);
 * expect(isNil("")).toBe(false);
 * ```
 */
export function isNil(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

/**
 * Checks whether a value is neither `null` nor `undefined`, narrowing it to its present type.
 *
 * @remarks
 * The most useful of these predicates: `.filter(isNotNil)` narrows the array's element type, which an inline
 * arrow function (`(value) => value !== null`) does not do for both `null` and `undefined` at once.
 *
 * @param value - A value that may be missing.
 * @returns `true` when the value is present; falsy values like `0`, `""` and `false` count as present.
 *
 * @example
 * ```ts
 * const cursors: (string | null | undefined)[] = ["a", null, "b", undefined];
 * const present: string[] = cursors.filter(isNotNil);
 *
 * expect(present).toEqual(["a", "b"]);
 * ```
 *
 * @example
 * ```ts
 * expect([0, "", false].filter(isNotNil)).toEqual([0, "", false]);
 * ```
 */
export function isNotNil<T>(value: T): value is NonNullable<T> {
    return !isNil(value);
}

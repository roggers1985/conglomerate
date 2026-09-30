import { assert } from "./assert.ts";

/**
 * Maps a list through an async function with at most `concurrency` calls in flight, keeping the input's order.
 *
 * @remarks
 * `Promise.all` over a long list starts every call at once (ADR 0032). The first rejection rejects the result;
 * calls already in flight still finish, but no new ones start.
 *
 * @param items - The items to map.
 * @param mapper - Called once per item; it closes over the caller's signal where it does I/O.
 * @param options.concurrency - The most calls in flight at once; a whole number, at least 1.
 * @param options.signal - Stops starting new calls when it aborts.
 * @returns The results, in the order of `items`.
 * @throws DOMException named `AbortError` when `signal` aborts before every call has started.
 *
 * @example
 * ```ts
 * const double = async (value: number): Promise<number> => value * 2;
 *
 * expect(await mapConcurrent([1, 2, 3], double, { concurrency: 2, signal: AbortSignal.timeout(5_000) })).toEqual([
 *     2, 4, 6,
 * ]);
 * ```
 */
export async function mapConcurrent<T, R>(
    items: readonly T[],
    mapper: (item: T) => Promise<R>,
    { concurrency, signal }: { readonly concurrency: number; readonly signal: AbortSignal },
): Promise<R[]> {
    assert(Number.isInteger(concurrency), `concurrency must be an integer, got ${concurrency}`);
    assert(concurrency >= 1, `concurrency must be at least 1, got ${concurrency}`);

    const results: R[] = [];
    // One iterator shared by every worker: each item is taken exactly once, and each worker's loop is bounded by
    // the list.
    const queue = items.entries();

    const work = async (): Promise<void> => {
        for (const [index, item] of queue) {
            signal.throwIfAborted();
            results[index] = await mapper(item);
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, work));

    return results;
}

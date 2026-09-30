import { describe, expect, it } from "bun:test";
import { mapConcurrent } from "./concurrency.ts";

const signal = AbortSignal.timeout(5_000);

/** A mapper that records how many calls run at once, and yields so that calls can overlap. */
function trackingMapper(): { readonly mapper: (item: number) => Promise<number>; readonly peak: () => number } {
    let running = 0;
    let peak = 0;

    const mapper = async (item: number): Promise<number> => {
        running += 1;
        peak = Math.max(peak, running);
        await Bun.sleep(1);
        running -= 1;

        return item * 10;
    };

    return { mapper, peak: () => peak };
}

describe("mapConcurrent", () => {
    it("keeps the input's order, also when later items finish first", async () => {
        const slowFirst = async (item: number): Promise<number> => {
            await Bun.sleep(item === 1 ? 5 : 0);

            return item;
        };

        expect(await mapConcurrent([1, 2, 3], slowFirst, { concurrency: 3, signal })).toEqual([1, 2, 3]);
    });

    it("returns an empty list for no items, without calling the mapper", async () => {
        const { mapper, peak } = trackingMapper();

        expect(await mapConcurrent([], mapper, { concurrency: 4, signal })).toEqual([]);
        expect(peak()).toBe(0);
    });

    it("never has more than `concurrency` calls in flight", async () => {
        const { mapper, peak } = trackingMapper();
        const items = Array.from({ length: 20 }, (_, index) => index);

        expect(await mapConcurrent(items, mapper, { concurrency: 3, signal })).toEqual(items.map((item) => item * 10));
        expect(peak()).toBe(3);
    });

    it("runs one call at a time at the lower bound of 1", async () => {
        const { mapper, peak } = trackingMapper();

        await mapConcurrent([1, 2, 3], mapper, { concurrency: 1, signal });

        expect(peak()).toBe(1);
    });

    it("starts no more workers than there are items", async () => {
        const { mapper, peak } = trackingMapper();

        await mapConcurrent([1, 2], mapper, { concurrency: 10, signal });

        expect(peak()).toBe(2);
    });

    it("refuses a concurrency below 1 or not a whole number", async () => {
        const { mapper } = trackingMapper();

        await expect(mapConcurrent([1], mapper, { concurrency: 0, signal })).rejects.toThrow(
            "concurrency must be at least 1",
        );
        await expect(mapConcurrent([1], mapper, { concurrency: 1.5, signal })).rejects.toThrow(
            "concurrency must be an integer",
        );
    });

    it("rejects with the mapper's error and starts no new calls", async () => {
        const started: number[] = [];
        const failOnTwo = async (item: number): Promise<number> => {
            started.push(item);

            if (item === 2) {
                throw new Error("two failed");
            }

            return item;
        };

        await expect(mapConcurrent([1, 2, 3, 4], failOnTwo, { concurrency: 1, signal })).rejects.toThrow("two failed");
        expect(started).toEqual([1, 2]);
    });

    it("stops when aborted", async () => {
        const { mapper } = trackingMapper();

        await expect(
            mapConcurrent([1, 2], mapper, { concurrency: 1, signal: AbortSignal.abort() }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

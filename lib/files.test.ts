import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isFileNotFound } from "./errors.ts";
import { readDir, readDirRecursive, readJson, readText, whenMissing } from "./files.ts";

const signal = AbortSignal.timeout(5_000);
let dir = "";

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "files-"));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("readText and readJson", () => {
    it("read a file's text and JSON", async () => {
        await Bun.write(path.join(dir, "a.json"), '{ "a": 1 }');

        expect(await readText(path.join(dir, "a.json"), { maxBytes: 100, signal })).toBe('{ "a": 1 }');
        expect(await readJson(path.join(dir, "a.json"), { maxBytes: 100, signal })).toEqual({ a: 1 });
    });

    it("read a file of exactly maxBytes, and refuse one byte more", async () => {
        await Bun.write(path.join(dir, "five.txt"), "12345");

        expect(await readText(path.join(dir, "five.txt"), { maxBytes: 5, signal })).toBe("12345");
        await expect(readText(path.join(dir, "five.txt"), { maxBytes: 4, signal })).rejects.toThrow(
            `${path.join(dir, "five.txt")} is 5 bytes, over the limit of 4 bytes`,
        );
    });

    it("count bytes, not characters", async () => {
        await Bun.write(path.join(dir, "euro.txt"), "€");

        await expect(readText(path.join(dir, "euro.txt"), { maxBytes: 2, signal })).rejects.toThrow(
            "is 3 bytes, over the limit of 2 bytes",
        );
    });

    it("read an empty file", async () => {
        await Bun.write(path.join(dir, "empty.txt"), "");

        expect(await readText(path.join(dir, "empty.txt"), { maxBytes: 1, signal })).toBe("");
    });

    it("refuse a maxBytes below 1 or not a whole number", async () => {
        await Bun.write(path.join(dir, "a.txt"), "a");

        await expect(readText(path.join(dir, "a.txt"), { maxBytes: 0, signal })).rejects.toThrow(
            "maxBytes must be at least 1",
        );
        await expect(readText(path.join(dir, "a.txt"), { maxBytes: 1.5, signal })).rejects.toThrow(
            "maxBytes must be an integer",
        );
    });

    it("reject with a not-found error for a missing file", async () => {
        const error = await readText(path.join(dir, "missing.txt"), { maxBytes: 1, signal }).catch(
            (caught: unknown) => caught,
        );

        expect(isFileNotFound(error)).toBe(true);
    });

    it("reject a file that is not valid JSON", async () => {
        await Bun.write(path.join(dir, "broken.json"), "{");

        await expect(readJson(path.join(dir, "broken.json"), { maxBytes: 10, signal })).rejects.toBeInstanceOf(
            SyntaxError,
        );
    });

    it("stop when aborted", async () => {
        await Bun.write(path.join(dir, "a.json"), "{}");

        await expect(
            readJson(path.join(dir, "a.json"), { maxBytes: 10, signal: AbortSignal.abort() }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

describe("readDir and readDirRecursive", () => {
    it("list a directory's entries, telling directories from files", async () => {
        await Bun.write(path.join(dir, "a.txt"), "a");
        await Bun.write(path.join(dir, "sub/b.txt"), "b");

        const entries = await readDir(dir, { maxEntries: 10, signal });

        expect(entries.toSorted((x, y) => x.name.localeCompare(y.name))).toEqual([
            { name: "a.txt", isDirectory: false },
            { name: "sub", isDirectory: true },
        ]);
    });

    it("list exactly maxEntries entries, and refuse one more", async () => {
        await Bun.write(path.join(dir, "a.txt"), "a");
        await Bun.write(path.join(dir, "b.txt"), "b");

        expect(await readDir(dir, { maxEntries: 2, signal })).toHaveLength(2);
        await expect(readDir(dir, { maxEntries: 1, signal })).rejects.toThrow(`${dir} has more than 1 entries`);
    });

    it("list an empty directory", async () => {
        expect(await readDir(dir, { maxEntries: 1, signal })).toEqual([]);
    });

    it("refuse a maxEntries below 1 or not a whole number", async () => {
        await expect(readDir(dir, { maxEntries: 0, signal })).rejects.toThrow("maxEntries must be at least 1");
        await expect(readDir(dir, { maxEntries: 2.5, signal })).rejects.toThrow("maxEntries must be an integer");
    });

    it("list every level with paths relative to the directory, counting all of them against the limit", async () => {
        await Bun.write(path.join(dir, "a.txt"), "a");
        await Bun.write(path.join(dir, "sub/deeper/b.txt"), "b");

        const entries = await readDirRecursive(dir, { maxEntries: 4, signal });

        expect(entries.map((entry) => entry.name).toSorted()).toEqual([
            "a.txt",
            "sub",
            path.join("sub", "deeper"),
            path.join("sub", "deeper", "b.txt"),
        ]);
        await expect(readDirRecursive(dir, { maxEntries: 3, signal })).rejects.toThrow("has more than 3 entries");
    });

    it("reject with a not-found error for a missing directory", async () => {
        const error = await readDir(path.join(dir, "missing"), { maxEntries: 1, signal }).catch(
            (caught: unknown) => caught,
        );

        expect(isFileNotFound(error)).toBe(true);
    });

    it("stop when aborted", async () => {
        await expect(readDir(dir, { maxEntries: 1, signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

describe("whenMissing", () => {
    it("turns a missing file or directory into the fallback", async () => {
        expect(await readText(path.join(dir, "missing.txt"), { maxBytes: 1, signal }).catch(whenMissing(null))).toBe(
            null,
        );
        expect(await readDir(path.join(dir, "missing"), { maxEntries: 1, signal }).catch(whenMissing([]))).toEqual([]);
    });

    it("rethrows every other error: a file listed as a directory, an oversized file, an abort", async () => {
        await Bun.write(path.join(dir, "a.txt"), "ab");

        await expect(
            readDir(path.join(dir, "a.txt"), { maxEntries: 1, signal }).catch(whenMissing([])),
        ).rejects.toMatchObject({ code: "ENOTDIR" });
        await expect(
            readText(path.join(dir, "a.txt"), { maxBytes: 1, signal }).catch(whenMissing(null)),
        ).rejects.toThrow("over the limit");
        await expect(
            readText(path.join(dir, "a.txt"), { maxBytes: 2, signal: AbortSignal.abort() }).catch(whenMissing(null)),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

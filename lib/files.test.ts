import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isFileNotFound } from "./errors.ts";
import { readJson, readText } from "./files.ts";

describe("readText and readJson", () => {
    let dir = "";
    const signal = AbortSignal.timeout(5_000);

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("read a file's text and JSON", async () => {
        dir = await mkdtemp(path.join(tmpdir(), "files-"));
        await Bun.write(path.join(dir, "a.json"), '{ "a": 1 }');

        expect(await readText(path.join(dir, "a.json"), { signal })).toBe('{ "a": 1 }');
        expect(await readJson(path.join(dir, "a.json"), { signal })).toEqual({ a: 1 });
    });

    it("reject with a not-found error for a missing file", async () => {
        dir = await mkdtemp(path.join(tmpdir(), "files-"));
        const error = await readText(path.join(dir, "missing.txt"), { signal }).catch((caught: unknown) => caught);

        expect(isFileNotFound(error)).toBe(true);
    });

    it("stop when aborted", async () => {
        dir = await mkdtemp(path.join(tmpdir(), "files-"));
        await Bun.write(path.join(dir, "a.json"), "{}");

        await expect(readJson(path.join(dir, "a.json"), { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

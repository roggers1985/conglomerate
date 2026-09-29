import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { syncFolder } from "./generate.ts";

describe("syncFolder", () => {
    it("writes the expected files, removes orphaned ones with the same extension, and leaves other files alone", async () => {
        const dir = await mkdtemp(path.join(tmpdir(), "sync-"));

        try {
            await Bun.write(path.join(dir, "stale.md"), "old");
            await Bun.write(path.join(dir, "current.md"), "old content");
            await Bun.write(path.join(dir, "notes.txt"), "not managed by this sync");

            await syncFolder(
                dir,
                new Map([
                    ["current.md", "new content"],
                    ["added.md", "brand new"],
                ]),
                { extension: ".md", signal: AbortSignal.timeout(5_000) },
            );

            expect(await Bun.file(path.join(dir, "current.md")).text()).toBe("new content");
            expect(await Bun.file(path.join(dir, "added.md")).text()).toBe("brand new");
            expect(await Bun.file(path.join(dir, "stale.md")).exists()).toBe(false);
            expect(await Bun.file(path.join(dir, "notes.txt")).exists()).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("creates the folder's files even when the folder doesn't exist yet", async () => {
        const parent = await mkdtemp(path.join(tmpdir(), "sync-"));
        const dir = path.join(parent, "missing");

        try {
            await syncFolder(dir, new Map([["a.md", "content"]]), {
                extension: ".md",
                signal: AbortSignal.timeout(5_000),
            });

            expect(await Bun.file(path.join(dir, "a.md")).text()).toBe("content");
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });

    it("stops when aborted", async () => {
        const dir = await mkdtemp(path.join(tmpdir(), "sync-"));

        try {
            await expect(
                syncFolder(dir, new Map([["a.md", "content"]]), { extension: ".md", signal: AbortSignal.abort() }),
            ).rejects.toMatchObject({ name: "AbortError" });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

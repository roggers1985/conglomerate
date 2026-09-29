import { describe, expect, it } from "bun:test";
import path from "node:path";
import { renderBundles } from "./bundles.ts";

const pluginDir = path.resolve(import.meta.dir, "..", "plugins", "factory");

describe("renderBundles", () => {
    it("bundles every entry point into a self-contained file", async () => {
        const bundles = await renderBundles(pluginDir, { signal: AbortSignal.timeout(30_000) });

        expect([...bundles.keys()]).toEqual(["session-start.js", "checkups.js", "doctest.js"]);
        expect(bundles.get("session-start.js")).not.toContain("../../../lib/");
    });

    it("produces the same output on every build, so stale bundles can be detected", async () => {
        const signal = AbortSignal.timeout(30_000);
        const [first, second] = await Promise.all([
            renderBundles(pluginDir, { signal }),
            renderBundles(pluginDir, { signal }),
        ]);

        expect(second).toEqual(first);
    });

    it("stops when aborted", async () => {
        await expect(renderBundles(pluginDir, { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

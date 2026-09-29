import { describe, expect, it } from "bun:test";
import path from "node:path";
import { packageOf, renderBundles } from "./bundles.ts";

const pluginDir = path.resolve(import.meta.dir, "..", "plugins", "factory");

describe("renderBundles", () => {
    it("bundles every entry point into a self-contained file", async () => {
        const { files } = await renderBundles(pluginDir, { signal: AbortSignal.timeout(30_000) });

        expect([...files.keys()]).toEqual(["session-start.js", "checkups.js", "toolbox.js", "doctest.js"]);
        expect(files.get("session-start.js")).not.toContain("../../../lib/");
    });

    it("records which third-party packages each bundle inlines", async () => {
        const { packages } = await renderBundles(pluginDir, { signal: AbortSignal.timeout(30_000) });

        expect([...packages]).toEqual([["zod", ["checkups.js", "session-start.js", "toolbox.js"]]]);
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

describe("packageOf", () => {
    it("finds scoped and unscoped packages, using the innermost node_modules", () => {
        expect(packageOf("node_modules/zod/index.js")).toBe("zod");
        expect(packageOf("node_modules/a/node_modules/@scope/b/lib/x.js")).toBe("@scope/b");
    });

    it("ignores the project's own files", () => {
        expect(packageOf("plugins/factory/scripts/checkups.ts")).toBeNull();
    });
});

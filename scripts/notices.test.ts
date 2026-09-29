import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPackageNotice, renderLegalFiles, renderThirdPartyNotices } from "./notices.ts";

describe("readPackageNotice", () => {
    let nodeModulesDir = "";
    const signal = AbortSignal.timeout(10_000);

    const createPackage = async (name: string, manifest: object, licenseFile: string | null): Promise<void> => {
        nodeModulesDir = await mkdtemp(path.join(tmpdir(), "node-modules-"));
        await Bun.write(path.join(nodeModulesDir, name, "package.json"), JSON.stringify(manifest));

        if (licenseFile !== null) {
            await Bun.write(path.join(nodeModulesDir, name, licenseFile), "MIT License\n\nCopyright (c) Someone\n");
        }
    };

    afterEach(async () => {
        await rm(nodeModulesDir, { recursive: true, force: true });
    });

    it("reads the version, license and license text, whatever the license file is called", async () => {
        await createPackage("@scope/tool", { version: "1.2.3", license: "MIT" }, "LICENCE.md");

        expect(await readPackageNotice("@scope/tool", { nodeModulesDir, bundles: ["a.js"], signal })).toEqual({
            name: "@scope/tool",
            version: "1.2.3",
            license: "MIT",
            licenseText: "MIT License\n\nCopyright (c) Someone",
            bundles: ["a.js"],
        });
    });

    it("refuses a package that declares no license", async () => {
        await createPackage("tool", { version: "1.0.0" }, "LICENSE");

        await expect(readPackageNotice("tool", { nodeModulesDir, bundles: [], signal })).rejects.toThrow(
            "tool/package.json: license: is required",
        );
    });

    it("refuses a package that ships no license file", async () => {
        await createPackage("tool", { version: "1.0.0", license: "MIT" }, null);

        await expect(readPackageNotice("tool", { nodeModulesDir, bundles: [], signal })).rejects.toThrow(
            "tool ships no LICENSE file",
        );
    });

    it("stops when aborted", async () => {
        await createPackage("tool", { version: "1.0.0", license: "MIT" }, "LICENSE");

        await expect(
            readPackageNotice("tool", { nodeModulesDir, bundles: [], signal: AbortSignal.abort() }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

describe("renderThirdPartyNotices", () => {
    it("says so when no third-party code is bundled", () => {
        expect(renderThirdPartyNotices([])).toContain("No third-party code is bundled.");
    });
});

describe("renderLegalFiles", () => {
    it("copies the repository's license and lists this repository's bundled packages", async () => {
        const root = path.resolve(import.meta.dir, "..");
        const files = await renderLegalFiles({
            repositoryRoot: root,
            packages: new Map([["zod", ["checkups.js", "session-start.js"]]]),
            signal: AbortSignal.timeout(10_000),
        });

        expect(files.get("LICENSE")).toBe(await Bun.file(path.join(root, "LICENSE")).text());
        expect(files.get("THIRD-PARTY-NOTICES.md")).toContain(
            "Bundled into `dist/checkups.js`, `dist/session-start.js`.",
        );
    });
});

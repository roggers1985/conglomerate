import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { licenseProblems, readInstalledPackages } from "./dependency-licenses.ts";

describe("readInstalledPackages", () => {
    let root = "";
    const signal = AbortSignal.timeout(10_000);

    const writePackage = (dir: string, manifest: object): Promise<number> =>
        Bun.write(path.join(root, dir, "package.json"), JSON.stringify(manifest));

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it("finds unscoped, scoped and nested packages, once per name and version", async () => {
        root = await mkdtemp(path.join(tmpdir(), "node-modules-"));
        await Promise.all([
            writePackage("a", { name: "a", version: "1.0.0", license: "MIT" }),
            writePackage("@scope/b", { name: "@scope/b", version: "2.0.0", license: "ISC" }),
            writePackage("a/node_modules/c", { name: "c", version: "3.0.0", license: "Apache-2.0" }),
            writePackage("d/node_modules/a", { name: "a", version: "1.0.0", license: "MIT" }),
            writePackage("d", { name: "d", version: "4.0.0", license: "MIT" }),
        ]);

        const packages = await readInstalledPackages(root, { signal });

        expect(packages.map((installed) => `${installed.name}@${installed.version}`)).toEqual([
            "@scope/b@2.0.0",
            "a@1.0.0",
            "c@3.0.0",
            "d@4.0.0",
        ]);
    });

    it("treats a non-string license (old object or array forms) as no license", async () => {
        root = await mkdtemp(path.join(tmpdir(), "node-modules-"));
        await writePackage("old", { name: "old", version: "0.1.0", license: { type: "MIT" } });

        expect(await readInstalledPackages(root, { signal })).toEqual([
            { name: "old", version: "0.1.0", license: null },
        ]);
    });

    it("skips folders without a package.json and dot-folders", async () => {
        root = await mkdtemp(path.join(tmpdir(), "node-modules-"));
        await Promise.all([
            Bun.write(path.join(root, "empty", "README.md"), "x"),
            Bun.write(path.join(root, ".bin", "tool"), "x"),
        ]);

        expect(await readInstalledPackages(root, { signal })).toEqual([]);
    });

    it("stops when aborted", async () => {
        root = await mkdtemp(path.join(tmpdir(), "node-modules-"));
        await writePackage("a", { name: "a", version: "1.0.0", license: "MIT" });

        await expect(readInstalledPackages(root, { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

describe("licenseProblems", () => {
    it("accepts permissive licenses, including an OR with one permissive option", () => {
        expect(
            licenseProblems([
                { name: "a", version: "1", license: "MIT" },
                { name: "b", version: "1", license: "GPL-2.0-only OR MIT" },
            ]),
        ).toEqual([]);
    });

    it("refuses copyleft, source-available and unknown licenses", () => {
        expect(
            licenseProblems([
                { name: "gpl", version: "1", license: "GPL-3.0-only" },
                { name: "mpl", version: "1", license: "MPL-2.0" },
                { name: "sspl", version: "1", license: "SSPL-1.0" },
                { name: "custom", version: "1", license: "SEE LICENSE IN LICENSE.txt" },
            ]).map((problem) => problem.split(" ")[0]),
        ).toEqual(["gpl@1", "mpl@1", "sspl@1", "custom@1"]);
    });

    it("finds no problems in this repository's own dependencies", async () => {
        const root = path.resolve(import.meta.dir, "..", "node_modules");

        expect(licenseProblems(await readInstalledPackages(root, { signal: AbortSignal.timeout(10_000) }))).toEqual([]);
    });
});

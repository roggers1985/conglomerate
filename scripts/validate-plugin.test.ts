import { describe, expect, it } from "bun:test";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Parsed } from "../lib/parse.ts";
import type { Marketplace, PluginManifest } from "./validate-plugin.ts";
import { parseMarketplace, parsePluginManifest, validateRepository } from "./validate-plugin.ts";

const validManifest: PluginManifest = { name: "factory", version: "0.1.0", description: "A software factory." };

const validMarketplace: Marketplace = {
    name: "conglomerate",
    owner: { name: "Someone" },
    plugins: [{ name: "factory", source: "./plugins/factory" }],
};

const errorsOf = <T>(parsed: Parsed<T>): readonly string[] => (parsed.kind === "invalid" ? parsed.errors : []);

const repositoryRoot = path.resolve(import.meta.dir, "..");

/**
 * Validates a temporary copy of this repository with a different `plugin.json`. The rest of the plugin is copied
 * as is, because the validation also rebuilds its generated files; `lib/` and `node_modules/` are linked.
 */
async function validateWithManifest(manifest: unknown): Promise<{ readonly errors: readonly string[] }> {
    const root = await mkdtemp(path.join(tmpdir(), "validate-"));

    try {
        await cp(path.join(repositoryRoot, ".claude-plugin"), path.join(root, ".claude-plugin"), { recursive: true });
        await cp(path.join(repositoryRoot, "plugins/factory"), path.join(root, "plugins/factory"), { recursive: true });
        await cp(path.join(repositoryRoot, "LICENSE"), path.join(root, "LICENSE"));
        await cp(path.join(repositoryRoot, "package.json"), path.join(root, "package.json"));
        await symlink(path.join(repositoryRoot, "lib"), path.join(root, "lib"));
        await symlink(path.join(repositoryRoot, "node_modules"), path.join(root, "node_modules"));
        await Bun.write(path.join(root, "plugins/factory/.claude-plugin/plugin.json"), JSON.stringify(manifest));

        return await validateRepository(root, { signal: AbortSignal.timeout(30_000) });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

describe("parsePluginManifest", () => {
    it("accepts a valid manifest, including fields this repository doesn't check", () => {
        const manifest = { ...validManifest, author: { name: "Someone" } };

        expect(parsePluginManifest(manifest)).toEqual({ kind: "valid", value: manifest });
    });

    it("rejects a name that is not kebab-case", () => {
        expect(errorsOf(parsePluginManifest({ ...validManifest, name: "My Factory" }))).toEqual([
            "name: must be kebab-case",
        ]);
    });

    it("rejects a version that is not semver", () => {
        expect(errorsOf(parsePluginManifest({ ...validManifest, version: "1.0" }))).toEqual([
            "version: must be semver (x.y.z)",
        ]);
    });

    it("rejects a missing description", () => {
        expect(errorsOf(parsePluginManifest({ ...validManifest, description: "" }))).toEqual([
            "description: is required",
        ]);
    });

    it("rejects a manifest that is not an object", () => {
        expect(parsePluginManifest(null).kind).toBe("invalid");
    });
});

describe("parseMarketplace", () => {
    it("accepts a valid marketplace", () => {
        expect(parseMarketplace(validMarketplace)).toEqual({ kind: "valid", value: validMarketplace });
    });

    it("requires an owner name", () => {
        expect(errorsOf(parseMarketplace({ ...validMarketplace, owner: { name: "" } }))).toEqual([
            "owner.name: is required",
        ]);
    });

    it("requires at least one plugin", () => {
        expect(errorsOf(parseMarketplace({ ...validMarketplace, plugins: [] }))).toEqual([
            "plugins: must list at least one plugin",
        ]);
    });

    it("requires plugin sources to be relative paths", () => {
        const marketplace = { ...validMarketplace, plugins: [{ name: "factory", source: "/abs/factory" }] };

        expect(errorsOf(parseMarketplace(marketplace))).toEqual([
            'plugins[0].source: must be a relative path starting with "./"',
        ]);
    });
});

describe("validateRepository", () => {
    it("finds no errors in this repository's manifests", async () => {
        const root = path.resolve(import.meta.dir, "..");

        expect(await validateRepository(root, { signal: AbortSignal.timeout(30_000) })).toEqual({ errors: [] });
    });

    it("stops when aborted", async () => {
        const root = path.resolve(import.meta.dir, "..");

        await expect(validateRepository(root, { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });

    it("reports an invalid marketplace.json without looking at any plugin", async () => {
        const root = await mkdtemp(path.join(tmpdir(), "validate-"));

        try {
            await Bun.write(
                path.join(root, ".claude-plugin/marketplace.json"),
                JSON.stringify({ ...validMarketplace, plugins: [] }),
            );

            expect(await validateRepository(root, { signal: AbortSignal.timeout(5_000) })).toEqual({
                errors: ["marketplace.json: plugins: must list at least one plugin"],
            });
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("finds no errors in an unchanged copy, so the tests below only see their own change", async () => {
        const manifest = await Bun.file(path.join(repositoryRoot, "plugins/factory/.claude-plugin/plugin.json")).json();

        expect(await validateWithManifest(manifest)).toEqual({ errors: [] });
    });

    it("reports an invalid plugin.json, prefixed with the plugin's name", async () => {
        expect(await validateWithManifest({ ...validManifest, version: "1.0" })).toEqual({
            errors: ["factory/plugin.json: version: must be semver (x.y.z)"],
        });
    });

    it("reports a plugin.json whose name differs from its marketplace entry", async () => {
        expect(await validateWithManifest({ ...validManifest, name: "other" })).toEqual({
            errors: ['factory/plugin.json: name does not match marketplace entry "factory"'],
        });
    });
});

describe("validate-plugin CLI", () => {
    it("exits 0 and prints a summary when the repository is valid", async () => {
        const script = path.join(import.meta.dir, "validate-plugin.ts");
        const cli = Bun.spawn(["bun", script], { stdout: "pipe", cwd: path.resolve(import.meta.dir, "..") });
        const [stdout, exitCode] = await Promise.all([new Response(cli.stdout).text(), cli.exited]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain(
            "marketplace, plugin manifests, skills, generated files and dependency licenses are valid",
        );
    });
});

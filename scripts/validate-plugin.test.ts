import { describe, expect, it } from "bun:test";
import path from "node:path";
import type { Marketplace, PluginManifest } from "./validate-plugin.ts";
import { validateMarketplace, validatePluginManifest, validateRepository } from "./validate-plugin.ts";

const validManifest: PluginManifest = { name: "factory", version: "0.1.0", description: "A software factory." };

const validMarketplace: Marketplace = {
    name: "conglomerate",
    owner: { name: "Someone" },
    plugins: [{ name: "factory", source: "./plugins/factory" }],
};

describe("validatePluginManifest", () => {
    it("accepts a valid manifest", () => {
        expect(validatePluginManifest(validManifest)).toEqual([]);
    });

    it("rejects a name that is not kebab-case", () => {
        expect(validatePluginManifest({ ...validManifest, name: "My Factory" })).toEqual(["name must be kebab-case"]);
    });

    it("rejects a version that is not semver", () => {
        expect(validatePluginManifest({ ...validManifest, version: "1.0" })).toEqual([
            "version must be semver (x.y.z)",
        ]);
    });

    it("rejects a missing description", () => {
        expect(validatePluginManifest({ ...validManifest, description: "" })).toEqual(["description is required"]);
    });

    it("throws when the manifest is not an object", () => {
        expect(() => validatePluginManifest(null)).toThrow(/must be an object/);
    });
});

describe("validateMarketplace", () => {
    it("accepts a valid marketplace", () => {
        expect(validateMarketplace(validMarketplace)).toEqual([]);
    });

    it("requires an owner name", () => {
        expect(validateMarketplace({ ...validMarketplace, owner: {} })).toEqual(["owner.name is required"]);
    });

    it("requires at least one plugin", () => {
        expect(validateMarketplace({ ...validMarketplace, plugins: [] })).toEqual([
            "plugins must be a non-empty array",
        ]);
    });

    it("requires plugin entries to be objects", () => {
        expect(validateMarketplace({ ...validMarketplace, plugins: ["factory"] })).toEqual([
            "plugins[0] must be an object",
        ]);
    });

    it("requires plugin sources to be relative paths", () => {
        const marketplace = { ...validMarketplace, plugins: [{ name: "factory", source: "/abs/factory" }] };

        expect(validateMarketplace(marketplace)).toEqual([
            'plugins[0].source must be a relative path starting with "./"',
        ]);
    });
});

describe("validateRepository", () => {
    it("finds no errors in this repository's manifests", async () => {
        const root = path.resolve(import.meta.dir, "..");

        expect(await validateRepository(root)).toEqual([]);
    });
});

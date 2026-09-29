// Validates the marketplace, every plugin's manifest and skills, and the generated files (`bun run validate`).

import path from "node:path";
import { z } from "zod";
import type { Parsed } from "../lib/parse.ts";
import { parse } from "../lib/parse.ts";
import { readRoutes } from "../plugins/factory/scripts/models.ts";
import { renderTaskAgents, TASK_AGENTS_DIR } from "./agents.ts";
import { BUNDLE_DIR, renderBundles } from "./bundles.ts";
import { generatedFileErrors, readGeneratedFiles } from "./generated.ts";
import { CATALOG_FILE, readPluginSkills, renderCatalog } from "./skills.ts";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

// Claude Code's manifest formats have more fields than we check, so unknown keys are allowed (ADR 0020).
const PluginManifestSchema = z.looseObject({
    name: z.string().regex(KEBAB_CASE, "must be kebab-case"),
    version: z.string().regex(SEMVER, "must be semver (x.y.z)"),
    description: z.string().min(1, "is required"),
});

const MarketplaceEntrySchema = z.looseObject({
    name: z.string().regex(KEBAB_CASE, "must be kebab-case"),
    source: z.string().startsWith("./", 'must be a relative path starting with "./"'),
});

const MarketplaceSchema = z.looseObject({
    name: z.string().regex(KEBAB_CASE, "must be kebab-case"),
    owner: z.looseObject({ name: z.string().min(1, "is required") }),
    plugins: z.array(MarketplaceEntrySchema).min(1, "must list at least one plugin"),
});

/** The fields of `.claude-plugin/plugin.json` that this repository requires. */
export type PluginManifest = Readonly<z.infer<typeof PluginManifestSchema>>;

/** One plugin listed in the marketplace. */
export type MarketplaceEntry = Readonly<z.infer<typeof MarketplaceEntrySchema>>;

/** The fields of `.claude-plugin/marketplace.json` that this repository requires. */
export type Marketplace = Readonly<z.infer<typeof MarketplaceSchema>>;

/** The outcome of validating the whole repository; an object so it can gain warnings later (ADR 0017). */
export type RepositoryValidation = {
    readonly errors: readonly string[];
};

/**
 * Parses a plugin manifest.
 *
 * @param value - The parsed `plugin.json`, not yet trusted.
 * @returns The manifest, or every problem found.
 *
 * @example
 * ```ts
 * const manifest = { name: "factory", version: "0.1.0", description: "A factory." };
 *
 * expect(parsePluginManifest(manifest)).toEqual({ kind: "valid", value: manifest });
 * expect(parsePluginManifest({ ...manifest, version: "1.0" })).toEqual({
 *     kind: "invalid",
 *     errors: ["version: must be semver (x.y.z)"],
 * });
 * ```
 */
export function parsePluginManifest(value: unknown): Parsed<PluginManifest> {
    return parse(PluginManifestSchema, value);
}

/**
 * Parses a marketplace manifest, including every plugin entry.
 *
 * @param value - The parsed `marketplace.json`, not yet trusted.
 * @returns The marketplace, or every problem found.
 *
 * @example
 * ```ts
 * const marketplace = { name: "conglomerate", owner: { name: "Owner" }, plugins: [{ name: "factory", source: "./plugins/factory" }] };
 *
 * expect(parseMarketplace(marketplace)).toEqual({ kind: "valid", value: marketplace });
 * expect(parseMarketplace({ ...marketplace, plugins: [] })).toEqual({
 *     kind: "invalid",
 *     errors: ["plugins: must list at least one plugin"],
 * });
 * ```
 */
export function parseMarketplace(value: unknown): Parsed<Marketplace> {
    return parse(MarketplaceSchema, value);
}

function readJson(filePath: string): Promise<unknown> {
    return Bun.file(filePath).json();
}

async function validateManifest(pluginDir: string, entry: MarketplaceEntry): Promise<string[]> {
    const manifest = parsePluginManifest(await readJson(path.join(pluginDir, ".claude-plugin", "plugin.json")));

    if (manifest.kind === "invalid") {
        return manifest.errors.map((error) => `plugin.json: ${error}`);
    }

    if (manifest.value.name !== entry.name) {
        return [`plugin.json: name does not match marketplace entry "${entry.name}"`];
    }

    return [];
}

async function validateGenerated(pluginDir: string): Promise<string[]> {
    const routes = await readRoutes();
    const { skills, errors } = await readPluginSkills(pluginDir, { routes });
    const catalog = Bun.file(path.join(pluginDir, CATALOG_FILE));
    const catalogIsCurrent = (await catalog.exists()) && (await catalog.text()) === renderCatalog(skills, { routes });
    const catalogErrors = catalogIsCurrent ? [] : [`${CATALOG_FILE} is out of date: run \`bun run generate\``];
    const [agents, bundles, currentBundles] = await Promise.all([
        readGeneratedFiles(path.join(pluginDir, TASK_AGENTS_DIR), { extension: ".md" }),
        readGeneratedFiles(path.join(pluginDir, BUNDLE_DIR), { extension: ".js" }),
        renderBundles(pluginDir),
    ]);

    return [
        ...errors,
        ...catalogErrors,
        ...generatedFileErrors(renderTaskAgents(routes), agents, { label: TASK_AGENTS_DIR }),
        ...generatedFileErrors(currentBundles, bundles, { label: BUNDLE_DIR }),
    ];
}

async function validatePlugin(root: string, entry: MarketplaceEntry): Promise<string[]> {
    const pluginDir = path.join(root, entry.source);
    const errors = [...(await validateManifest(pluginDir, entry)), ...(await validateGenerated(pluginDir))];

    return errors.map((error) => `${entry.name}/${error}`);
}

/**
 * Validates the whole repository: the marketplace, every plugin's manifest and skills, and the generated
 * catalog and task agents.
 *
 * @param root - The repository's root folder.
 * @returns Every problem found, prefixed with the file it concerns; `errors` is empty when everything is valid.
 *
 * @example
 * ```ts
 * // The doctest runs from the repository root.
 * expect(await validateRepository(process.cwd())).toEqual({ errors: [] });
 * ```
 */
export async function validateRepository(root: string): Promise<RepositoryValidation> {
    const marketplace = parseMarketplace(await readJson(path.join(root, ".claude-plugin", "marketplace.json")));

    if (marketplace.kind === "invalid") {
        return { errors: marketplace.errors.map((error) => `marketplace.json: ${error}`) };
    }

    const pluginErrors = await Promise.all(marketplace.value.plugins.map((entry) => validatePlugin(root, entry)));

    return { errors: pluginErrors.flat() };
}

async function main(): Promise<void> {
    const root = path.resolve(import.meta.dir, "..");
    const { errors } = await validateRepository(root);

    if (errors.length > 0) {
        console.error(errors.map((error) => `✗ ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    console.log("✓ marketplace, plugin manifests, skills, catalog, task agents and bundles are valid");
}

if (import.meta.main) {
    await main();
}

// Placeholder tooling: validates the marketplace and plugin manifests.
// It exists mainly to show the shape of repo tooling (pure functions + thin CLI + tests).

import path from "node:path";
import { readRoutes } from "../plugins/factory/scripts/models.ts";
import { readTaskAgents, renderTaskAgents, taskAgentErrors } from "./agents.ts";
import { CATALOG_FILE, readPluginSkills, renderCatalog } from "./skills.ts";

export type PluginManifest = {
    readonly name: string;
    readonly version: string;
    readonly description: string;
};

export type MarketplaceEntry = {
    readonly name: string;
    readonly source: string;
};

export type Marketplace = {
    readonly name: string;
    readonly owner: { readonly name: string };
    readonly plugins: readonly MarketplaceEntry[];
};

// The shape of T before validation: every field may be missing and has an unknown value.
type Unvalidated<T> = { readonly [K in keyof T]?: unknown };

type Rule = readonly [passes: boolean, message: string];

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

const isObject = <T>(value: unknown): value is Unvalidated<T> => typeof value === "object" && value !== null;
const isNonEmptyString = (value: unknown): boolean => typeof value === "string" && value.length > 0;
const isKebabCase = (value: unknown): boolean => typeof value === "string" && KEBAB_CASE.test(value);

const failedRules = (rules: readonly Rule[]): string[] =>
    rules.filter(([passes]) => !passes).map(([, message]) => message);

export function validatePluginManifest(manifest: unknown): string[] {
    assert(isObject<PluginManifest>(manifest), "plugin manifest must be an object");

    return failedRules([
        [isKebabCase(manifest.name), "name must be kebab-case"],
        [typeof manifest.version === "string" && SEMVER.test(manifest.version), "version must be semver (x.y.z)"],
        [isNonEmptyString(manifest.description), "description is required"],
    ]);
}

function validateMarketplaceEntry(entry: unknown, index: number): string[] {
    if (!isObject<MarketplaceEntry>(entry)) {
        return [`plugins[${index}] must be an object`];
    }

    return failedRules([
        [isKebabCase(entry.name), `plugins[${index}].name must be kebab-case`],
        [
            typeof entry.source === "string" && entry.source.startsWith("./"),
            `plugins[${index}].source must be a relative path starting with "./"`,
        ],
    ]);
}

export function validateMarketplace(marketplace: unknown): string[] {
    assert(isObject<Marketplace>(marketplace), "marketplace must be an object");

    const { owner, plugins } = marketplace;
    const hasPlugins = Array.isArray(plugins) && plugins.length > 0;
    const topLevelErrors = failedRules([
        [isKebabCase(marketplace.name), "name must be kebab-case"],
        [isObject<Marketplace["owner"]>(owner) && isNonEmptyString(owner.name), "owner.name is required"],
        [hasPlugins, "plugins must be a non-empty array"],
    ]);

    if (!hasPlugins) {
        return topLevelErrors;
    }

    return [...topLevelErrors, ...plugins.flatMap((entry: unknown, index) => validateMarketplaceEntry(entry, index))];
}

const isValidMarketplace = (value: unknown): value is Marketplace => validateMarketplace(value).length === 0;

function readJson(filePath: string): Promise<unknown> {
    return Bun.file(filePath).json();
}

async function validateManifest(pluginDir: string, entry: MarketplaceEntry): Promise<string[]> {
    const manifest = await readJson(path.join(pluginDir, ".claude-plugin", "plugin.json"));
    const errors = validatePluginManifest(manifest);
    const nameMatches = isObject<PluginManifest>(manifest) && manifest.name === entry.name;
    const nameErrors = nameMatches ? [] : [`name does not match marketplace entry "${entry.name}"`];

    return [...errors, ...nameErrors].map((error) => `plugin.json: ${error}`);
}

async function validateSkills(pluginDir: string): Promise<string[]> {
    const routes = await readRoutes();
    const { skills, errors } = await readPluginSkills(pluginDir, routes);
    const catalog = Bun.file(path.join(pluginDir, CATALOG_FILE));
    const catalogIsCurrent = (await catalog.exists()) && (await catalog.text()) === renderCatalog(skills, routes);
    const catalogErrors = catalogIsCurrent ? [] : [`${CATALOG_FILE} is out of date: run \`bun run generate\``];
    const agentErrors = taskAgentErrors(renderTaskAgents(routes), await readTaskAgents(pluginDir));

    return [...errors, ...catalogErrors, ...agentErrors];
}

async function validatePlugin(root: string, entry: MarketplaceEntry): Promise<string[]> {
    const pluginDir = path.join(root, entry.source);
    const errors = [...(await validateManifest(pluginDir, entry)), ...(await validateSkills(pluginDir))];

    return errors.map((error) => `${entry.name}/${error}`);
}

export async function validateRepository(root: string): Promise<string[]> {
    const marketplace = await readJson(path.join(root, ".claude-plugin", "marketplace.json"));

    if (!isValidMarketplace(marketplace)) {
        return validateMarketplace(marketplace).map((error) => `marketplace.json: ${error}`);
    }

    const pluginErrors = await Promise.all(marketplace.plugins.map((entry) => validatePlugin(root, entry)));

    return pluginErrors.flat();
}

async function main(): Promise<void> {
    const root = path.resolve(import.meta.dir, "..");
    const errors = await validateRepository(root);

    if (errors.length > 0) {
        console.error(errors.map((error) => `✗ ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    console.log("✓ marketplace, plugin manifests, skills, catalog and task agents are valid");
}

if (import.meta.main) {
    await main();
}

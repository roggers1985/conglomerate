// Plugin bundles (ADR 0020): the plugin's scripts, bundled with `lib/` and their packages into self-contained files.
// Only the plugin folder is installed, so the scripts Claude Code runs can't import anything outside it.

import path from "node:path";
import { assert } from "../lib/assert.ts";
import { isNotNil } from "../lib/predicates.ts";
import type { GeneratedFiles } from "./generated.ts";

/** Where the bundles go, inside the plugin folder. Hooks and skills run `${CLAUDE_PLUGIN_ROOT}/dist/<name>.js`. */
export const BUNDLE_DIR = "dist";

/** The plugin scripts that Claude Code runs. Each is an entry point with its own `import.meta.main` block. */
const ENTRYPOINTS = ["session-start.ts", "checkups.ts", "toolbox.ts", "doctest.ts", "changes.ts"];

/** The bundles, and which third-party packages each one inlines (for the license notices, ADR 0027). */
export type BundleBuild = {
    readonly files: GeneratedFiles;
    /** Package name → the bundles (file names) that contain its code, sorted by package name. */
    readonly packages: ReadonlyMap<string, readonly string[]>;
};

/**
 * Finds the package a bundled file belongs to.
 *
 * @param inputPath - A path from Bun's build metadata, e.g. `../../node_modules/zod/v4/core/core.js`.
 * @returns The package name (including its scope), or `null` for the project's own files.
 *
 * @example
 * ```ts
 * expect(packageOf("../../node_modules/zod/v4/core/core.js")).toBe("zod");
 * expect(packageOf("node_modules/@standard-schema/spec/dist/index.js")).toBe("@standard-schema/spec");
 * expect(packageOf("lib/parse.ts")).toBeNull();
 * ```
 */
export function packageOf(inputPath: string): string | null {
    const marker = "node_modules/";
    const index = inputPath.lastIndexOf(marker);

    if (index === -1) {
        return null;
    }

    const [scopeOrName = "", name = ""] = inputPath.slice(index + marker.length).split("/");

    return scopeOrName.startsWith("@") ? `${scopeOrName}/${name}` : scopeOrName;
}

type Metafile = { readonly outputs: Readonly<Record<string, { readonly inputs: Readonly<Record<string, unknown>> }>> };

function bundledPackages(metafile: Metafile): ReadonlyMap<string, readonly string[]> {
    const pairs = Object.entries(metafile.outputs).flatMap(([output, { inputs }]) =>
        Object.keys(inputs)
            .map(packageOf)
            .filter(isNotNil)
            .map((name) => ({ name, bundle: path.basename(output) })),
    );
    const byPackage = Map.groupBy(pairs, (pair) => pair.name);

    return new Map(
        [...byPackage.keys()]
            .toSorted()
            .map((name) => [name, [...new Set((byPackage.get(name) ?? []).map((pair) => pair.bundle))].toSorted()]),
    );
}

/**
 * Bundles the plugin's entry-point scripts, and records which packages each bundle inlines.
 *
 * @remarks
 * Minified, because nobody reads the bundles: the readable sources are in `scripts/`. The output is deterministic,
 * which lets `bun run validate` detect stale bundles by rebuilding and comparing.
 *
 * @param pluginDir - The plugin's root folder.
 * @param options.signal - Cancels the build; checked before and after, since `Bun.build` takes no signal.
 * @returns The bundles by file name (`<name>.js`), and the third-party packages they contain.
 * @throws AggregateError with Bun's build logs when bundling fails.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * // The doctest runs from the repository root.
 * const { files, packages } = await renderBundles(`${process.cwd()}/plugins/factory`, {
 *     signal: AbortSignal.timeout(30_000),
 * });
 *
 * expect([...files.keys()]).toEqual(["session-start.js", "checkups.js", "toolbox.js", "doctest.js", "changes.js"]);
 * expect(packages.get("zod")).toEqual(["changes.js", "checkups.js", "session-start.js", "toolbox.js"]);
 * ```
 */
export async function renderBundles(
    pluginDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<BundleBuild> {
    signal.throwIfAborted();

    const result = await Bun.build({
        entrypoints: ENTRYPOINTS.map((entrypoint) => path.join(pluginDir, "scripts", entrypoint)),
        target: "bun",
        minify: true,
        metafile: true,
        // Rejects with an AggregateError of the build logs on failure, instead of resolving with success: false.
        throw: true,
    });

    signal.throwIfAborted();
    assert(result.metafile !== undefined, "Bun.build returns a metafile when asked for one");

    const contents = await Promise.all(result.outputs.map((output) => output.text()));

    return {
        files: new Map(result.outputs.map((output, index) => [path.basename(output.path), contents[index] ?? ""])),
        packages: bundledPackages(result.metafile),
    };
}

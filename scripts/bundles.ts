// Plugin bundles (ADR 0020): the plugin's scripts, bundled with `lib/` and their packages into self-contained files.
// Only the plugin folder is installed, so the scripts Claude Code runs can't import anything outside it.

import path from "node:path";
import type { GeneratedFiles } from "./generated.ts";

/** Where the bundles go, inside the plugin folder. Hooks and skills run `${CLAUDE_PLUGIN_ROOT}/dist/<name>.js`. */
export const BUNDLE_DIR = "dist";

/** The plugin scripts that Claude Code runs. Each is an entry point with its own `import.meta.main` block. */
const ENTRYPOINTS = ["session-start.ts", "checkups.ts", "doctest.ts"];

/**
 * Bundles the plugin's entry-point scripts.
 *
 * @remarks
 * Minified, because nobody reads the bundles: the readable sources are in `scripts/`. The output is deterministic,
 * which lets `bun run validate` detect stale bundles by rebuilding and comparing.
 *
 * @param pluginDir - The plugin's root folder.
 * @param options.signal - Cancels the build; checked before and after, since `Bun.build` takes no signal.
 * @returns File name (`<name>.js`) → bundle, one per entry point.
 * @throws AggregateError with Bun's build logs when bundling fails.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * // The doctest runs from the repository root.
 * const bundles = await renderBundles(`${process.cwd()}/plugins/factory`, { signal: AbortSignal.timeout(30_000) });
 *
 * expect([...bundles.keys()]).toEqual(["session-start.js", "checkups.js", "doctest.js"]);
 * expect(bundles.get("checkups.js")).toStartWith("// @bun\n");
 * ```
 */
export async function renderBundles(
    pluginDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<GeneratedFiles> {
    signal.throwIfAborted();

    const result = await Bun.build({
        entrypoints: ENTRYPOINTS.map((entrypoint) => path.join(pluginDir, "scripts", entrypoint)),
        target: "bun",
        minify: true,
    });

    if (!result.success) {
        throw new AggregateError(result.logs, "bundling the plugin scripts failed");
    }

    signal.throwIfAborted();

    const contents = await Promise.all(result.outputs.map((output) => output.text()));

    return new Map(result.outputs.map((output, index) => [path.basename(output.path), contents[index] ?? ""]));
}

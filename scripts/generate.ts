// Regenerates everything derived from the factory plugin's sources (ADR 0013, 0015, 0020):
//
//   bun scripts/generate.ts   CATALOG.md, agents/tasks/*.md and the dist/*.js bundles

import { rm } from "node:fs/promises";
import path from "node:path";
import { interruptSignal } from "../lib/interrupt.ts";
import { readRoutes } from "../plugins/factory/scripts/models.ts";
import { factorySettingsJsonSchema, SETTINGS_SCHEMA_FILE } from "../plugins/factory/scripts/settings.ts";
import { renderTaskAgents, TASK_AGENTS_DIR } from "./agents.ts";
import { BUNDLE_DIR, renderBundles } from "./bundles.ts";
import type { GeneratedFiles } from "./generated.ts";
import { readGeneratedFiles } from "./generated.ts";
import { renderLegalFiles } from "./notices.ts";
import { CATALOG_FILE, readPluginSkills, renderCatalog } from "./skills.ts";

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "..");
const FACTORY_DIR = path.join(REPOSITORY_ROOT, "plugins", "factory");

/**
 * Writes the expected files into `dir`, and removes files there that are no longer generated.
 *
 * @param dir - The folder to sync.
 * @param expected - The files that should exist, by file name.
 * @param options.extension - Only existing files ending in this extension are considered for removal, e.g. `".md"`.
 * @param options.signal - Cancels the reads and writes.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/sync-`);
 * const signal = AbortSignal.timeout(5_000);
 * await Bun.write(`${dir}/stale.md`, "old");
 * await Bun.write(`${dir}/notes.txt`, "kept: wrong extension");
 *
 * await syncFolder(dir, new Map([["current.md", "new"]]), { extension: ".md", signal });
 *
 * expect(await Bun.file(`${dir}/current.md`).text()).toBe("new");
 * expect(await Bun.file(`${dir}/stale.md`).exists()).toBe(false);
 * expect(await Bun.file(`${dir}/notes.txt`).exists()).toBe(true);
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function syncFolder(
    dir: string,
    expected: GeneratedFiles,
    { extension, signal }: { readonly extension: string; readonly signal: AbortSignal },
): Promise<void> {
    const orphaned = [...(await readGeneratedFiles(dir, { extension, signal })).keys()].filter(
        (fileName) => !expected.has(fileName),
    );

    await Promise.all([
        ...[...expected].map(([fileName, content]) => Bun.write(path.join(dir, fileName), content)),
        ...orphaned.map((fileName) => rm(path.join(dir, fileName))),
    ]);
}

async function main(): Promise<void> {
    const signal = interruptSignal();
    const routes = await readRoutes({ signal });
    const { skills, errors } = await readPluginSkills(FACTORY_DIR, { routes, signal });

    if (errors.length > 0) {
        console.error(errors.map((error) => `✗ ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    const agents = renderTaskAgents(routes);
    const bundles = await renderBundles(FACTORY_DIR, { signal });
    const legalFiles = await renderLegalFiles({ repositoryRoot: REPOSITORY_ROOT, packages: bundles.packages, signal });

    await Promise.all([
        Bun.write(path.join(FACTORY_DIR, CATALOG_FILE), renderCatalog(skills, { routes })),
        syncFolder(path.join(FACTORY_DIR, TASK_AGENTS_DIR), agents, { extension: ".md", signal }),
        syncFolder(path.join(FACTORY_DIR, BUNDLE_DIR), bundles.files, { extension: ".js", signal }),
        ...[...legalFiles].map(([fileName, content]) => Bun.write(path.join(FACTORY_DIR, fileName), content)),
        Bun.write(path.join(FACTORY_DIR, SETTINGS_SCHEMA_FILE), factorySettingsJsonSchema()),
    ]);

    console.log(
        `✓ wrote ${CATALOG_FILE} (${skills.length} skills), ${agents.size} task agents, ${bundles.files.size} bundles, ${legalFiles.size} legal files and ${SETTINGS_SCHEMA_FILE}`,
    );
}

if (import.meta.main) {
    await main();
}

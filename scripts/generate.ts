// Regenerates everything derived from the factory plugin's sources (ADR 0013, 0015, 0020):
//
//   bun scripts/generate.ts   CATALOG.md, agents/tasks/*.md and the dist/*.js bundles

import { rm } from "node:fs/promises";
import path from "node:path";
import { readRoutes } from "../plugins/factory/scripts/models.ts";
import { renderTaskAgents, TASK_AGENTS_DIR } from "./agents.ts";
import { BUNDLE_DIR, renderBundles } from "./bundles.ts";
import type { GeneratedFiles } from "./generated.ts";
import { readGeneratedFiles } from "./generated.ts";
import { CATALOG_FILE, readPluginSkills, renderCatalog } from "./skills.ts";

const FACTORY_DIR = path.resolve(import.meta.dir, "..", "plugins", "factory");

/** Writes the expected files into `dir`, and removes files there that are no longer generated. */
async function syncFolder(dir: string, expected: GeneratedFiles, extension: string): Promise<void> {
    const orphaned = [...(await readGeneratedFiles(dir, { extension })).keys()].filter(
        (fileName) => !expected.has(fileName),
    );

    await Promise.all([
        ...[...expected].map(([fileName, content]) => Bun.write(path.join(dir, fileName), content)),
        ...orphaned.map((fileName) => rm(path.join(dir, fileName))),
    ]);
}

async function main(): Promise<void> {
    const routes = await readRoutes();
    const { skills, errors } = await readPluginSkills(FACTORY_DIR, { routes });

    if (errors.length > 0) {
        console.error(errors.map((error) => `✗ ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    const agents = renderTaskAgents(routes);
    const bundles = await renderBundles(FACTORY_DIR);

    await Promise.all([
        Bun.write(path.join(FACTORY_DIR, CATALOG_FILE), renderCatalog(skills, { routes })),
        syncFolder(path.join(FACTORY_DIR, TASK_AGENTS_DIR), agents, ".md"),
        syncFolder(path.join(FACTORY_DIR, BUNDLE_DIR), bundles, ".js"),
    ]);

    console.log(
        `✓ wrote ${CATALOG_FILE} (${skills.length} skills), ${agents.size} task agents and ${bundles.size} bundles`,
    );
}

if (import.meta.main) {
    await main();
}

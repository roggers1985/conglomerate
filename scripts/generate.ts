// Regenerates everything derived from the factory plugin's sources (ADR 0013, 0015):
//
//   bun scripts/generate.ts   CATALOG.md (from the skills and models.json) and agents/tasks/*.md (from models.json)

import { rm } from "node:fs/promises";
import path from "node:path";
import { readRoutes } from "../plugins/factory/scripts/models.ts";
import { readTaskAgents, renderTaskAgents, TASK_AGENTS_DIR } from "./agents.ts";
import { CATALOG_FILE, readPluginSkills, renderCatalog } from "./skills.ts";

const FACTORY_DIR = path.resolve(import.meta.dir, "..", "plugins", "factory");

async function main(): Promise<void> {
    const routes = await readRoutes();
    const { skills, errors } = await readPluginSkills(FACTORY_DIR, routes);

    if (errors.length > 0) {
        console.error(errors.map((error) => `✗ ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    const agentsDir = path.join(FACTORY_DIR, TASK_AGENTS_DIR);
    const expected = renderTaskAgents(routes);
    const stale = [...(await readTaskAgents(FACTORY_DIR)).keys()].filter((fileName) => !expected.has(fileName));

    await Promise.all([
        Bun.write(path.join(FACTORY_DIR, CATALOG_FILE), renderCatalog(skills, routes)),
        ...[...expected].map(([fileName, content]) => Bun.write(path.join(agentsDir, fileName), content)),
        ...stale.map((fileName) => rm(path.join(agentsDir, fileName))),
    ]);

    console.log(`✓ wrote ${CATALOG_FILE} (${skills.length} skills) and ${expected.size} task agents`);
}

if (import.meta.main) {
    await main();
}

// Skills of a plugin: the naming rules (ADR 0013), model routing per skill (ADR 0014) and the generated catalog.
//
//   bun scripts/skills.ts catalog   regenerate plugins/<plugin>/CATALOG.md for every plugin in the marketplace

import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Routes } from "../plugins/factory/scripts/models.ts";
import { readRoutes, renderRoutingTable } from "../plugins/factory/scripts/models.ts";

export type Domain = {
    readonly name: string;
    readonly description: string;
};

export type Skill = {
    readonly name: string;
    readonly description: string;
    /** The task type from models.json, for skills that do a kind of work rather than hold reference material. */
    readonly task: string | null;
};

type SkillFrontmatter = {
    readonly name: string;
    readonly description: string;
    readonly model: string;
    readonly effort: string;
    readonly metadata: { readonly task: string };
};

export type ParsedSkill =
    | { readonly kind: "valid"; readonly skill: Skill }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

// The shape of T before validation: every field may be missing and has an unknown value.
type Unvalidated<T> = { readonly [K in keyof T]?: unknown };

type Rule = readonly [passes: boolean, message: string];

/** Every skill name starts with one of these domains: `<domain>` or `<domain>-<topic>`. */
export const DOMAINS: readonly Domain[] = [
    { name: "code", description: "Coding conventions and practices" },
    { name: "checkup", description: "Recurring checkups and their runner (ADR 0010)" },
    { name: "writing", description: "Content, copy and documentation for people" },
    { name: "marketing", description: "Marketing plans, positioning and communication" },
    { name: "factory", description: "Factory stages: specification, planning, building" },
];

export const CATALOG_FILE = "CATALOG.md";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

const isObject = <T>(value: unknown): value is Unvalidated<T> => typeof value === "object" && value !== null;

const failedRules = (rules: readonly Rule[]): string[] =>
    rules.filter(([passes]) => !passes).map(([, message]) => message);

export function domainOf(skillName: string): Domain | null {
    return DOMAINS.find((domain) => skillName === domain.name || skillName.startsWith(`${domain.name}-`)) ?? null;
}

export function parseFrontmatter(markdown: string): unknown {
    const match = FRONTMATTER.exec(markdown);

    if (match === null) {
        return null;
    }

    return Bun.YAML.parse(match[1] ?? "");
}

function taskOf(frontmatter: Unvalidated<SkillFrontmatter>): unknown {
    return isObject<SkillFrontmatter["metadata"]>(frontmatter.metadata) ? frontmatter.metadata.task : undefined;
}

/** A skill's model and effort always come from its task type in models.json, never from the skill alone. */
function routingErrors(frontmatter: Unvalidated<SkillFrontmatter>, routes: Routes): string[] {
    const task = taskOf(frontmatter);

    if (task === undefined) {
        return failedRules([
            [
                frontmatter.model === undefined && frontmatter.effort === undefined,
                "model and effort come from models.json: set metadata.task instead",
            ],
        ]);
    }

    const route = typeof task === "string" ? routes[task] : undefined;

    if (route === undefined) {
        return [`metadata.task must be one of ${Object.keys(routes).join(", ")}`];
    }

    return failedRules([
        [frontmatter.model === route.model, `model must be "${route.model}" for task "${String(task)}" (models.json)`],
        [
            frontmatter.effort === route.effort,
            `effort must be "${route.effort}" for task "${String(task)}" (models.json)`,
        ],
    ]);
}

export function parseSkill(directory: string, frontmatter: unknown, routes: Routes): ParsedSkill {
    if (!isObject<SkillFrontmatter>(frontmatter)) {
        return { kind: "invalid", errors: ["SKILL.md must start with a YAML frontmatter block"] };
    }

    const { name, description } = frontmatter;
    const errors = failedRules([
        [typeof name === "string" && KEBAB_CASE.test(name), "name must be kebab-case"],
        [name === directory, `name must match its directory "${directory}"`],
        [
            typeof name === "string" && domainOf(name) !== null,
            `name must start with a known domain (${DOMAINS.map((domain) => domain.name).join(", ")})`,
        ],
        [typeof description === "string" && description.length > 0, "description is required"],
    ]);
    const allErrors = [...errors, ...routingErrors(frontmatter, routes)];
    const task = taskOf(frontmatter);

    if (allErrors.length > 0 || typeof name !== "string" || typeof description !== "string") {
        return { kind: "invalid", errors: allErrors };
    }

    return { kind: "valid", skill: { name, description, task: typeof task === "string" ? task : null } };
}

const firstSentence = (text: string): string => text.split(/(?<=\.)\s/)[0] ?? text;

const escapeCell = (text: string): string => text.replaceAll("|", "\\|");

function renderTask(task: string | null, routes: Routes): string {
    const route = task === null ? undefined : routes[task];

    if (task === null || route === undefined) {
        return "";
    }

    return `\`${task}\` (${route.model}, ${route.effort})`;
}

function renderDomain(domain: Domain, skills: readonly Skill[], routes: Routes): string {
    const heading = `## ${domain.name}: ${domain.description}`;
    const own = skills
        .filter((skill) => domainOf(skill.name) === domain)
        .toSorted((a, b) => a.name.localeCompare(b.name));

    if (own.length === 0) {
        return [heading, "", "_No skills yet._"].join("\n");
    }

    const rows = own.map(
        (skill) =>
            `| \`${skill.name}\` | ${escapeCell(firstSentence(skill.description))} | ${renderTask(skill.task, routes)} |`,
    );

    return [heading, "", "| Skill | What it is | Task (model, effort) |", "| --- | --- | --- |", ...rows].join("\n");
}

export function renderCatalog(skills: readonly Skill[], routes: Routes): string {
    return [
        "# Skills catalog",
        "",
        "Generated by `bun run catalog` from the skills' frontmatter. Do not edit by hand.",
        "Skills are named `<domain>-<topic>` (ADR 0013).",
        "",
        ...DOMAINS.map((domain) => `${renderDomain(domain, skills, routes)}\n`),
        "## Model routing (models.json, ADR 0014)",
        "",
        renderRoutingTable(routes),
        "",
    ].join("\n");
}

export type PluginSkills = {
    readonly skills: readonly Skill[];
    readonly errors: readonly string[];
};

export async function readPluginSkills(pluginDir: string, routes: Routes): Promise<PluginSkills> {
    const skillsDir = path.join(pluginDir, "skills");
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const parsed = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
                const markdown = await Bun.file(path.join(skillsDir, entry.name, "SKILL.md")).text();

                return { directory: entry.name, result: parseSkill(entry.name, parseFrontmatter(markdown), routes) };
            }),
    );

    return {
        skills: parsed.flatMap(({ result }) => (result.kind === "valid" ? [result.skill] : [])),
        errors: parsed.flatMap(({ directory, result }) =>
            result.kind === "invalid" ? result.errors.map((error) => `skills/${directory}: ${error}`) : [],
        ),
    };
}

async function main(): Promise<void> {
    const [command] = Bun.argv.slice(2);

    if (command !== "catalog") {
        console.error("Usage: skills.ts catalog");
        process.exitCode = 1;
        return;
    }

    const root = path.resolve(import.meta.dir, "..");
    const pluginsDir = path.join(root, "plugins");
    const plugins = (await readdir(pluginsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());

    const routes = await readRoutes();

    for (const plugin of plugins) {
        const pluginDir = path.join(pluginsDir, plugin.name);
        const { skills } = await readPluginSkills(pluginDir, routes);

        await Bun.write(path.join(pluginDir, CATALOG_FILE), renderCatalog(skills, routes));
        console.log(`✓ wrote plugins/${plugin.name}/${CATALOG_FILE} (${skills.length} skills)`);
    }
}

if (import.meta.main) {
    await main();
}

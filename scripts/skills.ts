// Skills of a plugin: the naming rules (ADR 0013), their task types (ADR 0014, 0015) and the generated catalog.

import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Routes } from "../plugins/factory/scripts/models.ts";
import { renderRoutingTable } from "../plugins/factory/scripts/models.ts";

/** A skill domain: the first part of every skill name (ADR 0013). */
export type Domain = {
    readonly name: string;
    readonly description: string;
};

/** A validated skill, as listed in the catalog. */
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

/** The outcome of validating one skill's frontmatter: the skill, or every problem found. */
export type ParsedSkill =
    | { readonly kind: "valid"; readonly skill: Skill }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

// The shape of T before validation: every field may be missing and has an unknown value.
type Unvalidated<T> = { readonly [K in keyof T]?: unknown };

type Rule = readonly [passes: boolean, message: string];

/** Every skill name starts with one of these domains: `<domain>` or `<domain>-<topic>`. */
const DOMAINS: readonly Domain[] = [
    { name: "code", description: "Coding conventions and practices" },
    { name: "checkup", description: "Recurring checkups and their runner (ADR 0010)" },
    { name: "writing", description: "Content, copy and documentation for people" },
    { name: "marketing", description: "Marketing plans, positioning and communication" },
    { name: "factory", description: "Factory stages: specification, planning, building" },
];

/** The generated skills overview in the plugin's root folder (ADR 0013). */
export const CATALOG_FILE = "CATALOG.md";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

const isObject = <T>(value: unknown): value is Unvalidated<T> => typeof value === "object" && value !== null;

const failedRules = (rules: readonly Rule[]): string[] =>
    rules.filter(([passes]) => !passes).map(([, message]) => message);

/**
 * Finds the domain a skill name belongs to.
 *
 * @param skillName - A skill name, e.g. `code-react`.
 * @returns The domain when the name is `<domain>` or starts with `<domain>-`; otherwise `null`.
 *
 * @example
 * ```ts
 * expect(domainOf("code-react")?.name).toBe("code");
 * expect(domainOf("checkup")?.name).toBe("checkup");
 * expect(domainOf("codex-tools")).toBeNull();
 * ```
 */
export function domainOf(skillName: string): Domain | null {
    return DOMAINS.find((domain) => skillName === domain.name || skillName.startsWith(`${domain.name}-`)) ?? null;
}

/**
 * Reads the YAML frontmatter block at the top of a markdown file.
 *
 * @param markdown - The file's contents.
 * @returns The parsed YAML (not yet validated), or `null` when the file doesn't start with a frontmatter block.
 * @throws Error when the frontmatter is not valid YAML.
 *
 * @example
 * ```ts
 * expect(parseFrontmatter("---\nname: code-react\n---\n# React")).toEqual({ name: "code-react" });
 * expect(parseFrontmatter("# No frontmatter")).toBeNull();
 * ```
 */
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

/** Skills never set a model or effort: those are chosen when work is delegated to a task agent (ADR 0015). */
function routingErrors(frontmatter: Unvalidated<SkillFrontmatter>, routes: Routes): string[] {
    const task = taskOf(frontmatter);
    const knownTask = task === undefined || (typeof task === "string" && routes[task] !== undefined);

    return failedRules([
        [
            frontmatter.model === undefined && frontmatter.effort === undefined,
            "skills don't set model or effort: they come from the task agent (ADR 0015)",
        ],
        [knownTask, `metadata.task must be one of ${Object.keys(routes).join(", ")}`],
    ]);
}

/**
 * Validates a skill's frontmatter against the naming rules (ADR 0013) and task types (ADR 0015).
 *
 * @param directory - The skill's folder name, which must equal its `name`.
 * @param frontmatter - The skill's parsed frontmatter, not yet trusted.
 * @param routes - The task types from `models.json`, to check `metadata.task` against.
 * @returns The skill, or every problem found.
 *
 * @example
 * ```ts
 * const routes = { checkup: { model: "sonnet", effort: "high", use: "Audits" } } as const;
 * const frontmatter = { name: "checkup-seo", description: "SEO checkup.", metadata: { task: "checkup" } };
 *
 * expect(parseSkill("checkup-seo", frontmatter, routes)).toEqual({
 *     kind: "valid",
 *     skill: { name: "checkup-seo", description: "SEO checkup.", task: "checkup" },
 * });
 * ```
 *
 * @example
 * ```ts
 * expect(parseSkill("seo", { name: "seo", description: "SEO.", model: "opus" }, {})).toEqual({
 *     kind: "invalid",
 *     errors: [
 *         "name must start with a known domain (code, checkup, writing, marketing, factory)",
 *         "skills don't set model or effort: they come from the task agent (ADR 0015)",
 *     ],
 * });
 * ```
 */
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

/**
 * Renders the plugin's skills catalog: every domain with its skills, followed by the model routing table.
 *
 * @param skills - The plugin's validated skills.
 * @param routes - The routes from `models.json`, to show each skill's task type and the routing table.
 * @returns The contents of `CATALOG.md`.
 *
 * @example
 * ```ts
 * const catalog = renderCatalog([{ name: "code-react", description: "React conventions. Use for UI.", task: null }], {});
 *
 * expect(catalog).toContain("| `code-react` | React conventions. |  |");
 * expect(catalog).toContain("## marketing: Marketing plans, positioning and communication\n\n_No skills yet._");
 * ```
 */
export function renderCatalog(skills: readonly Skill[], routes: Routes): string {
    return [
        "# Skills catalog",
        "",
        "Generated by `bun run generate` from the skills' frontmatter and models.json. Do not edit by hand.",
        "Skills are named `<domain>-<topic>` (ADR 0013).",
        "",
        ...DOMAINS.map((domain) => `${renderDomain(domain, skills, routes)}\n`),
        "## Model routing (models.json, ADR 0014)",
        "",
        renderRoutingTable(routes),
        "",
    ].join("\n");
}

/** A plugin's valid skills, and the problems with its invalid ones. */
export type PluginSkills = {
    readonly skills: readonly Skill[];
    readonly errors: readonly string[];
};

/**
 * Reads and validates every skill in a plugin's `skills/` folder.
 *
 * @param pluginDir - The plugin's root folder.
 * @param routes - The task types from `models.json`.
 * @returns The valid skills, and every problem prefixed with `skills/<folder>: `.
 * @throws Error when the plugin has no `skills/` folder, or a skill folder has no `SKILL.md`.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const pluginDir = await mkdtemp(`${tmpdir()}/plugin-`);
 * await Bun.write(`${pluginDir}/skills/code-go/SKILL.md`, "---\nname: code-go\ndescription: Go.\n---\n");
 *
 * expect(await readPluginSkills(pluginDir, {})).toEqual({
 *     skills: [{ name: "code-go", description: "Go.", task: null }],
 *     errors: [],
 * });
 *
 * await rm(pluginDir, { recursive: true });
 * ```
 */
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

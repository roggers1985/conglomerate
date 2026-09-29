// Skills of a plugin: the naming rules (ADR 0013), their task types (ADR 0014, 0015) and the generated catalog.

import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readText } from "../lib/files.ts";
import { KEBAB_CASE } from "../lib/kebab-case.ts";
import type { Parsed } from "../lib/parse.ts";
import { parse } from "../lib/parse.ts";
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

/** The outcome of parsing one skill's frontmatter: the skill, or every problem found. */
export type ParsedSkill = Parsed<Skill>;

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

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

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

function skillSchema(directory: string, routes: Routes) {
    const domains = DOMAINS.map((domain) => domain.name).join(", ");
    const tasks = Object.keys(routes).join(", ");
    const setByTaskAgent = "skills don't set this: model and effort come from the task agent (ADR 0015)";

    // Claude Code's frontmatter format has many more fields, so unknown keys are allowed (ADR 0020).
    return z.looseObject({
        name: z
            .string()
            .regex(KEBAB_CASE, "must be kebab-case")
            .refine((name) => name === directory, `must match its directory "${directory}"`)
            .refine((name) => domainOf(name) !== null, `must start with a known domain (${domains})`),
        description: z.string().min(1, "is required"),
        model: z.never(setByTaskAgent).optional(),
        effort: z.never(setByTaskAgent).optional(),
        metadata: z
            .looseObject({
                task: z
                    .string()
                    .refine((task) => routes[task] !== undefined, `must be one of ${tasks}`)
                    .optional(),
            })
            .optional(),
    });
}

/**
 * Parses a skill's frontmatter against the naming rules (ADR 0013) and task types (ADR 0015).
 *
 * @param frontmatter - The skill's parsed frontmatter, not yet trusted.
 * @param options.directory - The skill's folder name, which must equal its `name`.
 * @param options.routes - The task types from `models.json`, to check `metadata.task` against.
 * @returns The skill, or every problem found.
 *
 * @example
 * ```ts
 * const routes = { checkup: { model: "sonnet", effort: "high", use: "Audits" } } as const;
 * const frontmatter = { name: "checkup-seo", description: "SEO checkup.", metadata: { task: "checkup" } };
 *
 * expect(parseSkill(frontmatter, { directory: "checkup-seo", routes })).toEqual({
 *     kind: "valid",
 *     value: { name: "checkup-seo", description: "SEO checkup.", task: "checkup" },
 * });
 * ```
 *
 * @example
 * ```ts
 * expect(parseSkill({ name: "seo", description: "SEO.", model: "opus" }, { directory: "seo", routes: {} })).toEqual({
 *     kind: "invalid",
 *     errors: [
 *         "name: must start with a known domain (code, checkup, writing, marketing, factory)",
 *         "model: skills don't set this: model and effort come from the task agent (ADR 0015)",
 *     ],
 * });
 * ```
 */
export function parseSkill(
    frontmatter: unknown,
    { directory, routes }: { readonly directory: string; readonly routes: Routes },
): ParsedSkill {
    if (frontmatter === null) {
        return { kind: "invalid", errors: ["SKILL.md must start with a YAML frontmatter block"] };
    }

    const parsed = parse(skillSchema(directory, routes), frontmatter);

    if (parsed.kind === "invalid") {
        return parsed;
    }

    const { name, description, metadata } = parsed.value;

    return { kind: "valid", value: { name, description, task: metadata?.task ?? null } };
}

const firstSentence = (text: string): string => text.split(/(?<=\.)\s/)[0] ?? text;

const escapeCell = (text: string): string => text.replaceAll("|", "\\|");

function renderTask(task: string | null, routes: Routes): string {
    if (task === null) {
        return "";
    }

    const route = routes[task];

    if (route === undefined) {
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
 * @param options.routes - The routes from `models.json`, to show each skill's task type and the routing table.
 * @returns The contents of `CATALOG.md`.
 *
 * @example
 * ```ts
 * const skills = [{ name: "code-react", description: "React conventions. Use for UI.", task: null }];
 * const catalog = renderCatalog(skills, { routes: {} });
 *
 * expect(catalog).toContain("| `code-react` | React conventions. |  |");
 * expect(catalog).toContain("## marketing: Marketing plans, positioning and communication\n\n_No skills yet._");
 * ```
 */
export function renderCatalog(skills: readonly Skill[], { routes }: { readonly routes: Routes }): string {
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
 * @param options.routes - The task types from `models.json`.
 * @param options.signal - Cancels the reads.
 * @returns The valid skills, and every problem prefixed with `skills/<folder>: `.
 * @throws Error when the plugin has no `skills/` folder, or a skill folder has no `SKILL.md`.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const pluginDir = await mkdtemp(`${tmpdir()}/plugin-`);
 * await Bun.write(`${pluginDir}/skills/code-go/SKILL.md`, "---\nname: code-go\ndescription: Go.\n---\n");
 *
 * expect(await readPluginSkills(pluginDir, { routes: {}, signal: AbortSignal.timeout(5_000) })).toEqual({
 *     skills: [{ name: "code-go", description: "Go.", task: null }],
 *     errors: [],
 * });
 *
 * await rm(pluginDir, { recursive: true });
 * ```
 */
export async function readPluginSkills(
    pluginDir: string,
    { routes, signal }: { readonly routes: Routes; readonly signal: AbortSignal },
): Promise<PluginSkills> {
    const skillsDir = path.join(pluginDir, "skills");

    // readdir takes no signal: check before starting instead.
    signal.throwIfAborted();

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const parsed = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
                const markdown = await readText(path.join(skillsDir, entry.name, "SKILL.md"), { signal });

                return {
                    directory: entry.name,
                    result: parseSkill(parseFrontmatter(markdown), { directory: entry.name, routes }),
                };
            }),
    );

    return {
        skills: parsed.flatMap(({ result }) => (result.kind === "valid" ? [result.value] : [])),
        errors: parsed.flatMap(({ directory, result }) =>
            result.kind === "invalid" ? result.errors.map((error) => `skills/${directory}: ${error}`) : [],
        ),
    };
}

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Routes } from "../plugins/factory/scripts/models.ts";
import { domainOf, parseFrontmatter, parseSkill, readPluginSkills, renderCatalog } from "./skills.ts";

const routes: Routes = { checkup: { model: "sonnet", effort: "high", use: "Audits" } };

describe("domainOf", () => {
    it("finds the domain of a <domain>-<topic> name", () => {
        expect(domainOf("code-react")?.name).toBe("code");
    });

    it("accepts a bare domain name", () => {
        expect(domainOf("checkup")?.name).toBe("checkup");
    });

    it("does not match a domain that is only a prefix of the first word", () => {
        expect(domainOf("codex-tools")).toBeNull();
    });
});

describe("parseFrontmatter", () => {
    it("reads the YAML block at the top of a skill", () => {
        expect(parseFrontmatter("---\nname: code-react\ndescription: React.\n---\n\n# Body")).toEqual({
            name: "code-react",
            description: "React.",
        });
    });

    it("returns null without a frontmatter block", () => {
        expect(parseFrontmatter("# Just a heading")).toBeNull();
    });
});

describe("parseSkill", () => {
    it("accepts a well-named skill", () => {
        expect(parseSkill({ name: "code-react", description: "React." }, { directory: "code-react", routes })).toEqual({
            kind: "valid",
            value: { name: "code-react", description: "React.", task: null },
        });
    });

    it("rejects a name without a known domain", () => {
        expect(
            parseSkill(
                { name: "react-conventions", description: "React." },
                { directory: "react-conventions", routes },
            ),
        ).toEqual({
            kind: "invalid",
            errors: [
                "name: must start with a known domain (code, checkup, writing, marketing, factory, toolbox, autonomy)",
            ],
        });
    });

    it("rejects a name that differs from its directory", () => {
        expect(parseSkill({ name: "code-vue", description: "Vue." }, { directory: "code-react", routes })).toEqual({
            kind: "invalid",
            errors: ['name: must match its directory "code-react"'],
        });
    });

    it("accepts names of up to 64 characters, the Agent Skills limit", () => {
        const name64 = `code-${"a".repeat(59)}`;
        const name65 = `code-${"a".repeat(60)}`;

        expect(parseSkill({ name: name64, description: "A." }, { directory: name64, routes }).kind).toBe("valid");
        expect(parseSkill({ name: name65, description: "A." }, { directory: name65, routes })).toEqual({
            kind: "invalid",
            errors: ["name: must be at most 64 characters"],
        });
    });

    it("requires a description of up to 1,024 characters, the Agent Skills limit", () => {
        const withDescription = (description: string) =>
            parseSkill({ name: "code-react", description }, { directory: "code-react", routes });

        expect(withDescription("x".repeat(1_024)).kind).toBe("valid");
        expect(withDescription("x".repeat(1_025))).toEqual({
            kind: "invalid",
            errors: ["description: must be at most 1024 characters"],
        });
        expect(withDescription("   ")).toEqual({ kind: "invalid", errors: ["description: is required"] });
    });

    it("rejects a skill without frontmatter", () => {
        expect(parseSkill(null, { directory: "code-react", routes })).toEqual({
            kind: "invalid",
            errors: ["SKILL.md must start with a YAML frontmatter block"],
        });
    });
});

describe("parseSkill with a task type", () => {
    const checkupSkill = { name: "checkup-seo", description: "SEO.", metadata: { task: "checkup" } };

    it("accepts a skill with a known task type", () => {
        expect(parseSkill(checkupSkill, { directory: "checkup-seo", routes })).toEqual({
            kind: "valid",
            value: { name: "checkup-seo", description: "SEO.", task: "checkup" },
        });
    });

    it("rejects an unknown task type", () => {
        expect(
            parseSkill({ ...checkupSkill, metadata: { task: "gardening" } }, { directory: "checkup-seo", routes }),
        ).toEqual({
            kind: "invalid",
            errors: ["metadata.task: must be one of checkup"],
        });
    });

    it("rejects a skill that pins its own model or effort", () => {
        expect(
            parseSkill({ ...checkupSkill, model: "sonnet", effort: "high" }, { directory: "checkup-seo", routes }),
        ).toEqual({
            kind: "invalid",
            errors: [
                "model: skills don't set this: model and effort come from the task agent (ADR 0015)",
                "effort: skills don't set this: model and effort come from the task agent (ADR 0015)",
            ],
        });
    });
});

describe("renderCatalog", () => {
    const catalog = renderCatalog(
        [
            { name: "code-testing", description: "Testing conventions. Use when writing tests.", task: null },
            { name: "code-react", description: "React | UI conventions. Use for components.", task: null },
            { name: "checkup-seo", description: "SEO checkup. Use for SEO.", task: "checkup" },
        ],
        { routes },
    );

    it("groups skills under their domain, sorted, with the first sentence of their description", () => {
        expect(catalog).toContain(
            "## code: Coding conventions and practices\n\n| Skill | What it is | Task (model, effort) |\n| --- | --- | --- |\n| `code-react` | React \\| UI conventions. |  |\n| `code-testing` | Testing conventions. |  |",
        );
    });

    it("shows the task type, model and effort of task skills", () => {
        expect(catalog).toContain("| `checkup-seo` | SEO checkup. | `checkup` (sonnet, high) |");
    });

    it("ends with the model routing table", () => {
        expect(catalog).toContain("## Model routing (models.json, ADR 0014)\n\n| Task | Model | Effort | Use for |");
    });

    it("lists domains without skills too", () => {
        expect(catalog).toContain("## marketing: Marketing plans, positioning and communication\n\n_No skills yet._");
    });
});

describe("readPluginSkills", () => {
    let pluginDir = "";

    afterEach(async () => {
        await rm(pluginDir, { recursive: true, force: true });
    });

    it("reads valid skills and reports invalid ones by directory", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));
        await Bun.write(path.join(pluginDir, "skills/code-go/SKILL.md"), "---\nname: code-go\ndescription: Go.\n---\n");
        await Bun.write(path.join(pluginDir, "skills/go/SKILL.md"), "---\nname: go\ndescription: Go.\n---\n");

        expect(await readPluginSkills(pluginDir, { routes, signal: AbortSignal.timeout(5_000) })).toEqual({
            skills: [{ name: "code-go", description: "Go.", task: null }],
            errors: [
                "skills/go: name: must start with a known domain (code, checkup, writing, marketing, factory, toolbox, autonomy)",
            ],
        });
    });

    it("skips files next to the skill folders, such as .DS_Store", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));
        await Bun.write(path.join(pluginDir, "skills/code-go/SKILL.md"), "---\nname: code-go\ndescription: Go.\n---\n");
        await Bun.write(path.join(pluginDir, "skills/.DS_Store"), "");

        expect(await readPluginSkills(pluginDir, { routes, signal: AbortSignal.timeout(5_000) })).toEqual({
            skills: [{ name: "code-go", description: "Go.", task: null }],
            errors: [],
        });
    });

    it("stops when aborted", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));
        await Bun.write(path.join(pluginDir, "skills/code-go/SKILL.md"), "---\nname: code-go\ndescription: Go.\n---\n");

        await expect(readPluginSkills(pluginDir, { routes, signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });

    it("reports frontmatter that isn't valid YAML as a problem of that skill", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));
        await Bun.write(
            path.join(pluginDir, "skills/code-go/SKILL.md"),
            "---\nname: code-go\ndescription: Go. Use when: writing Go.\n---\n",
        );

        const { errors } = await readPluginSkills(pluginDir, { routes, signal: AbortSignal.timeout(5_000) });

        expect(errors).toHaveLength(1);
        expect(errors[0]).toStartWith("skills/code-go: frontmatter is not valid YAML");
    });
});

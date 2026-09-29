import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { domainOf, parseFrontmatter, parseSkill, readPluginSkills, renderCatalog } from "./skills.ts";

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
        expect(parseSkill("code-react", { name: "code-react", description: "React." })).toEqual({
            kind: "valid",
            skill: { name: "code-react", description: "React." },
        });
    });

    it("rejects a name without a known domain", () => {
        expect(parseSkill("react-conventions", { name: "react-conventions", description: "React." })).toEqual({
            kind: "invalid",
            errors: ["name must start with a known domain (code, checkup, writing, marketing, factory)"],
        });
    });

    it("rejects a name that differs from its directory", () => {
        expect(parseSkill("code-react", { name: "code-vue", description: "Vue." })).toEqual({
            kind: "invalid",
            errors: ['name must match its directory "code-react"'],
        });
    });

    it("rejects a skill without frontmatter", () => {
        expect(parseSkill("code-react", null)).toEqual({
            kind: "invalid",
            errors: ["SKILL.md must start with a YAML frontmatter block"],
        });
    });
});

describe("renderCatalog", () => {
    const catalog = renderCatalog([
        { name: "code-testing", description: "Testing conventions. Use when writing tests." },
        { name: "code-react", description: "React | UI conventions. Use for components." },
    ]);

    it("groups skills under their domain, sorted, with the first sentence of their description", () => {
        expect(catalog).toContain(
            "## code: Coding conventions and practices\n\n| Skill | What it is |\n| --- | --- |\n| `code-react` | React \\| UI conventions. |\n| `code-testing` | Testing conventions. |",
        );
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

        expect(await readPluginSkills(pluginDir)).toEqual({
            skills: [{ name: "code-go", description: "Go." }],
            errors: ["skills/go: name must start with a known domain (code, checkup, writing, marketing, factory)"],
        });
    });
});

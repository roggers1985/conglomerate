import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin, Tool, Toolbox } from "./toolbox.ts";
import { parseToolbox, toolboxReminder, toolboxReport, toolboxStatus } from "./toolbox.ts";

const jq: Tool = {
    name: "jq",
    purpose: "JSON processor",
    command: "jq",
    install: "brew install jq",
    source: "https://jqlang.github.io/jq/",
    license: "MIT",
    permissions: "None.",
    requires: [],
};

const rtk: Tool = {
    ...jq,
    name: "rtk",
    command: "rtk",
    purpose: "Token saver",
    install: "brew install rtk",
    requires: ["jq"],
};

const factory: Plugin = {
    id: "factory@conglomerate",
    purpose: "This factory",
    source: "Local marketplace",
    license: "MIT",
    permissions: "SessionStart hooks",
    requires: ["rtk"],
};

const toolbox: Toolbox = { tools: [jq, rtk], plugins: [factory] };

/** The distinct paths of the fields that failed, so tests don't depend on the schema library's wording. */
const failedPaths = (value: unknown): string[] => {
    const parsed = parseToolbox(value);

    const paths = parsed.kind === "invalid" ? parsed.errors.map((error) => error.split(": ")[0] ?? error) : [];

    return [...new Set(paths)];
};

describe("parseToolbox", () => {
    it("accepts a valid toolbox", () => {
        expect(parseToolbox(toolbox)).toEqual({ kind: "valid", value: toolbox });
    });

    it("rejects empty and missing fields", () => {
        expect(failedPaths({ tools: [{ ...jq, license: "", permissions: undefined }], plugins: [] })).toEqual([
            "tools[0].license",
            "tools[0].permissions",
        ]);
    });

    it("rejects unknown keys, which are usually typos", () => {
        const parsed = parseToolbox({ tools: [{ ...jq, homepage: "https://example.com" }], plugins: [] });

        expect(parsed.kind === "invalid" && parsed.errors.join("\n")).toContain('"homepage"');
    });

    it("enforces upper bounds on lists and text", () => {
        const tooMany = Array.from({ length: 51 }, (_, index) => ({ ...jq, name: `tool-${index}` }));

        expect(failedPaths({ tools: tooMany, plugins: [] })).toEqual(["tools"]);
        expect(failedPaths({ tools: [{ ...jq, purpose: "x".repeat(301) }], plugins: [] })).toEqual([
            "tools[0].purpose",
        ]);
    });

    it("refuses tools and plugins without a permissive open-source license", () => {
        expect(
            failedPaths({
                tools: [{ ...jq, license: "GPL-3.0-only" }],
                plugins: [{ ...factory, license: "BUSL-1.1", requires: [] }],
            }),
        ).toEqual(["tools[0].license", "plugins[0].license"]);
    });

    it("rejects a plugin id that isn't name@marketplace", () => {
        expect(failedPaths({ tools: [], plugins: [{ ...factory, id: "factory", requires: [] }] })).toEqual([
            "plugins[0].id",
        ]);
    });

    it("rejects requirements that aren't in the toolbox", () => {
        expect(parseToolbox({ tools: [rtk], plugins: [] })).toEqual({
            kind: "invalid",
            errors: ['"jq" is required but not in the toolbox'],
        });
    });

    it("accepts the plugin's own toolbox.json", async () => {
        const json = await Bun.file(path.join(import.meta.dir, "..", "toolbox.json")).json();

        expect(parseToolbox(json).kind).toBe("valid");
    });
});

describe("toolboxStatus", () => {
    it("finds tools missing from the PATH and plugins that aren't enabled", () => {
        const status = toolboxStatus(toolbox, { isOnPath: (command) => command === "jq", enabledPlugins: new Set() });

        expect(status).toEqual({ missingTools: [rtk], missingPlugins: [factory] });
    });

    it("finds nothing missing when everything is present", () => {
        const status = toolboxStatus(toolbox, { isOnPath: () => true, enabledPlugins: new Set([factory.id]) });

        expect(status).toEqual({ missingTools: [], missingPlugins: [] });
    });
});

describe("toolboxReminder", () => {
    it("stays silent when nothing is missing", () => {
        expect(toolboxReminder({ missingTools: [], missingPlugins: [] })).toBeNull();
    });

    it("names what is missing, and tells Claude not to install without confirmation", () => {
        const output = toolboxReminder({ missingTools: [rtk], missingPlugins: [factory] });

        expect(output?.systemMessage).toBe(
            "Missing from your toolbox: rtk, factory@conglomerate (plugin). Run /factory:toolbox to see how to install.",
        );
        expect(output?.hookSpecificOutput.additionalContext).toContain(
            "Don't install anything without the user's explicit confirmation",
        );
    });
});

describe("toolboxReport", () => {
    it("lists every entry, with its state and install command", () => {
        const report = toolboxReport(toolbox, { missingTools: [rtk], missingPlugins: [] });

        expect(report).toContain("| jq | tool | present | JSON processor | `brew install jq` |");
        expect(report).toContain("| rtk | tool | **missing** | Token saver | `brew install rtk` |");
        expect(report).toContain(
            "| factory@conglomerate | plugin | enabled | This factory | `claude plugin install factory@conglomerate` |",
        );
    });

    it("escapes pipes, so install commands with a pipeline keep the table intact", () => {
        const bun = { ...jq, name: "bun", install: "curl -fsSL https://bun.sh/install | bash" };

        expect(toolboxReport({ tools: [bun], plugins: [] }, { missingTools: [], missingPlugins: [] })).toContain(
            "| `curl -fsSL https://bun.sh/install \\| bash` |",
        );
    });
});

describe("toolbox CLI", () => {
    const script = path.join(import.meta.dir, "toolbox.ts");
    let home = "";

    afterEach(async () => {
        await rm(home, { recursive: true, force: true });
    });

    it("reports every tool and plugin as missing on an empty machine", async () => {
        home = await mkdtemp(path.join(tmpdir(), "home-"));
        const emptyPath = path.join(home, "bin");
        const cli = Bun.spawn([process.execPath, script, "reminder"], {
            stdout: "pipe",
            // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
            env: { ...process.env, HOME: home, PATH: emptyPath },
        });
        const [stdout, exitCode] = await Promise.all([new Response(cli.stdout).text(), cli.exited]);

        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).systemMessage).toStartWith("Missing from your toolbox: rtk, jq, gh, bun");
    });
});

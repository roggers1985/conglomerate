// Toolbox (ADR 0033): the owner's trusted tools and plugins, and which of them are missing on this machine.
//
//   bun toolbox.ts reminder   SessionStart hook output; prints nothing when everything is present
//   bun toolbox.ts status     markdown status table, injected into the /factory:toolbox skill
//
// Checking is local and fast: tools are looked up on the PATH, plugins in ~/.claude/settings.json. Nothing is ever
// installed from here; installing is proposed by the skill and confirmed by the owner.

import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { isFileNotFound } from "../../../lib/errors.ts";
import { readJson } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import { KEBAB_CASE } from "../../../lib/kebab-case.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";
import type { ReminderOutput } from "./checkups.ts";

const ENTRIES_MAX = 50; // a personal toolbox; far more than this means it needs pruning
const TEXT_LENGTH_MAX = 300;
const REQUIRES_MAX = 10;
const TOOLBOX_PATH = path.resolve(import.meta.dir, "..", "toolbox.json");
const RUNNER = "/factory:toolbox";
const PLUGIN_ID = /^[a-z0-9-]+@[a-z0-9-]+$/;

const Text = z.string().min(1).max(TEXT_LENGTH_MAX);
const Requires = z.array(z.string().min(1).max(100)).max(REQUIRES_MAX);

const ToolSchema = z.strictObject({
    name: z.string().max(50).regex(KEBAB_CASE, "must be kebab-case"),
    purpose: Text,
    command: z.string().min(1).max(50),
    install: Text,
    source: Text,
    license: z.string().min(1).max(100),
    permissions: Text,
    requires: Requires,
});

const PluginSchema = z.strictObject({
    id: z.string().max(100).regex(PLUGIN_ID, "must look like name@marketplace"),
    purpose: Text,
    source: Text,
    permissions: Text,
    requires: Requires,
});

// Our own file, so strict (ADR 0020), with bounds on every list (ADR 0032).
const ToolboxSchema = z
    .strictObject({
        tools: z.array(ToolSchema).max(ENTRIES_MAX),
        plugins: z.array(PluginSchema).max(ENTRIES_MAX),
    })
    .superRefine(({ tools, plugins }, context) => {
        const known = new Set([...tools.map((tool) => tool.name), ...plugins.map((plugin) => plugin.id)]);
        const unknownRequirements = [...tools, ...plugins]
            .flatMap((entry) => entry.requires)
            .filter((requirement) => !known.has(requirement));

        for (const requirement of new Set(unknownRequirements)) {
            context.addIssue({ code: "custom", message: `"${requirement}" is required but not in the toolbox` });
        }
    });

// Claude Code's settings: someone else's format, so extra fields are allowed.
const SettingsSchema = z.looseObject({ enabledPlugins: z.record(z.string(), z.boolean()).optional() });

/** A command-line tool in the toolbox, with its security record (ADR 0033). */
export type Tool = Readonly<z.infer<typeof ToolSchema>>;

/** A Claude Code plugin in the toolbox, with its security record (ADR 0033). */
export type Plugin = Readonly<z.infer<typeof PluginSchema>>;

/** The owner's trusted tools and plugins (`toolbox.json`). */
export type Toolbox = Readonly<z.infer<typeof ToolboxSchema>>;

/** What is missing from the toolbox on this machine. */
export type ToolboxStatus = {
    readonly missingTools: readonly Tool[];
    readonly missingPlugins: readonly Plugin[];
};

/**
 * Parses the contents of `toolbox.json`.
 *
 * @param value - The parsed JSON, not yet trusted.
 * @returns The toolbox, or every problem found (invalid fields, lists over their bound, unknown requirements).
 *
 * @example
 * ```ts
 * const jq = {
 *     name: "jq", purpose: "JSON processor", command: "jq", install: "brew install jq",
 *     source: "https://jqlang.github.io/jq/", license: "MIT", permissions: "None.", requires: [],
 * };
 *
 * expect(parseToolbox({ tools: [jq], plugins: [] })).toEqual({ kind: "valid", value: { tools: [jq], plugins: [] } });
 * expect(parseToolbox({ tools: [{ ...jq, requires: ["yq"] }], plugins: [] })).toEqual({
 *     kind: "invalid",
 *     errors: ['"yq" is required but not in the toolbox'],
 * });
 * ```
 */
export function parseToolbox(value: unknown): Parsed<Toolbox> {
    return parse(ToolboxSchema, value);
}

/**
 * Works out which tools and plugins of the toolbox are missing.
 *
 * @param toolbox - The owner's toolbox.
 * @param options.isOnPath - Whether a command can be found on the PATH.
 * @param options.enabledPlugins - The plugin ids that are enabled in Claude Code.
 * @returns The missing tools and plugins, in toolbox order.
 *
 * @example
 * ```ts
 * const toolbox = {
 *     tools: [{ name: "jq", purpose: "JSON", command: "jq", install: "brew install jq", source: "s", license: "MIT", permissions: "p", requires: [] }],
 *     plugins: [{ id: "factory@conglomerate", purpose: "p", source: "s", permissions: "p", requires: [] }],
 * };
 * const status = toolboxStatus(toolbox, { isOnPath: () => false, enabledPlugins: new Set(["factory@conglomerate"]) });
 *
 * expect(status.missingTools.map((tool) => tool.name)).toEqual(["jq"]);
 * expect(status.missingPlugins).toEqual([]);
 * ```
 */
export function toolboxStatus(
    toolbox: Toolbox,
    {
        isOnPath,
        enabledPlugins,
    }: { readonly isOnPath: (command: string) => boolean; readonly enabledPlugins: ReadonlySet<string> },
): ToolboxStatus {
    return {
        missingTools: toolbox.tools.filter((tool) => !isOnPath(tool.command)),
        missingPlugins: toolbox.plugins.filter((plugin) => !enabledPlugins.has(plugin.id)),
    };
}

const escapeCell = (text: string): string => text.replaceAll("|", "\\|");

const missingNames = (status: ToolboxStatus): string[] => [
    ...status.missingTools.map((tool) => tool.name),
    ...status.missingPlugins.map((plugin) => `${plugin.id} (plugin)`),
];

/**
 * Builds the session-start reminder for missing tools and plugins.
 *
 * @param status - What is missing.
 * @returns The hook output, or `null` (print nothing) when nothing is missing.
 *
 * @example
 * ```ts
 * expect(toolboxReminder({ missingTools: [], missingPlugins: [] })).toBeNull();
 *
 * const plugin = { id: "gopls-lsp@claude-plugins-official", purpose: "p", source: "s", permissions: "p", requires: [] };
 * const output = toolboxReminder({ missingTools: [], missingPlugins: [plugin] });
 *
 * expect(output?.systemMessage).toBe(
 *     "Missing from your toolbox: gopls-lsp@claude-plugins-official (plugin). Run /factory:toolbox to see how to install.",
 * );
 * ```
 */
export function toolboxReminder(status: ToolboxStatus): ReminderOutput | null {
    const names = missingNames(status);

    if (names.length === 0) {
        return null;
    }

    const notice = `Missing from your toolbox: ${names.join(", ")}. Run ${RUNNER} to see how to install.`;

    return {
        systemMessage: notice,
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: `${notice}\nDon't install anything without the user's explicit confirmation, and don't bring this up unless the user asks.`,
        },
    };
}

/**
 * Renders the toolbox status table that the `/factory:toolbox` skill shows.
 *
 * @param toolbox - The owner's toolbox.
 * @param status - What is missing.
 * @returns A markdown table of every tool and plugin, with missing ones in bold and their install command.
 *
 * @example
 * ```ts
 * const jq = { name: "jq", purpose: "JSON", command: "jq", install: "brew install jq", source: "s", license: "MIT", permissions: "p", requires: [] };
 * const report = toolboxReport({ tools: [jq], plugins: [] }, { missingTools: [jq], missingPlugins: [] });
 *
 * expect(report).toContain("| jq | tool | **missing** | JSON | `brew install jq` |");
 * ```
 */
export function toolboxReport(toolbox: Toolbox, status: ToolboxStatus): string {
    const toolRows = toolbox.tools.map((tool) => {
        const state = status.missingTools.includes(tool) ? "**missing**" : "present";

        return `| ${tool.name} | tool | ${state} | ${escapeCell(tool.purpose)} | \`${escapeCell(tool.install)}\` |`;
    });
    const pluginRows = toolbox.plugins.map((plugin) => {
        const state = status.missingPlugins.includes(plugin) ? "**missing**" : "enabled";

        return `| ${plugin.id} | plugin | ${state} | ${escapeCell(plugin.purpose)} | \`claude plugin install ${plugin.id}\` |`;
    });

    return [
        "| Name | Kind | State | Purpose | Install |",
        "| --- | --- | --- | --- | --- |",
        ...toolRows,
        ...pluginRows,
    ].join("\n");
}

async function readToolbox({ signal }: { readonly signal: AbortSignal }): Promise<Toolbox> {
    const parsed = parseToolbox(await readJson(TOOLBOX_PATH, { signal }));

    if (parsed.kind === "invalid") {
        throw new Error(`toolbox.json is invalid: ${parsed.errors.join("; ")}`);
    }

    return parsed.value;
}

/** The plugins enabled in the user's Claude Code settings; empty when there are no settings yet. */
async function readEnabledPlugins({ signal }: { readonly signal: AbortSignal }): Promise<ReadonlySet<string>> {
    const settingsPath = path.join(homedir(), ".claude", "settings.json");

    try {
        const parsed = parse(SettingsSchema, await readJson(settingsPath, { signal }));

        if (parsed.kind === "invalid") {
            throw new Error(`${settingsPath} is invalid: ${parsed.errors.join("; ")}`);
        }

        const enabled = Object.entries(parsed.value.enabledPlugins ?? {}).filter(([, isEnabled]) => isEnabled);

        return new Set(enabled.map(([id]) => id));
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return new Set();
        }
        throw error;
    }
}

const COMMANDS = ["reminder", "status"] as const;

type Command = (typeof COMMANDS)[number];

const isCommand = (value: string | undefined): value is Command => COMMANDS.some((command) => command === value);

async function main(): Promise<void> {
    const [command] = Bun.argv.slice(2);

    if (!isCommand(command)) {
        console.error(`Usage: toolbox.ts <${COMMANDS.join("|")}>`);
        process.exitCode = 1;
        return;
    }

    const signal = interruptSignal();
    const [toolbox, enabledPlugins] = await Promise.all([readToolbox({ signal }), readEnabledPlugins({ signal })]);
    const status = toolboxStatus(toolbox, { isOnPath: (name) => Bun.which(name) !== null, enabledPlugins });

    if (command === "status") {
        console.log(toolboxReport(toolbox, status));
        return;
    }

    const output = toolboxReminder(status);

    if (output !== null) {
        console.log(JSON.stringify(output));
    }
}

if (import.meta.main) {
    await main();
}

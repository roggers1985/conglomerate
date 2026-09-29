// Model routing (ADR 0014, 0015): which model and effort level to use for which kind of task.

import path from "node:path";
import { z } from "zod";
import { readJson } from "../../../lib/files.ts";
import { KEBAB_CASE } from "../../../lib/kebab-case.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";

const MODELS = ["opus", "sonnet", "haiku", "fable"] as const;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
const MODELS_PATH = path.resolve(import.meta.dir, "..", "models.json");

const TaskRouteSchema = z.strictObject({
    model: z.enum(MODELS),
    effort: z.enum(EFFORTS),
    use: z.string().min(1),
});

// Our own file, so strict: unknown keys are typos (ADR 0020).
const ModelsFileSchema = z.strictObject({
    tasks: z.record(z.string(), TaskRouteSchema).superRefine((tasks, context) => {
        const invalidNames = Object.keys(tasks).filter((task) => !KEBAB_CASE.test(task));

        for (const task of invalidNames) {
            context.addIssue({ code: "custom", message: "task names must be kebab-case", path: [task] });
        }
    }),
});

/** The default model and effort for one task type, and what that task type is for. */
export type TaskRoute = Readonly<z.infer<typeof TaskRouteSchema>>;

/** Every task type in `models.json`, by name. */
export type Routes = Readonly<Record<string, TaskRoute>>;

/**
 * Parses the contents of `models.json`.
 *
 * @param value - The parsed JSON, not yet trusted.
 * @returns The routes by task type, or every problem found, so they can all be fixed at once.
 *
 * @example
 * ```ts
 * const review = { model: "opus", effort: "high", use: "Reviewing code" };
 *
 * expect(parseRoutes({ tasks: { review } })).toEqual({ kind: "valid", value: { review } });
 * ```
 *
 * @example
 * ```ts
 * const parsed = parseRoutes({ tasks: { review: { model: "gpt", effort: "high", use: "Reviewing" } } });
 *
 * expect(parsed.kind).toBe("invalid");
 * expect(parsed.kind === "invalid" && parsed.errors[0]).toStartWith("tasks.review.model: ");
 * ```
 */
export function parseRoutes(value: unknown): Parsed<Routes> {
    const parsed = parse(ModelsFileSchema, value);

    if (parsed.kind === "invalid") {
        return parsed;
    }

    return { kind: "valid", value: parsed.value.tasks };
}

/**
 * Renders the routes as a markdown table, one row per task type.
 *
 * @param tasks - The routes to render, in the order they should appear.
 * @returns The table, without a trailing newline.
 *
 * @example
 * ```ts
 * const table = renderRoutingTable({ review: { model: "opus", effort: "high", use: "Reviewing code" } });
 *
 * expect(table.split("\n").at(-1)).toBe("| `review` | opus | high | Reviewing code |");
 * ```
 */
export function renderRoutingTable(tasks: Routes): string {
    const rows = Object.entries(tasks).map(
        ([task, route]) => `| \`${task}\` | ${route.model} | ${route.effort} | ${route.use} |`,
    );

    return ["| Task | Model | Effort | Use for |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

/**
 * Renders the model routing section that the session-start hook adds to every session.
 *
 * @remarks
 * Tells Claude to delegate through the task agents, and when it may override their model (ADR 0015).
 *
 * @param tasks - The routes from `models.json`.
 * @returns A markdown section starting with `## Model routing`.
 *
 * @example
 * ```ts
 * const context = renderRoutingContext({ code: { model: "sonnet", effort: "medium", use: "Everyday work" } });
 *
 * expect(context).toStartWith("## Model routing");
 * expect(context).toContain("The user's choice always wins");
 * ```
 */
export function renderRoutingContext(tasks: Routes): string {
    return [
        "## Model routing",
        "",
        "Delegate work to the task agent for its type: `factory:tasks:<task>` (Agent tool). Each one defaults to the model and effort below (from the factory plugin's `models.json`).",
        "",
        renderRoutingTable(tasks),
        "",
        "These are defaults, not rules:",
        "- **Override** by passing `model` on the Agent call when a specific task clearly needs more or less than its type suggests (e.g. a small change in security-sensitive code → a stronger model; a large but mechanical change → a cheaper one). Say in one line which model you chose and why.",
        "- **The user's choice always wins**, including over this table.",
        "- If a task agent reports that its task is bigger or riskier than expected, hand it to a stronger model rather than retrying on the same one: `opus`, or `fable` when `opus` at high effort still falls short (ADR 0021).",
        "- Your own session model is the user's choice; don't change it.",
    ].join("\n");
}

/**
 * Reads and parses the plugin's `models.json`.
 *
 * @param options.signal - Cancels the read.
 * @returns The routes, by task type.
 * @throws Error listing every problem when `models.json` is invalid.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const routes = await readRoutes({ signal: AbortSignal.timeout(5_000) });
 *
 * expect(routes["checkup"]?.model).toBeDefined();
 * ```
 */
export async function readRoutes({ signal }: { readonly signal: AbortSignal }): Promise<Routes> {
    const parsed = parseRoutes(await readJson(MODELS_PATH, { signal }));

    if (parsed.kind === "invalid") {
        throw new Error(`models.json is invalid: ${parsed.errors.join("; ")}`);
    }

    return parsed.value;
}

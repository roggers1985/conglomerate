// Model routing (ADR 0014): which model and effort level to use for which kind of task.
//
//   bun models.ts table   print the routing table as markdown

import path from "node:path";

export const MODELS = ["opus", "sonnet", "haiku", "fable"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export type Model = (typeof MODELS)[number];
export type Effort = (typeof EFFORTS)[number];

export type TaskRoute = {
    readonly model: Model;
    readonly effort: Effort;
    readonly use: string;
};

export type Routes = Readonly<Record<string, TaskRoute>>;

export type ParsedRoutes =
    | { readonly kind: "valid"; readonly tasks: Routes }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

// The shape of T before validation: every field may be missing and has an unknown value.
type Unvalidated<T> = { readonly [K in keyof T]?: unknown };

type Rule = readonly [passes: boolean, message: string];

export const MODELS_PATH = path.resolve(import.meta.dir, "..", "models.json");

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isObject = <T>(value: unknown): value is Unvalidated<T> => typeof value === "object" && value !== null;

const isModel = (value: unknown): value is Model => MODELS.some((model) => model === value);
const isEffort = (value: unknown): value is Effort => EFFORTS.some((effort) => effort === value);

const failedRules = (rules: readonly Rule[]): string[] =>
    rules.filter(([passes]) => !passes).map(([, message]) => message);

function validateRoute(task: string, route: unknown): string[] {
    if (!isObject<TaskRoute>(route)) {
        return [`tasks.${task} must be an object`];
    }

    return failedRules([
        [KEBAB_CASE.test(task), `task "${task}" must be kebab-case`],
        [isModel(route.model), `tasks.${task}.model must be one of ${MODELS.join(", ")}`],
        [isEffort(route.effort), `tasks.${task}.effort must be one of ${EFFORTS.join(", ")}`],
        [typeof route.use === "string" && route.use.length > 0, `tasks.${task}.use is required`],
    ]);
}

const isTaskRoute = (route: unknown): route is TaskRoute => validateRoute("task", route).length === 0;

export function parseRoutes(value: unknown): ParsedRoutes {
    if (!isObject<{ tasks: unknown }>(value) || !isObject<Routes>(value.tasks)) {
        return { kind: "invalid", errors: ['must be an object with a "tasks" object'] };
    }

    const entries = Object.entries(value.tasks);
    const errors = entries.flatMap(([task, route]) => validateRoute(task, route));

    if (errors.length > 0) {
        return { kind: "invalid", errors };
    }

    return {
        kind: "valid",
        tasks: Object.fromEntries(
            entries.flatMap(([task, route]): [string, TaskRoute][] => (isTaskRoute(route) ? [[task, route]] : [])),
        ),
    };
}

export function renderRoutingTable(tasks: Routes): string {
    const rows = Object.entries(tasks).map(
        ([task, route]) => `| \`${task}\` | ${route.model} | ${route.effort} | ${route.use} |`,
    );

    return ["| Task | Model | Effort | Use for |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

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
        "- If a task agent reports that its task is bigger or riskier than expected, hand it to a stronger model rather than retrying on the same one.",
        "- Your own session model is the user's choice; don't change it.",
    ].join("\n");
}

export async function readRoutes(): Promise<Routes> {
    const parsed = parseRoutes(await Bun.file(MODELS_PATH).json());

    if (parsed.kind === "invalid") {
        throw new Error(`models.json is invalid: ${parsed.errors.join("; ")}`);
    }

    return parsed.tasks;
}

async function main(): Promise<void> {
    const [command] = Bun.argv.slice(2);

    if (command !== "table") {
        console.error("Usage: models.ts table");
        process.exitCode = 1;
        return;
    }

    console.log(renderRoutingTable(await readRoutes()));
}

if (import.meta.main) {
    await main();
}

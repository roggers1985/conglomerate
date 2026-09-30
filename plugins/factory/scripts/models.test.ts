import { describe, expect, it } from "bun:test";
import type { TaskRoute } from "./models.ts";
import { parseRoutes, readRoutes, renderRoutingTable } from "./models.ts";

const code: TaskRoute = { model: "sonnet", effort: "medium", use: "Everyday work" };

/** The paths of the fields that failed, so tests don't depend on the schema library's wording. */
const failedPaths = (parsed: ReturnType<typeof parseRoutes>): string[] =>
    parsed.kind === "invalid" ? parsed.errors.map((error) => error.split(": ")[0] ?? error) : [];

describe("parseRoutes", () => {
    it("accepts valid routes", () => {
        expect(parseRoutes({ tasks: { code } })).toEqual({ kind: "valid", value: { code } });
    });

    it("rejects a file without a tasks object, and unknown keys", () => {
        const parsed = parseRoutes({ routes: {} });
        const mentionsUnknownKey =
            parsed.kind === "invalid" && parsed.errors.some((error) => error.includes('"routes"'));

        expect(failedPaths(parsed)).toContain("tasks");
        expect(mentionsUnknownKey).toBe(true);
    });

    it("reports every invalid field of a task", () => {
        expect(failedPaths(parseRoutes({ tasks: { code: { model: "gpt-5", effort: "extreme" } } }))).toEqual([
            "tasks.code.model",
            "tasks.code.effort",
            "tasks.code.use",
        ]);
    });

    it("rejects task names that are not kebab-case", () => {
        // biome-ignore lint/style/useNamingConvention: an invalid task name is exactly what this test feeds in.
        expect(parseRoutes({ tasks: { Code: code } })).toEqual({
            kind: "invalid",
            errors: ["tasks.Code: task names must be kebab-case"],
        });
    });

    it("accepts 1 to 20 task types, and no fewer or more", () => {
        const tasks = (count: number) =>
            Object.fromEntries(Array.from({ length: count }, (_, index) => [`task-${index}`, code]));

        expect(parseRoutes({ tasks: tasks(1) }).kind).toBe("valid");
        expect(parseRoutes({ tasks: tasks(20) }).kind).toBe("valid");
        expect(parseRoutes({ tasks: tasks(0) })).toEqual({
            kind: "invalid",
            errors: ["tasks: must list at least one task type"],
        });
        expect(parseRoutes({ tasks: tasks(21) })).toEqual({
            kind: "invalid",
            errors: ["tasks: must list at most 20 task types"],
        });
    });

    it("accepts task names of up to 50 characters", () => {
        const name50 = "a".repeat(50);
        const name51 = "a".repeat(51);

        expect(parseRoutes({ tasks: { [name50]: code } }).kind).toBe("valid");
        expect(parseRoutes({ tasks: { [name51]: code } })).toEqual({
            kind: "invalid",
            errors: [`tasks.${name51}: task names must be at most 50 characters`],
        });
    });

    it("requires a description of what the task type is for, of up to 300 characters", () => {
        const withUse = (use: string) => parseRoutes({ tasks: { code: { ...code, use } } });

        expect(withUse("x".repeat(300)).kind).toBe("valid");
        expect(failedPaths(withUse("x".repeat(301)))).toEqual(["tasks.code.use"]);
        expect(failedPaths(withUse("  "))).toEqual(["tasks.code.use"]);
    });
});

describe("renderRoutingTable", () => {
    it("renders one row per task", () => {
        expect(renderRoutingTable({ code: { model: "sonnet", effort: "medium", use: "Everyday work" } })).toBe(
            "| Task | Model | Effort | Use for |\n| --- | --- | --- | --- |\n| `code` | sonnet | medium | Everyday work |",
        );
    });
});

describe("the plugin's models.json", () => {
    it("is valid", async () => {
        expect(Object.keys(await readRoutes({ signal: AbortSignal.timeout(5_000) }))).toContain("checkup");
    });

    it("stops reading when aborted", async () => {
        await expect(readRoutes({ signal: AbortSignal.abort() })).rejects.toMatchObject({ name: "AbortError" });
    });
});

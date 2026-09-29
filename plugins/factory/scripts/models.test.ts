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
        expect(parseRoutes({ tasks: { Code: code } })).toEqual({
            kind: "invalid",
            errors: ["tasks.Code: task names must be kebab-case"],
        });
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

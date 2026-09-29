import { describe, expect, it } from "bun:test";
import type { TaskRoute } from "./models.ts";
import { parseRoutes, readRoutes, renderRoutingTable } from "./models.ts";

const code: TaskRoute = { model: "sonnet", effort: "medium", use: "Everyday work" };

describe("parseRoutes", () => {
    it("accepts valid routes", () => {
        expect(parseRoutes({ tasks: { code } })).toEqual({ kind: "valid", tasks: { code } });
    });

    it("rejects a file without a tasks object", () => {
        expect(parseRoutes({ routes: {} })).toEqual({
            kind: "invalid",
            errors: ['must be an object with a "tasks" object'],
        });
    });

    it("reports unknown models, unknown effort levels and missing descriptions", () => {
        expect(parseRoutes({ tasks: { Code: { model: "gpt-5", effort: "extreme" } } })).toEqual({
            kind: "invalid",
            errors: [
                'task "Code" must be kebab-case',
                "tasks.Code.model must be one of opus, sonnet, haiku, fable",
                "tasks.Code.effort must be one of low, medium, high, xhigh, max",
                "tasks.Code.use is required",
            ],
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
        expect(Object.keys(await readRoutes())).toContain("checkup");
    });
});

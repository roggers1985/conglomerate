import { describe, expect, it } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import { formatPath, parse } from "./parse.ts";

describe("formatPath", () => {
    it("formats keys, indices and Standard Schema path segments", () => {
        expect(formatPath(["plugins", 2, { key: "source" }])).toBe("plugins[2].source");
    });

    it("formats a path that starts with an index", () => {
        expect(formatPath([0, "name"])).toBe("[0].name");
    });

    it("treats a missing path as the root", () => {
        expect(formatPath(undefined)).toBe("");
    });
});

describe("parse", () => {
    const Schedule = z.strictObject({ checkups: z.array(z.strictObject({ name: z.string().min(1) })) });

    it("returns the typed value when the data matches", () => {
        expect(parse(Schedule, { checkups: [{ name: "legal" }] })).toEqual({
            kind: "valid",
            value: { checkups: [{ name: "legal" }] },
        });
    });

    it("reports every issue with its path", () => {
        expect(parse(Schedule, { checkups: [{ name: "" }], extra: true })).toEqual({
            kind: "invalid",
            errors: [
                "checkups[0].name: Too small: expected string to have >=1 characters",
                'Unrecognized key: "extra"',
            ],
        });
    });

    it("refuses asynchronous schemas", () => {
        const asyncSchema: StandardSchemaV1<unknown, unknown> = {
            "~standard": { version: 1, vendor: "test", validate: async (value) => ({ value }) },
        };

        expect(() => parse(asyncSchema, 1)).toThrow("parse only supports synchronous schemas");
    });
});

import { describe, expect, it } from "bun:test";
import { parse } from "./parse.ts";
import { requiredText } from "./schemas.ts";

describe("requiredText", () => {
    const Text = requiredText({ maxLength: 5 });

    it("accepts text from 1 up to maxLength characters, unchanged", () => {
        expect(parse(Text, "a")).toEqual({ kind: "valid", value: "a" });
        expect(parse(Text, " abc ")).toEqual({ kind: "valid", value: " abc " });
    });

    it("refuses text one character over maxLength", () => {
        expect(parse(Text, "abcdef")).toEqual({ kind: "invalid", errors: ["must be at most 5 characters"] });
    });

    it("refuses empty and whitespace-only text", () => {
        expect(parse(Text, "")).toEqual({ kind: "invalid", errors: ["is required"] });
        expect(parse(Text, " \t\n")).toEqual({ kind: "invalid", errors: ["is required"] });
    });

    it("refuses a value that is not a string", () => {
        expect(parse(Text, 42).kind).toBe("invalid");
    });

    it("refuses a maxLength below 1 or not a whole number", () => {
        expect(() => requiredText({ maxLength: 0 })).toThrow("maxLength must be at least 1");
        expect(() => requiredText({ maxLength: 2.5 })).toThrow("maxLength must be an integer");
    });
});

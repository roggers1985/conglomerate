import { describe, expect, it } from "bun:test";
import { KEBAB_CASE } from "./kebab-case.ts";

describe("KEBAB_CASE", () => {
    it("matches kebab-case identifiers", () => {
        expect(KEBAB_CASE.test("code")).toBe(true);
        expect(KEBAB_CASE.test("code-react")).toBe(true);
        expect(KEBAB_CASE.test("code-react-19")).toBe(true);
    });

    it("rejects anything else", () => {
        expect(KEBAB_CASE.test("Code")).toBe(false);
        expect(KEBAB_CASE.test("code_react")).toBe(false);
        expect(KEBAB_CASE.test("code--react")).toBe(false);
        expect(KEBAB_CASE.test("-code")).toBe(false);
        expect(KEBAB_CASE.test("")).toBe(false);
    });
});

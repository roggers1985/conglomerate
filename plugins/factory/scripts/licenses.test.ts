import { describe, expect, it } from "bun:test";
import { isAllowedLicense } from "./licenses.ts";

describe("isAllowedLicense", () => {
    it("allows every permissive license on the list", () => {
        expect(
            ["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Unlicense", "CC0-1.0", "Zlib"].every(
                isAllowedLicense,
            ),
        ).toBe(true);
    });

    it("refuses copyleft, source-available, non-commercial and proprietary licenses", () => {
        const refused = [
            "GPL-3.0-only",
            "AGPL-3.0-or-later",
            "LGPL-2.1",
            "MPL-2.0",
            "BUSL-1.1",
            "SSPL-1.0",
            "Elastic-2.0",
            "CC-BY-NC-4.0",
            "UNLICENSED",
        ];

        expect(refused.filter(isAllowedLicense)).toEqual([]);
    });

    it("allows an OR expression when one option is allowed", () => {
        expect(isAllowedLicense("(MIT OR GPL-3.0-only)")).toBe(true);
    });

    it("requires every part of an AND expression to be allowed", () => {
        expect(isAllowedLicense("MIT AND Zlib")).toBe(true);
        expect(isAllowedLicense("MIT AND GPL-3.0-only")).toBe(false);
    });

    it("respects parentheses when combining OR and AND", () => {
        expect(isAllowedLicense("(MIT OR GPL-3.0-only) AND Apache-2.0")).toBe(true);
        expect(isAllowedLicense("(GPL-2.0-only OR GPL-3.0-only) AND MIT")).toBe(false);
    });

    it("refuses empty, unknown and absurdly long expressions", () => {
        expect(isAllowedLicense("")).toBe(false);
        expect(isAllowedLicense("SEE LICENSE IN LICENSE.md")).toBe(false);
        expect(isAllowedLicense(`MIT OR ${"x".repeat(300)}`)).toBe(false);
    });
});

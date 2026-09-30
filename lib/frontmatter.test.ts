import { describe, expect, it } from "bun:test";
import { parseFrontmatter } from "./frontmatter.ts";

describe("parseFrontmatter", () => {
    it("reads the YAML block at the top of a file", () => {
        expect(parseFrontmatter("---\nname: code-react\ndescription: React.\n---\n\n# Body")).toEqual({
            name: "code-react",
            description: "React.",
        });
    });

    it("reads nested maps", () => {
        expect(parseFrontmatter("---\nmetadata:\n  intervalDays: 30\n---\n")).toEqual({
            metadata: { intervalDays: 30 },
        });
    });

    it("returns null without a frontmatter block, or when the block isn't at the top", () => {
        expect(parseFrontmatter("# Just a heading")).toBeNull();
        expect(parseFrontmatter("# Heading\n---\nname: x\n---\n")).toBeNull();
    });

    it("throws a SyntaxError on invalid YAML", () => {
        expect(() => parseFrontmatter("---\ndescription: Go. Use when: writing Go.\n---\n")).toThrow(SyntaxError);
    });
});

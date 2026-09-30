import { describe, expect, it } from "bun:test";
import { resolveProjectDir } from "./project-dir.ts";

describe("resolveProjectDir", () => {
    it("prefers the argument over the environment and the current directory", () => {
        expect(resolveProjectDir({ argument: "/arg", envProjectDir: "/env", cwd: "/cwd" })).toBe("/arg");
    });

    it("falls back to CLAUDE_PROJECT_DIR without an argument", () => {
        expect(resolveProjectDir({ argument: undefined, envProjectDir: "/env", cwd: "/cwd" })).toBe("/env");
    });

    it("falls back to the current directory when neither is given or both are empty", () => {
        expect(resolveProjectDir({ argument: undefined, envProjectDir: undefined, cwd: "/cwd" })).toBe("/cwd");
        expect(resolveProjectDir({ argument: "", envProjectDir: "", cwd: "/cwd" })).toBe("/cwd");
    });
});

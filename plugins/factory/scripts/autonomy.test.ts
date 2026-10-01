import { describe, expect, it } from "bun:test";
import { readAutonomyRules, renderAutonomyContext } from "./autonomy.ts";
import type { AutonomyLevel } from "./settings.ts";
import { AUTONOMY_LEVELS, DEFAULT_SETTINGS } from "./settings.ts";

const signal = AbortSignal.timeout(5_000);

describe("readAutonomyRules", () => {
    it("has non-empty rules for every level", async () => {
        const rules = await Promise.all(
            AUTONOMY_LEVELS.map((level: AutonomyLevel) => readAutonomyRules(level, { signal })),
        );

        expect(rules.every((text: string) => text.trim().length > 0)).toBe(true);
    });
});

describe("renderAutonomyContext", () => {
    const withLevel = (autonomy: AutonomyLevel, own: boolean) => ({
        ...DEFAULT_SETTINGS,
        autonomy,
        own: new Set(own ? (["autonomy"] as const) : []),
    });

    it("names the level, where it comes from, and its rules", () => {
        expect(
            renderAutonomyContext({ kind: "project", settings: withLevel("trusted", true) }, { rules: "Rules.\n" }),
        ).toBe(
            "## Autonomy: trusted\n\nThis session runs at the `trusted` level (set in `.claude/factory.json`).\n\nRules.",
        );
    });

    it("says when the level is the default, also when the project's file only sets limits", () => {
        const defaultText = "(the default; a project sets its own in `.claude/factory.json`)";

        expect(renderAutonomyContext({ kind: "default", settings: DEFAULT_SETTINGS }, { rules: "Rules." })).toContain(
            defaultText,
        );
        expect(
            renderAutonomyContext({ kind: "project", settings: withLevel("guided", false) }, { rules: "Rules." }),
        ).toContain(defaultText);
    });

    it("lists the problems of an invalid settings file", () => {
        const section = renderAutonomyContext(
            {
                kind: "invalid",
                settings: DEFAULT_SETTINGS,
                errors: ["autonomy: must be one of guided, trusted, autonomous"],
            },
            { rules: "Rules." },
        );

        expect(section).toContain("(the default, because `.claude/factory.json` is invalid)");
        expect(section).toContain("- autonomy: must be one of guided, trusted, autonomous");
    });
});

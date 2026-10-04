import { describe, expect, it } from "bun:test";
import { findTestName } from "./test-name.ts";

const lines = (...text: string[]): string => text.join("\n");

describe("findTestName", () => {
    it("joins the names of nested describes and the test", () => {
        const source = lines(
            'describe("a", () => {',
            '    describe("b", () => {',
            '        it("c", () => {',
            "            work();",
            "        });",
            "    });",
            "});",
        );

        expect(findTestName(source, { line: 4, column: 13 })).toBe("a › b › c");
    });

    it("skips sibling tests and describes above, and finds the nearest test", () => {
        const source = lines(
            'describe("first", () => {',
            '    it("one", () => {',
            "        work();",
            "    });",
            "});",
            'describe("second", () => {',
            '    it("two", () => {',
            "        work();",
            "    });",
            '    test("three", () => {',
            "        work();",
            "    });",
            "});",
        );

        expect(findTestName(source, { line: 3, column: 9 })).toBe("first › one");
        expect(findTestName(source, { line: 8, column: 9 })).toBe("second › two");
        expect(findTestName(source, { line: 11, column: 9 })).toBe("second › three");
    });

    it("reads single, double and backtick quoted names, and escapes", () => {
        const source = lines(
            "it('single', () => {",
            "    work();",
            "});",
            'it("double", () => {',
            "    work();",
            "});",
            "it(`backtick`, () => {",
            "    work();",
            "});",
            'it("say \\"hi\\"", () => {',
            "    work();",
            "});",
        );

        expect(findTestName(source, { line: 2, column: 5 })).toBe("single");
        expect(findTestName(source, { line: 5, column: 5 })).toBe("double");
        expect(findTestName(source, { line: 8, column: 5 })).toBe("backtick");
        expect(findTestName(source, { line: 11, column: 5 })).toBe('say "hi"');
    });

    it("reports no name for a computed name", () => {
        const interpolated = lines(`it(\`runs $\{name}\`, () => {`, "    work();", "});");
        const concatenated = lines('it("runs " + name, () => {', "    work();", "});");
        const variable = lines("it(name, () => {", "    work();", "});");
        const computedSuite = lines(
            "describe(name, () => {",
            '    it("x", () => {',
            "        work();",
            "    });",
            "});",
        );

        expect(findTestName(interpolated, { line: 2, column: 5 })).toBeUndefined();
        expect(findTestName(concatenated, { line: 2, column: 5 })).toBeUndefined();
        expect(findTestName(variable, { line: 2, column: 5 })).toBeUndefined();
        expect(findTestName(computedSuite, { line: 3, column: 9 })).toBeUndefined();
    });

    it("reports no name for a line above any test, or in a suite but outside a test", () => {
        const source = lines('describe("a", () => {', "    setup();", '    it("b", () => {', "    });", "});");

        expect(findTestName(source, { line: 1, column: 1 })).toBeUndefined();
        expect(findTestName(source, { line: 2, column: 5 })).toBeUndefined();
        expect(findTestName("work();", { line: 1, column: 1 })).toBeUndefined();
        expect(findTestName("", { line: 5, column: 1 })).toBeUndefined();
    });

    it("sees through modifiers: only, skip, skipIf, each", () => {
        const source = lines(
            'it.only("only", () => {',
            "    work();",
            "});",
            'it.skipIf(isCi)("skipped on ci", () => {',
            "    work();",
            "});",
            'it.each(["a", "b"] as const)("each %s", (value) => {',
            "    work();",
            "});",
            'describe.skip("suite", () => {',
            '    test.concurrent("inner", () => {',
            "        work();",
            "    });",
            "});",
        );

        expect(findTestName(source, { line: 2, column: 5 })).toBe("only");
        expect(findTestName(source, { line: 5, column: 5 })).toBe("skipped on ci");
        expect(findTestName(source, { line: 8, column: 5 })).toBe("each %s");
        expect(findTestName(source, { line: 12, column: 9 })).toBe("suite › inner");
    });

    it("reads a name that Biome moved to the next line", () => {
        const source = lines("it(", '    "a long name",', "    async () => {", "        work();", "    },", ");");

        expect(findTestName(source, { line: 4, column: 9 })).toBe("a long name");
    });

    it("finds a test that starts on the same line, before the column", () => {
        const source = 'it("one liner", () => { work(); });';

        expect(findTestName(source, { line: 1, column: 25 })).toBe("one liner");
        expect(findTestName(source, { line: 1, column: 1 })).toBeUndefined();
    });

    it("handles a very long line in linear time, and a name that is too long", () => {
        const long = "x".repeat(200_000);
        const source = lines(
            'it("long line", () => {',
            `    work("${long}");`,
            "});",
            `it("${long}", () => {`,
            "    work();",
            "});",
        );
        const started = performance.now();

        expect(findTestName(source, { line: 2, column: 5 })).toBe("long line");
        expect(findTestName(source, { line: 5, column: 5 })).toBeUndefined();
        expect(findTestName(`it.skipIf(${"(".repeat(100_000)}`, { line: 1, column: 200_000 })).toBeUndefined();
        expect(performance.now() - started).toBeLessThan(1_000);
    });

    it("scans a bounded number of lines upward", () => {
        const source = lines('it("far", () => {', ...Array.from({ length: 2_500 }, () => "    work();"), "});");

        expect(findTestName(source, { line: 2_000, column: 5 })).toBe("far");
        expect(findTestName(source, { line: 2_400, column: 5 })).toBeUndefined();
    });

    it("rejects a position that is not a line and column", () => {
        expect(() => findTestName("", { line: 0, column: 1 })).toThrow("line must be");
        expect(() => findTestName("", { line: 1, column: 0 })).toThrow("column must be");
    });
});

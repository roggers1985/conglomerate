import { describe, expect, it } from "bun:test";
import { ConsoleCapture, expectConsole } from "./console-capture.ts";

describe("ConsoleCapture", () => {
    it("captures every printing console method, formatted like console does", () => {
        const capture = new ConsoleCapture();

        capture.start();
        console.log("a", 1);
        console.info("b %s", "c");
        console.warn({ d: 1 });
        console.error(new Error("e").message);
        console.debug();

        expect(capture.stop()).toEqual([
            "console.log: a 1",
            "console.info: b c",
            "console.warn: { d: 1 }",
            "console.error: e",
            "console.debug: ",
        ]);
    });

    it("restores the previous console methods on stop, and again after a second stop", () => {
        const capture = new ConsoleCapture();
        const before = console.warn;

        capture.start();
        capture.stop();
        capture.stop();

        expect(console.warn).toBe(before);
    });

    it("keeps the first originals when started twice", () => {
        const capture = new ConsoleCapture();
        const before = console.log;

        capture.start();
        capture.start();
        capture.stop();

        expect(console.log).toBe(before);
    });

    it("forgets captured calls after stop", () => {
        const capture = new ConsoleCapture();

        capture.start();
        console.log("once");
        capture.stop();
        capture.start();

        expect(capture.stop()).toEqual([]);
    });

    it("claims one call per expect, matching by substring or pattern", () => {
        const capture = new ConsoleCapture();

        capture.start();
        console.warn("same");
        console.warn("same");
        console.warn("other");
        capture.expect("warn", "same");
        capture.expect("warn", /^oth/);

        expect(capture.stop()).toEqual(["console.warn: same"]);
    });

    it("throws when nothing matches, listing what was captured", () => {
        const capture = new ConsoleCapture();

        capture.start();
        console.error("boom");

        expect(() => capture.expect("warn", "boom")).toThrow("expected console.warn matching boom");
        expect(() => capture.expect("error", /bang/)).toThrow('captured: ["console.error: boom"]');
        expect(capture.stop()).toEqual(["console.error: boom"]);
    });
});

describe("expectConsole", () => {
    it("claims output in a test, so the test stays clean", () => {
        console.warn("deprecated option:", "retries");
        console.error("failed");

        expectConsole("warn", "deprecated option: retries");
        expectConsole("error", /fail/);
    });
});

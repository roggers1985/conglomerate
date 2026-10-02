import path from "node:path";
import { format } from "node:util";

/** The `console` methods that print, and so are captured. */
export type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

const CONSOLE_METHODS: readonly ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

const ROOT = path.join(import.meta.dir, "..");
const SETUP_FILE = path.join(ROOT, "test", "setup.ts");

/** Stack frames to look through for a call site; deeper frames are ignored. */
const MAX_STACK_FRAMES = 50;
/** Characters of a message shown in a report; the rest is replaced by a count. */
const MAX_REPORTED_CHARACTERS = 300;

const FRAME = /^\s*at (?:.* \()?(.+?):(\d+):(\d+)\)?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

type CapturedCall = {
    readonly method: ConsoleMethod;
    readonly text: string;
    /** Where the code that logged is, as `file:line:column`; empty when no frame outside this file was found. */
    readonly site: string;
    /** The test file frame, when the logging code is not itself in a test file; empty otherwise. */
    readonly testSite: string;
};

const matches = (text: string, pattern: string | RegExp): boolean =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);

/** Reads the frames of a stack that are project code: not this file, the setup, `node_modules` or the runtime. */
function projectFrames(stack: string): { file: string; location: string }[] {
    const frames: { file: string; location: string }[] = [];

    for (const line of stack.split("\n").slice(0, MAX_STACK_FRAMES)) {
        const match = FRAME.exec(line);
        const file = match?.[1]?.replace(/^file:\/\//, "");

        if (match === null || file === undefined || !path.isAbsolute(file)) {
            continue;
        }

        const isIgnored =
            file === import.meta.path || file === SETUP_FILE || file.split(path.sep).includes("node_modules");

        if (!isIgnored) {
            const relative = path.relative(ROOT, file);
            const shown = relative.startsWith("..") ? file : relative;

            frames.push({ file, location: `${shown}:${match[2]}:${match[3]}` });
        }
    }

    return frames;
}

/** Captures where the running code is: the first project frame, and the first test file frame if it is another. */
function captureSites(): { site: string; testSite: string } {
    const previousLimit = Error.stackTraceLimit;

    Error.stackTraceLimit = MAX_STACK_FRAMES;

    const stack = new Error().stack ?? "";

    Error.stackTraceLimit = previousLimit;

    const frames = projectFrames(stack);
    const first = frames[0];
    const test = frames.find((frame) => TEST_FILE.test(frame.file));

    return {
        site: first?.location ?? "",
        testSite: test === undefined || test === first ? "" : test.location,
    };
}

/** One line for a captured call: `console.warn at lib/files.ts:120:9 (from test x.test.ts:3:5): "message"`. */
function describeCall(call: CapturedCall): string {
    const shortened =
        call.text.length > MAX_REPORTED_CHARACTERS
            ? `${call.text.slice(0, MAX_REPORTED_CHARACTERS)}… (${call.text.length - MAX_REPORTED_CHARACTERS} more characters)`
            : call.text;
    const where = call.site === "" ? "" : ` at ${call.site}`;
    const from = call.testSite === "" ? "" : ` (from test ${call.testSite})`;

    return `console.${call.method}${where}${from}: ${JSON.stringify(shortened)}`;
}

/**
 * Captures what code prints to `console` instead of letting it print, so a test can assert it (ADR 0059).
 *
 * @remarks
 * Between {@link ConsoleCapture.start} and {@link ConsoleCapture.stop} the `console` methods `log`, `info`, `warn`,
 * `error` and `debug` are replaced by recorders. A test claims the output it expects with {@link ConsoleCapture.expect};
 * `stop` returns whatever is left. The test setup (`test/setup.ts`) fails a test when that is not empty.
 *
 * @example
 * ```ts
 * const capture = new ConsoleCapture();
 *
 * capture.start();
 * console.warn("disk almost full:", 91);
 * capture.expect("warn", /disk almost full: 91/);
 *
 * expect(capture.stop()).toEqual([]);
 * ```
 *
 * @example
 * ```ts
 * const capture = new ConsoleCapture();
 *
 * capture.start();
 * console.log("left over");
 *
 * expect(capture.stop()[0]).toMatch(/^console\.log at .+:\d+:\d+: "left over"$/);
 * ```
 */
export class ConsoleCapture {
    #calls: CapturedCall[] = [];
    #originals: Partial<Record<ConsoleMethod, (...data: unknown[]) => void>> = {};

    /**
     * Starts capturing. Does nothing while already capturing.
     *
     * @example
     * ```ts
     * const capture = new ConsoleCapture();
     * const before = console.info;
     *
     * capture.start();
     * const isReplaced = console.info !== before;
     * capture.stop();
     *
     * expect(isReplaced).toBe(true);
     * expect(console.info).toBe(before);
     * ```
     */
    start(): void {
        const isCapturing = Object.keys(this.#originals).length > 0;

        if (isCapturing) {
            return;
        }

        for (const method of CONSOLE_METHODS) {
            this.#originals[method] = console[method];
            console[method] = (...data: unknown[]): void => {
                this.#calls.push({ method, text: format(...data), ...captureSites() });
            };
        }
    }

    /**
     * Claims one captured call, so it no longer counts as unexpected.
     *
     * @remarks
     * Call it after the code under test ran. It claims the first unclaimed call of that method whose text matches;
     * a second identical call needs a second `expect`.
     *
     * @param method - The `console` method that was expected to be called.
     * @param pattern - A substring or regular expression the formatted arguments must match.
     * @throws Error when no unclaimed call matches; the message lists what was captured.
     *
     * @example
     * ```ts
     * const capture = new ConsoleCapture();
     *
     * capture.start();
     * console.error("a");
     * console.error("a");
     * capture.expect("error", "a");
     *
     * expect(() => capture.expect("warn", "a")).toThrow("expected console.warn");
     * expect(capture.stop()).toHaveLength(1);
     * ```
     */
    expect(method: ConsoleMethod, pattern: string | RegExp): void {
        const index = this.#calls.findIndex((call) => call.method === method && matches(call.text, pattern));

        if (index === -1) {
            const captured = this.#calls.map(describeCall);

            throw new Error(
                `expected console.${method} matching ${String(pattern)}, captured: ${JSON.stringify(captured)}`,
            );
        }

        this.#calls.splice(index, 1);
    }

    /**
     * Stops capturing, puts the real `console` methods back and forgets the captured calls.
     *
     * @returns The calls nobody claimed with {@link ConsoleCapture.expect}, one line each, in call order:
     * `console.<method> at <file>:<line>:<column>: "<text>"`. The location is the first stack frame outside
     * `node_modules` and the capture itself, relative to the repository root, so it names the code that logged. When
     * that code is not a test file, `(from test <file>:<line>:<column>)` follows, naming the test file frame. Texts
     * longer than 300 characters are cut, with the number of omitted characters. Empty when the output was all
     * expected, or when capture was not started.
     *
     * @example
     * ```ts
     * const capture = new ConsoleCapture();
     *
     * expect(capture.stop()).toEqual([]);
     * ```
     */
    stop(): string[] {
        for (const method of CONSOLE_METHODS) {
            const original = this.#originals[method];

            if (original !== undefined) {
                console[method] = original;
            }
        }

        this.#originals = {};

        const unexpected = this.#calls.map(describeCall);

        this.#calls = [];

        return unexpected;
    }
}

/** The capture the test setup (`test/setup.ts`) runs around every test. */
export const consoleCapture = new ConsoleCapture();

/**
 * Declares that the running test expects this console output, so it does not fail the test.
 *
 * @remarks
 * For tests of code that deliberately prints. Call it after the code ran. Output a test did not claim fails it.
 *
 * @param method - The `console` method that was expected to be called.
 * @param pattern - A substring or regular expression the formatted arguments must match.
 * @throws Error when the code did not print a matching call.
 *
 * @example
 * ```ts
 * console.warn("config file missing, using defaults");
 *
 * expectConsole("warn", /config file missing/);
 * ```
 */
export function expectConsole(method: ConsoleMethod, pattern: string | RegExp): void {
    consoleCapture.expect(method, pattern);
}

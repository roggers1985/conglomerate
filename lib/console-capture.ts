import path from "node:path";
import { format } from "node:util";
import { readTextSync, TEXT_BYTES_MAX } from "./files.ts";
import { findTestName } from "./test-name.ts";

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

/** A stack frame of project code. */
type Frame = {
    readonly file: string;
    /** `file:line:column`, with the file relative to the repository root when it is inside it. */
    readonly location: string;
    readonly line: number;
    readonly column: number;
};

type CapturedCall = {
    readonly method: ConsoleMethod;
    readonly text: string;
    /** The code that logged: the first project frame; `undefined` when no frame outside this file was found. */
    readonly site: Frame | undefined;
    /** The test: the outermost frame in a test file, which is the test's own callback; `undefined` when there is none. */
    readonly test: Frame | undefined;
};

const matches = (text: string, pattern: string | RegExp): boolean =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);

/** Reads the frames of a stack that are project code: not this file, the setup, `node_modules` or the runtime. */
function projectFrames(stack: string): Frame[] {
    const frames: Frame[] = [];

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

            frames.push({
                file,
                location: `${shown}:${match[2]}:${match[3]}`,
                line: Number(match[2]),
                column: Number(match[3]),
            });
        }
    }

    return frames;
}

/** Captures where the running code is: the first project frame, and the outermost test file frame. */
function captureSites(): { site: Frame | undefined; test: Frame | undefined } {
    const previousLimit = Error.stackTraceLimit;

    Error.stackTraceLimit = MAX_STACK_FRAMES;

    const stack = new Error().stack ?? "";

    Error.stackTraceLimit = previousLimit;

    const frames = projectFrames(stack);

    return { site: frames[0], test: frames.findLast((frame) => TEST_FILE.test(frame.file)) };
}

/** The name of the test a frame is in, read from the test file's source; `undefined` when it cannot be found. */
function testNameAt(frame: Frame, sources: Map<string, string | undefined>): string | undefined {
    if (!sources.has(frame.file)) {
        try {
            sources.set(frame.file, readTextSync(frame.file, { maxBytes: TEXT_BYTES_MAX }));
        } catch {
            sources.set(frame.file, undefined);
        }
    }

    const source = sources.get(frame.file);

    return source === undefined ? undefined : findTestName(source, frame);
}

/**
 * One line for a captured call, always naming the test and its file:
 * `console.warn at lib/files.ts:120:9 in test "reads › a file" (x.test.ts:3:5): "message"`. The `at` part is left out
 * when the code that logged is the test's own frame.
 */
function describeCall(call: CapturedCall, sources: Map<string, string | undefined>): string {
    const shortened =
        call.text.length > MAX_REPORTED_CHARACTERS
            ? `${call.text.slice(0, MAX_REPORTED_CHARACTERS)}… (${call.text.length - MAX_REPORTED_CHARACTERS} more characters)`
            : call.text;
    const isInTest = call.test !== undefined && call.test === call.site;
    const where = call.site === undefined || isInTest ? "" : ` at ${call.site.location}`;
    const name = call.test === undefined ? undefined : testNameAt(call.test, sources);
    const quoted = name === undefined ? "<name not found>" : JSON.stringify(name);
    const file = call.test === undefined ? "no test file in the stack" : call.test.location;

    return `console.${call.method}${where} in test ${quoted} (${file}): ${JSON.stringify(shortened)}`;
}

/** One line for each captured call; each test file is read once. */
function describeCalls(calls: readonly CapturedCall[]): string[] {
    const sources = new Map<string, string | undefined>();

    return calls.map((call) => describeCall(call, sources));
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
 * expect(capture.stop()[0]).toMatch(/^console\.log in test .+ \(.+:\d+:\d+\): "left over"$/);
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
            const captured = describeCalls(this.#calls);

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
     * `console.<method> at <file>:<line>:<column> in test "<name>" (<test file>:<line>:<column>): "<text>"`. The `at`
     * location is the first stack frame outside `node_modules` and the capture itself, relative to the repository
     * root, so it names the code that logged; it is left out when that is the test's own frame. The test is the
     * outermost frame in a test file. Bun does not expose a test's name, so it is read from the test file's source
     * (suite names joined with ` › `); `<name not found>` when it is computed or the file cannot be read. Texts
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

        const unexpected = describeCalls(this.#calls);

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

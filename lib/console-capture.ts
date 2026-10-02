import { format } from "node:util";

/** The `console` methods that print, and so are captured. */
export type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

const CONSOLE_METHODS: readonly ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

type CapturedCall = { readonly method: ConsoleMethod; readonly text: string };

const matches = (text: string, pattern: string | RegExp): boolean =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);

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
 * expect(capture.stop()).toEqual(["console.log: left over"]);
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
                this.#calls.push({ method, text: format(...data) });
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
     * expect(capture.stop()).toEqual(["console.error: a"]);
     * ```
     */
    expect(method: ConsoleMethod, pattern: string | RegExp): void {
        const index = this.#calls.findIndex((call) => call.method === method && matches(call.text, pattern));

        if (index === -1) {
            const captured = this.#calls.map((call) => `console.${call.method}: ${call.text}`);

            throw new Error(
                `expected console.${method} matching ${String(pattern)}, captured: ${JSON.stringify(captured)}`,
            );
        }

        this.#calls.splice(index, 1);
    }

    /**
     * Stops capturing, puts the real `console` methods back and forgets the captured calls.
     *
     * @returns The calls nobody claimed with {@link ConsoleCapture.expect}, as `console.<method>: <text>`, in call
     * order. Empty when the output was all expected, or when capture was not started.
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

        const unexpected = this.#calls.map((call) => `console.${call.method}: ${call.text}`);

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

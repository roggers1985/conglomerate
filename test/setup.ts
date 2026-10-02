// Clean test output (ADR 0059): loaded before every test file through bunfig.toml.
//
// Around every test, the console is captured. Afterwards the test fails with whatever it printed that it did not
// claim with `expectConsole`. Unhandled rejections and uncaught exceptions need no code here: `bun test` fails the
// test they happen in (proved in `setup.test.ts`).

import { afterEach, beforeEach } from "bun:test";
import { consoleCapture } from "../lib/console-capture.ts";

beforeEach(() => {
    consoleCapture.start();
});

// Bun does not tell `afterEach` which test ran (`expect.getState()` does not exist in 1.4.2), so the failure names
// the call site instead; Bun's own `(fail) <test name>` line names the test.
const MAX_REPORTED_CALLS = 20;

afterEach(() => {
    const unexpected = consoleCapture.stop();

    if (unexpected.length > 0) {
        const shown = unexpected.slice(0, MAX_REPORTED_CALLS);
        const omitted = unexpected.length - shown.length;
        const more = omitted > 0 ? `\n… and ${omitted} more calls` : "";

        throw new Error(`Test output is not clean (ADR 0059):\n${shown.join("\n")}${more}`);
    }
});

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

afterEach(() => {
    const unexpected = consoleCapture.stop();

    if (unexpected.length > 0) {
        throw new Error(`Test output is not clean (ADR 0059):\n${unexpected.join("\n")}`);
    }
});

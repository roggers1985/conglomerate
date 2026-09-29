/**
 * Creates the top-level cancellation signal of a command-line program: aborted on Ctrl-C (`SIGINT`) or `SIGTERM`.
 *
 * @remarks
 * Signals are created at the edges only (ADR 0012); a CLI's `main` is such an edge. Once a listener is registered,
 * the process no longer exits on Ctrl-C by itself: the code that receives the signal must stop, which cancellable
 * code does by rejecting with an `AbortError`.
 *
 * @returns A signal that aborts with a `DOMException` named `AbortError` on the first interrupt.
 *
 * @example
 * ```ts no-run
 * // no-run: it registers process-wide signal handlers, which an example must not do to the test run.
 * async function main(): Promise<void> {
 *     const signal = interruptSignal();
 *
 *     await validateEverything({ signal });
 * }
 * ```
 */
export function interruptSignal(): AbortSignal {
    const controller = new AbortController();
    const abort = (): void => controller.abort(new DOMException("Interrupted", "AbortError"));

    process.once("SIGINT", abort);
    process.once("SIGTERM", abort);

    return controller.signal;
}

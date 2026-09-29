import { describe, expect, it } from "bun:test";
import path from "node:path";

describe("interruptSignal", () => {
    it("aborts a program's signal on SIGTERM, so cancellable work stops", async () => {
        const module = path.join(import.meta.dir, "interrupt.ts");
        const program = `
            const { interruptSignal } = await import(${JSON.stringify(module)});
            const signal = interruptSignal();
            signal.addEventListener("abort", () => { console.log("aborted:", signal.reason.name); process.exit(0); });
            console.log("ready");
            await new Promise(() => {});
        `;
        const child = Bun.spawn(["bun", "-e", program], { stdout: "pipe" });
        const reader = child.stdout.getReader();
        const decoder = new TextDecoder();
        const first = await reader.read();

        expect(decoder.decode(first.value)).toContain("ready");

        child.kill("SIGTERM");
        const rest = await reader.read();

        expect(decoder.decode(rest.value)).toContain("aborted: AbortError");
        expect(await child.exited).toBe(0);
    });
});

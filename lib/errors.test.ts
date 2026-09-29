import { describe, expect, it } from "bun:test";
import { isFileNotFound } from "./errors.ts";

describe("isFileNotFound", () => {
    it("recognises a missing file", async () => {
        const error = await Bun.file("/does/not/exist")
            .text()
            .catch((caught: unknown) => caught);

        expect(isFileNotFound(error)).toBe(true);
    });

    it("rejects other error codes and non-errors", () => {
        expect(isFileNotFound(Object.assign(new Error("denied"), { code: "EACCES" }))).toBe(false);
        expect(isFileNotFound({ code: "ENOENT" })).toBe(false);
    });
});

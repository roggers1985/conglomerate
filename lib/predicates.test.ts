import { describe, expect, it } from "bun:test";
import { isNil, isNotNil, isNull, isUndefined } from "./predicates.ts";

const values = [null, undefined, 0, "", false, Number.NaN, [], {}];

describe("predicates", () => {
    it("isNull only matches null", () => {
        expect(values.filter(isNull)).toEqual([null]);
    });

    it("isUndefined only matches undefined", () => {
        expect(values.filter(isUndefined)).toEqual([undefined]);
    });

    it("isNil matches null and undefined, and no falsy value", () => {
        expect(values.filter(isNil)).toEqual([null, undefined]);
    });

    it("isNotNil keeps every falsy value that is present", () => {
        expect(values.filter(isNotNil)).toEqual([0, "", false, Number.NaN, [], {}]);
    });
});

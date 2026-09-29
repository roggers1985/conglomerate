// License policy (ADR 0035): only permissive open-source licenses, for dependencies, tools and plugins alike.

/**
 * The permissive open-source licenses the owner allows, as SPDX identifiers. Everything else (copyleft,
 * source-available, non-commercial, proprietary, or unknown) is refused (ADR 0035).
 */
export const ALLOWED_LICENSES: ReadonlySet<string> = new Set([
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BlueOak-1.0.0",
    "CC0-1.0",
    "ISC",
    "MIT",
    "MIT-0",
    "Unlicense",
    "Zlib",
]);

const EXPRESSION_LENGTH_MAX = 200;
const DEPTH_MAX = 10; // nesting of parentheses; real expressions use one or two levels

function stripOuterParentheses(expression: string): string {
    const trimmed = expression.trim();
    const isWrapped = trimmed.startsWith("(") && trimmed.endsWith(")");

    return isWrapped ? trimmed.slice(1, -1).trim() : trimmed;
}

/** Splits on an operator at the top level only, so that `(A OR B) AND C` splits on `AND`, not inside the parentheses. */
function splitTopLevel(expression: string, operator: "OR" | "AND"): string[] {
    const tokens = expression.split(/(\(|\)|\s+)/).filter((token) => token.trim().length > 0);
    const parts: string[][] = [[]];
    let depth = 0;

    for (const token of tokens) {
        depth += token === "(" ? 1 : 0;
        depth -= token === ")" ? 1 : 0;

        if (token === operator && depth === 0) {
            parts.push([]);
            continue;
        }

        parts.at(-1)?.push(token);
    }

    return parts.map((part) => part.join(" ").replaceAll("( ", "(").replaceAll(" )", ")"));
}

function isAllowedAtDepth(expression: string, depth: number): boolean {
    if (depth > DEPTH_MAX) {
        return false;
    }

    const inner = stripOuterParentheses(expression);
    const alternatives = splitTopLevel(inner, "OR");

    if (alternatives.length > 1) {
        return alternatives.some((alternative) => isAllowedAtDepth(alternative, depth + 1));
    }

    const requirements = splitTopLevel(inner, "AND");

    if (requirements.length > 1) {
        return requirements.every((requirement) => isAllowedAtDepth(requirement, depth + 1));
    }

    return ALLOWED_LICENSES.has(inner);
}

/**
 * Decides whether a license, written as an SPDX expression, is allowed by the owner's policy.
 *
 * @remarks
 * `A OR B` is allowed when either side is (the user may choose); `A AND B` only when both are. Anything that isn't a
 * recognised SPDX identifier (e.g. `SEE LICENSE IN …`, `UNLICENSED`, a URL) is refused, so unknown licenses need a
 * human decision instead of slipping through.
 *
 * @param expression - The license, e.g. `MIT`, `Apache-2.0 OR MIT`, `(MIT AND Zlib)`.
 * @returns Whether it's allowed.
 *
 * @example
 * ```ts
 * expect(isAllowedLicense("MIT")).toBe(true);
 * expect(isAllowedLicense("Apache-2.0 OR MIT")).toBe(true);
 * expect(isAllowedLicense("GPL-3.0-only OR MIT")).toBe(true);
 * expect(isAllowedLicense("MIT AND GPL-3.0-only")).toBe(false);
 * expect(isAllowedLicense("BUSL-1.1")).toBe(false);
 * expect(isAllowedLicense("SEE LICENSE IN LICENSE.md")).toBe(false);
 * ```
 */
export function isAllowedLicense(expression: string): boolean {
    const isPlausible = expression.trim().length > 0 && expression.length <= EXPRESSION_LENGTH_MAX;

    return isPlausible && isAllowedAtDepth(expression, 0);
}

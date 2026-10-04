import { assert } from "./assert.ts";

/** Lines scanned upward from the given line; a test file with a deeper nesting than this reports no name. */
const MAX_LINES_SCANNED = 2_000;
/** Characters of a test or suite name read from the source; a longer literal counts as not found. */
const MAX_NAME_CHARACTERS = 300;
/** Characters scanned for the closing parenthesis of a modifier call such as `.skipIf(…)` or `.each(…)`. */
const MAX_MODIFIER_ARGUMENT_CHARACTERS = 200;
/** Modifiers (`.skipIf(…)`, `.only`, …) accepted between `it` and the call that holds the name. */
const MAX_MODIFIERS = 4;
/** What separates the names of the enclosing suites and the test. */
const SEPARATOR = " › ";

const QUOTES: ReadonlySet<string | undefined> = new Set(['"', "'", "`"]);
const WORD = /[A-Za-z_$][\w$]*/y;

type Call = {
    readonly kind: "test" | "suite";
    /** The name when it is a plain string literal; `undefined` when it is computed or cannot be read. */
    readonly name: string | undefined;
};

/** Reads the identifier that starts at `start`; empty when there is none. Sticky, so it never rescans. */
function readWord(text: string, start: number): string {
    WORD.lastIndex = start;

    return WORD.exec(text)?.[0] ?? "";
}

/** The number of leading spaces and tabs. */
function indentation(text: string): number {
    let count = 0;

    while (text[count] === " " || text[count] === "\t") {
        count += 1;
    }

    return count;
}

/** The index of the `)` that closes the `(` at `open`, looking at most {@link MAX_MODIFIER_ARGUMENT_CHARACTERS} on. */
function closingParenthesis(text: string, open: number): number | undefined {
    let depth = 0;
    const end = Math.min(text.length, open + MAX_MODIFIER_ARGUMENT_CHARACTERS);

    for (let index = open; index < end; index++) {
        depth += text[index] === "(" ? 1 : 0;
        depth -= text[index] === ")" ? 1 : 0;

        if (depth === 0) {
            return index;
        }
    }

    return undefined;
}

/** Reads up to the `quote` that closes a literal; `undefined` when it is too long, or a template with `${`. */
function readUntilQuote(text: string, start: number, quote: string): { value: string; end: number } | undefined {
    let value = "";
    const limit = Math.min(text.length, start + 1 + MAX_NAME_CHARACTERS);

    for (let index = start + 1; index < limit; index++) {
        const character = text[index] ?? "";
        const isInterpolation = quote === "`" && character === "$" && text[index + 1] === "{";

        if (isInterpolation) {
            return undefined;
        }

        if (character === quote) {
            return { value, end: index };
        }

        // A backslash takes the next character literally, so an escaped quote does not close the literal.
        index += character === "\\" ? 1 : 0;
        value += character === "\\" ? (text[index] ?? "") : character;
    }

    return undefined;
}

/**
 * Reads a string literal that starts at `start`: single, double or backtick quotes, the latter without `${`. It must
 * be the whole first argument, so `"a" + b` is not a literal.
 */
function readLiteral(text: string, start: number): string | undefined {
    const quote = text[start];

    if (quote === undefined || !QUOTES.has(quote)) {
        return undefined;
    }

    const literal = readUntilQuote(text, start, quote);
    const after =
        literal === undefined ? undefined : text.slice(literal.end + 1, literal.end + 1 + MAX_NAME_CHARACTERS);
    const next = after?.trimStart()[0];

    return next === "," || next === ")" ? literal?.value : undefined;
}

/** Skips the `.word` parts that start at `start` (`.only`, `.skipIf`, …); `undefined` when a `.` has no word. */
function skipDottedWords(text: string, start: number): number | undefined {
    let position = start;

    while (text[position] === ".") {
        const length = readWord(text, position + 1).length;

        if (length === 0) {
            return undefined;
        }

        position += 1 + length;
    }

    return position;
}

/**
 * Skips the modifiers after `it`, `test` or `describe` (`.only`, `.skipIf(…)`, `.each(…)`, …) and returns the index
 * of the `(` of the call that holds the name; `undefined` when something else follows.
 */
function skipModifiers(text: string, start: number): number | undefined {
    let position = skipDottedWords(text, start);
    const hasModifier = position !== start;

    for (let count = 0; count <= MAX_MODIFIERS && position !== undefined && text[position] === "("; count++) {
        const close = hasModifier ? closingParenthesis(text, position) : undefined;

        if (close === undefined || text[close + 1] !== "(") {
            return position;
        }

        position = close + 1;
    }

    return undefined;
}

/** What kind of call a function name is: a test, a suite, or neither. */
function callKind(word: string): Call["kind"] | undefined {
    if (word === "it" || word === "test") {
        return "test";
    }

    return word === "describe" ? "suite" : undefined;
}

/**
 * Reads a call to `it`, `test` or `describe`, with modifiers, that starts at `start` in `lines[index]`. The name may
 * sit on the next line when the call's `(` ends its line.
 */
function readCall(lines: readonly string[], index: number, start: number): Call | undefined {
    const text = lines[index] ?? "";
    const word = readWord(text, start);
    const kind = callKind(word);
    const open = kind === undefined ? undefined : skipModifiers(text, start + word.length);

    if (kind === undefined || open === undefined) {
        return undefined;
    }

    const rest = text.slice(open + 1).trimStart();
    const argument = rest === "" ? (lines[index + 1] ?? "").trimStart() : rest;

    return { kind, name: readLiteral(argument, 0) };
}

/**
 * The calls that enclose a position, nearest first: a call encloses it when it is shallower in indentation than
 * everything between it and the position.
 */
function enclosingCalls(lines: readonly string[], targetIndex: number, column: number): Call[] {
    const calls: Call[] = [];
    let shallowest = Number.POSITIVE_INFINITY;

    for (let index = targetIndex; index >= 0 && targetIndex - index < MAX_LINES_SCANNED; index--) {
        const text = lines[index] ?? "";
        const indent = indentation(text);

        if (indent === text.length) {
            continue;
        }

        // On the position's own line a call counts when it starts before the position.
        const isEnclosing = index === targetIndex ? indent < column - 1 : indent < shallowest;
        const call = isEnclosing ? readCall(lines, index, indent) : undefined;

        shallowest = Math.min(shallowest, indent);

        if (call !== undefined) {
            calls.push(call);
        }

        if (shallowest === 0) {
            break;
        }
    }

    return calls;
}

/**
 * Finds the name of the test that a source position is in, by reading the test file's source.
 *
 * @remarks
 * Bun does not tell a hook which test ran, so the name comes from the source: the nearest `it(` or `test(` above
 * the position whose indentation is shallower than the position's, with the `describe(` blocks around it, joined with
 * ` › `. Only a plain string literal (single, double or backtick quotes, no `${`) is a name; modifiers such as
 * `it.only(`, `it.skipIf(…)(` and `it.each(…)(` are skipped over, and `it.each` names keep their `%s` placeholders.
 * It relies on formatted code, where a block's contents are indented deeper than the call that opens it. At most 2000
 * lines are scanned upward, and no line is scanned more than once.
 *
 * @param source - The test file's text.
 * @param position.line - The line inside the test, counted from 1.
 * @param position.column - The column on that line, counted from 1; a test that starts on the same line only counts
 * when it starts before this column.
 * @returns The names, e.g. `parsing › reads a number`; `undefined` when the position is in no test, or a name is
 * computed or too long to read.
 *
 * @example
 * ```ts
 * const source = [
 *     'describe("parsing", () => {',
 *     '    describe(`numbers`, () => {',
 *     "        it('reads one', () => {",
 *     "            parse();",
 *     "        });",
 *     "    });",
 *     "});",
 * ].join("\n");
 *
 * expect(findTestName(source, { line: 4, column: 13 })).toBe("parsing › numbers › reads one");
 * expect(findTestName(source, { line: 1, column: 1 })).toBeUndefined();
 * ```
 */
export function findTestName(source: string, { line, column }: { line: number; column: number }): string | undefined {
    assert(Number.isInteger(line) && line >= 1, `line must be an integer of at least 1, got ${line}`);
    assert(Number.isInteger(column) && column >= 1, `column must be an integer of at least 1, got ${column}`);

    const [test, ...outer] = enclosingCalls(source.split("\n"), line - 1, column);
    const suites = outer.filter((call) => call.kind === "suite");
    const names = [...suites.reverse(), test].map((call) => call?.name);

    if (test?.kind !== "test" || names.includes(undefined)) {
        return undefined;
    }

    return names.join(SEPARATOR);
}

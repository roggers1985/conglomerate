const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

/**
 * Reads the YAML frontmatter block at the top of a markdown file.
 *
 * @param markdown - The file's contents.
 * @returns The parsed YAML (not yet validated), or `null` when the file doesn't start with a frontmatter block.
 * @throws SyntaxError when the frontmatter is not valid YAML.
 *
 * @example
 * ```ts
 * expect(parseFrontmatter("---\nname: code-react\n---\n# React")).toEqual({ name: "code-react" });
 * expect(parseFrontmatter("# No frontmatter")).toBeNull();
 * ```
 */
export function parseFrontmatter(markdown: string): unknown {
    const match = FRONTMATTER.exec(markdown);

    if (match === null) {
        return null;
    }

    return Bun.YAML.parse(match[1] ?? "");
}

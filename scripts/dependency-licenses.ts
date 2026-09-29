// Dependency licenses (ADR 0035): every installed package, including development tools, must have a permissive
// open-source license. Checked by `bun run validate`, so a new dependency with another license can't slip in.

import path from "node:path";
import { z } from "zod";
import { assert } from "../lib/assert.ts";
import { isFileNotFound } from "../lib/errors.ts";
import { readDirIfExists, readJson } from "../lib/files.ts";
import { parse } from "../lib/parse.ts";
import { isNotNil } from "../lib/predicates.ts";
import { isAllowedLicense } from "../plugins/factory/scripts/licenses.ts";

const NESTING_MAX = 5; // node_modules inside node_modules; package managers rarely nest more than two levels
const PACKAGES_MAX = 5_000; // far above this repository's few dozen; a sign something is wrong

// npm's package.json: someone else's format, so extra fields are allowed (ADR 0020).
const PackageJsonSchema = z.looseObject({
    name: z.string().min(1).max(214),
    version: z.string().min(1).max(100),
    // Old packages declare `{ "type": "MIT" }` or a `licenses` array; only an SPDX string counts as a license here.
    license: z.unknown(),
});

/** An installed package, as far as its license is concerned. */
export type InstalledPackage = {
    readonly name: string;
    readonly version: string;
    /** `null` when the package declares no license. */
    readonly license: string | null;
};

type Options = { readonly signal: AbortSignal };

/** The package.json of a folder, or `null` when the folder has none (e.g. a leftover empty folder). */
async function readManifest(dir: string, { signal }: Options): Promise<unknown> {
    try {
        return await readJson(path.join(dir, "package.json"), { signal });
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return null;
        }
        throw error;
    }
}

async function readPackage(dir: string, options: Options): Promise<InstalledPackage | null> {
    const json = await readManifest(dir, options);

    if (json === null) {
        return null;
    }

    const manifest = parse(PackageJsonSchema, json);

    if (manifest.kind === "invalid") {
        throw new Error(`${dir}/package.json: ${manifest.errors.join("; ")}`);
    }

    const { name, version, license } = manifest.value;
    const isSpdxString = typeof license === "string" && license.length > 0 && license.length <= 200;

    return { name, version, license: isSpdxString ? license : null };
}

/** The package folders directly inside a `node_modules` folder, including scoped ones (`@scope/name`). */
async function packageDirs(nodeModulesDir: string, options: Options): Promise<string[]> {
    const entries = (await readDirIfExists(nodeModulesDir, options)).filter((entry) => !entry.startsWith("."));
    const scoped = await Promise.all(
        entries
            .filter((entry) => entry.startsWith("@"))
            .map(async (scope) =>
                (await readDirIfExists(path.join(nodeModulesDir, scope), options)).map((name) =>
                    path.join(scope, name),
                ),
            ),
    );
    const unscoped = entries.filter((entry) => !entry.startsWith("@"));

    return [...unscoped, ...scoped.flat()].map((entry) => path.join(nodeModulesDir, entry));
}

async function collectPackages(nodeModulesDir: string, depth: number, options: Options): Promise<InstalledPackage[]> {
    assert(depth <= NESTING_MAX, `node_modules nested deeper than ${NESTING_MAX} levels at ${nodeModulesDir}`);

    const dirs = await packageDirs(nodeModulesDir, options);
    const packages = (await Promise.all(dirs.map((dir) => readPackage(dir, options)))).filter(isNotNil);
    const nested = await Promise.all(
        dirs.map((dir) => collectPackages(path.join(dir, "node_modules"), depth + 1, options)),
    );

    return [...packages, ...nested.flat()];
}

/**
 * Lists every package installed in a `node_modules` folder, including scoped and nested ones, once per name and
 * version.
 *
 * @param nodeModulesDir - The `node_modules` folder to scan.
 * @param options.signal - Cancels the reads.
 * @returns The installed packages, sorted by name; empty when the folder doesn't exist.
 * @throws Error (an `assert` invariant) when `node_modules` is nested deeper than 5 levels or holds more than
 * 5,000 packages.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const packages = await readInstalledPackages(`${process.cwd()}/node_modules`, { signal: AbortSignal.timeout(10_000) });
 *
 * expect(packages.find((installed) => installed.name === "zod")?.license).toBe("MIT");
 * ```
 */
export async function readInstalledPackages(nodeModulesDir: string, options: Options): Promise<InstalledPackage[]> {
    const packages = await collectPackages(nodeModulesDir, 0, options);
    const unique = new Map(packages.map((installed) => [`${installed.name}@${installed.version}`, installed]));

    assert(unique.size <= PACKAGES_MAX, `more than ${PACKAGES_MAX} installed packages`);

    return [...unique.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Lists the installed packages whose license the owner's policy doesn't allow (ADR 0035).
 *
 * @param packages - The installed packages.
 * @returns One problem per package without a license or with a license that isn't permissive open source.
 *
 * @example
 * ```ts
 * expect(
 *     licenseProblems([
 *         { name: "zod", version: "4.6.5", license: "MIT" },
 *         { name: "left-pad", version: "1.0.0", license: null },
 *         { name: "some-db", version: "2.0.0", license: "BUSL-1.1" },
 *     ]),
 * ).toEqual([
 *     "left-pad@1.0.0 declares no license",
 *     'some-db@2.0.0 has license "BUSL-1.1", which is not a permissive open-source license (ADR 0035)',
 * ]);
 * ```
 */
export function licenseProblems(packages: readonly InstalledPackage[]): string[] {
    return packages
        .map((installed) => {
            const id = `${installed.name}@${installed.version}`;

            if (installed.license === null) {
                return `${id} declares no license`;
            }

            if (isAllowedLicense(installed.license)) {
                return null;
            }

            return `${id} has license "${installed.license}", which is not a permissive open-source license (ADR 0035)`;
        })
        .filter(isNotNil);
}

// Dependency licenses (ADR 0035): every installed package, including development tools, must have a permissive
// open-source license. Checked by `bun run validate`, so a new dependency with another license can't slip in.

import path from "node:path";
import { z } from "zod";
import { assert } from "../lib/assert.ts";
import { mapConcurrent } from "../lib/concurrency.ts";
import { JSON_BYTES_MAX, readDir, readJson, whenMissing } from "../lib/files.ts";
import { parse } from "../lib/parse.ts";
import { isNotNil } from "../lib/predicates.ts";
import { isAllowedLicense } from "../plugins/factory/scripts/licenses.ts";

const NESTING_MAX = 5; // node_modules inside node_modules; package managers rarely nest more than two levels
const PACKAGES_MAX = 5_000; // far above this repository's few dozen; a sign something is wrong
const READS_IN_FLIGHT_MAX = 16; // enough to keep the disk busy without thousands of open files

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

async function readPackage(dir: string, options: Options): Promise<InstalledPackage | null> {
    const json = await readJson(path.join(dir, "package.json"), { ...options, maxBytes: JSON_BYTES_MAX }).catch(
        // A folder without a package.json, e.g. a leftover empty folder, holds no package.
        whenMissing(null),
    );

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
async function packageDirs(nodeModulesDir: string, { signal }: Options): Promise<string[]> {
    const list = async (dir: string): Promise<string[]> => {
        const entries = await readDir(dir, { maxEntries: PACKAGES_MAX, signal }).catch(whenMissing([]));

        return entries.map((entry) => entry.name).filter((name) => !name.startsWith("."));
    };
    const names = await list(nodeModulesDir);
    const scopes = names.filter((name) => name.startsWith("@"));
    const unscoped = names.filter((name) => !name.startsWith("@"));
    const scoped = await mapConcurrent(
        scopes,
        async (scope) => (await list(path.join(nodeModulesDir, scope))).map((name) => path.join(scope, name)),
        { concurrency: READS_IN_FLIGHT_MAX, signal },
    );

    return [...unscoped, ...scoped.flat()].map((name) => path.join(nodeModulesDir, name));
}

/** Every package folder in `node_modules` and the `node_modules` folders nested in it, one level at a time. */
async function findPackageDirs(nodeModulesDir: string, options: Options): Promise<string[]> {
    const found: string[] = [];
    let level = [nodeModulesDir];

    // Bounded by NESTING_MAX: each round goes one level deeper, and packages found too deep fail the assert.
    for (let depth = 0; level.length > 0; depth += 1) {
        const dirs = (
            await mapConcurrent(level, (dir) => packageDirs(dir, options), {
                concurrency: READS_IN_FLIGHT_MAX,
                signal: options.signal,
            })
        ).flat();
        const hasPackagesTooDeep = depth > NESTING_MAX && dirs.length > 0;

        assert(!hasPackagesTooDeep, `node_modules nested deeper than ${NESTING_MAX} levels in ${nodeModulesDir}`);
        found.push(...dirs);
        assert(found.length <= PACKAGES_MAX, `more than ${PACKAGES_MAX} installed packages in ${nodeModulesDir}`);
        level = dirs.map((dir) => path.join(dir, "node_modules"));
    }

    return found;
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
    const dirs = await findPackageDirs(nodeModulesDir, options);
    const packages = await mapConcurrent(dirs, (dir) => readPackage(dir, options), {
        concurrency: READS_IN_FLIGHT_MAX,
        signal: options.signal,
    });
    const unique = new Map(
        packages.filter(isNotNil).map((installed) => [`${installed.name}@${installed.version}`, installed]),
    );

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

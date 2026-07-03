/**
 * Specification tests for the RD-15 `DiskCompilerHost` — ST-2..ST-4.
 *
 * Derived EXCLUSIVELY from RD-15 R12/R14/R47, RD-13 R37, and the plan
 * (03-01-compiler-host.md, AR-V3/V6). Immutable oracles:
 *   ST-2 — `readFile` returns content / `undefined` (never throws).
 *   ST-3 — `listSourceFiles()` expands `include` minus `exclude`, absolute + sorted.
 *   ST-4 — a `../`-escaping include pattern must not leak files outside `projectRoot`.
 *
 * The host IS the filesystem boundary, so these run against real temp dirs.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDiskCompilerHost } from "./disk-host.js";

let root: string;
let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "b65-disk-host-"));
  root = join(scratch, "proj");
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("Specification: DiskCompilerHost readFile (ST-2)", () => {
  it("returns file content for an existing file and undefined for a missing one, never throwing (ST-2)", () => {
    writeFileSync(join(root, "a.blend"), "module A;", "utf8");
    const host = createDiskCompilerHost({ projectRoot: root, include: ["**/*.blend"], exclude: [] });

    expect(host.readFile(join(root, "a.blend"))).toBe("module A;");
    expect(host.readFile(join(root, "nope.blend"))).toBeUndefined();
  });
});

describe("Specification: DiskCompilerHost listSourceFiles (ST-3)", () => {
  it("expands include minus exclude, returning absolute paths in lexicographic order (ST-3)", () => {
    writeFileSync(join(root, "b.blend"), "module B;", "utf8");
    writeFileSync(join(root, "a.blend"), "module A;", "utf8");
    mkdirSync(join(root, "sub"), { recursive: true });
    writeFileSync(join(root, "sub", "c.blend"), "module C;", "utf8");
    mkdirSync(join(root, "skip"), { recursive: true });
    writeFileSync(join(root, "skip", "d.blend"), "module D;", "utf8");

    const host = createDiskCompilerHost({
      projectRoot: root,
      include: ["**/*.blend"],
      exclude: ["skip/**"],
    });

    expect(host.listSourceFiles()).toEqual([
      resolve(root, "a.blend"),
      resolve(root, "b.blend"),
      resolve(root, "sub", "c.blend"),
    ]);
  });
});

describe("Specification: DiskCompilerHost containment (ST-4)", () => {
  it("does not leak files outside projectRoot even with a ../-escaping include pattern (ST-4)", () => {
    const outside = join(scratch, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "secret.blend"), "module Secret;", "utf8");
    // A legitimate in-root file so the discovery is non-trivial.
    writeFileSync(join(root, "ok.blend"), "module Ok;", "utf8");

    const host = createDiskCompilerHost({
      projectRoot: root,
      include: ["../outside/**/*.blend", "**/*.blend"],
      exclude: [],
    });

    const files = host.listSourceFiles();
    expect(files).not.toContain(resolve(outside, "secret.blend"));
    expect(files.every((f) => f.startsWith(resolve(root)))).toBe(true);
  });
});

/**
 * Implementation tests for {@link createDiskCompilerHost} — edge cases beyond the
 * spec-level oracles: nested excludes, empty include, tinyglobby dotfile
 * defaults, and the TOCTOU read path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDiskCompilerHost } from "./disk-host.js";

let root: string;
let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "b65-disk-host-impl-"));
  root = join(scratch, "proj");
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function write(rel: string, content = "module M;"): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

describe("DiskCompilerHost: nested excludes", () => {
  it("excludes files matched by a deeply-nested exclude glob", () => {
    write("a.blend");
    write("gen/deep/x.blend");
    write("gen/deep/y.blend");
    write("keep/z.blend");

    const host = createDiskCompilerHost({
      projectRoot: root,
      include: ["**/*.blend"],
      exclude: ["gen/**"],
    });

    expect(host.listSourceFiles()).toEqual([
      resolve(root, "a.blend"),
      resolve(root, "keep", "z.blend"),
    ]);
  });
});

describe("DiskCompilerHost: empty include", () => {
  it("returns an empty list when include has no patterns", () => {
    write("a.blend");
    const host = createDiskCompilerHost({ projectRoot: root, include: [], exclude: [] });
    expect(host.listSourceFiles()).toEqual([]);
  });
});

describe("DiskCompilerHost: dotfile semantics", () => {
  it("does not match dotfiles under the default tinyglobby behavior", () => {
    write("visible.blend");
    write(".hidden.blend");
    write(".secret/nested.blend");

    const host = createDiskCompilerHost({
      projectRoot: root,
      include: ["**/*.blend"],
      exclude: [],
    });

    expect(host.listSourceFiles()).toEqual([resolve(root, "visible.blend")]);
  });
});

describe("DiskCompilerHost: readFile TOCTOU", () => {
  it("returns undefined for a path that does not exist (never throws)", () => {
    const host = createDiskCompilerHost({ projectRoot: root, include: ["**/*.blend"], exclude: [] });
    expect(host.readFile(join(root, "vanished.blend"))).toBeUndefined();
  });

  it("returns undefined when the path is a directory (fs error swallowed)", () => {
    mkdirSync(join(root, "adir"), { recursive: true });
    const host = createDiskCompilerHost({ projectRoot: root, include: ["**/*.blend"], exclude: [] });
    expect(host.readFile(join(root, "adir"))).toBeUndefined();
  });
});

describe("DiskCompilerHost: resolvePath", () => {
  it("resolves a relative path against projectRoot", () => {
    const host = createDiskCompilerHost({ projectRoot: root, include: [], exclude: [] });
    expect(host.resolvePath("main.blend")).toBe(resolve(root, "main.blend"));
  });
});

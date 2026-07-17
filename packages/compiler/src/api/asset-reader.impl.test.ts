/**
 * Implementation tests for the disk asset reader: byte identity, the
 * stat-before-read size cap, and lexical + canonical (symlink-aware)
 * project-root containment — all against the real filesystem in a temp
 * tree.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import { createDiskAssetReader } from "./asset-reader.js";
import type { AssetReader } from "@blend65/core";

let base: string;
let projectRoot: string;
let sourcePath: string;
let reader: AssetReader;

const SRC_ID = 1;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "blend65-asset-"));
  projectRoot = join(base, "proj");
  mkdirSync(join(projectRoot, "src"), { recursive: true });
  sourcePath = join(projectRoot, "src", "main.blend");
  writeFileSync(sourcePath, "module Main;\n");
  reader = createDiskAssetReader({
    sources: new Map([[SRC_ID, sourcePath]]),
    projectRoot,
  });
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("disk asset reader — bytes", () => {
  it("returns high-bit and NUL bytes identically (no text decoding)", () => {
    const bytes = Uint8Array.from([0x00, 0x41, 0x80, 0xff, 0x0d, 0x0a]);
    writeFileSync(join(projectRoot, "src", "raw.bin"), bytes);

    const result = reader.readAsset(SRC_ID, "raw.bin");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(Array.from(result.bytes)).toEqual(Array.from(bytes));
      expect(result.resolvedPath).toBe(realpathSync(join(projectRoot, "src", "raw.bin")));
    }
  });

  it("resolves relative to the CALLING source file's directory", () => {
    writeFileSync(join(projectRoot, "top.bin"), Uint8Array.from([1]));
    // The source lives in src/, so the asset one level up needs `..` —
    // legal as long as it stays inside the project root.
    const result = reader.readAsset(SRC_ID, "../top.bin");
    expect(result.kind).toBe("ok");
  });
});

describe("disk asset reader — size cap", () => {
  it("rejects an oversized file by stat, before any read", () => {
    const big = join(projectRoot, "src", "big.bin");
    writeFileSync(big, new Uint8Array(65537));
    // Remove read permission: a read attempt would fail as not-found, so
    // getting too-large proves the cap fired on stat alone.
    chmodSync(big, 0o000);

    const result = reader.readAsset(SRC_ID, "big.bin");
    expect(result).toEqual({ kind: "too-large", size: 65537 });
    chmodSync(big, 0o644);
  });

  it("accepts a file of exactly the cap size", () => {
    writeFileSync(join(projectRoot, "src", "max.bin"), new Uint8Array(65536));
    expect(reader.readAsset(SRC_ID, "max.bin").kind).toBe("ok");
  });
});

describe("disk asset reader — containment", () => {
  it("rejects a traversal escape whether or not the target exists", () => {
    // No ../../outside.bin exists anywhere — the lexical check needs no
    // filesystem access, so the rejection must still be outside-root.
    expect(reader.readAsset(SRC_ID, "../../outside.bin")).toEqual({
      kind: "outside-root",
    });
  });

  it("rejects an inside-the-project symlink that points outside it", () => {
    writeFileSync(join(base, "secret.bin"), Uint8Array.from([7]));
    symlinkSync(join(base, "secret.bin"), join(projectRoot, "src", "link.bin"));

    expect(reader.readAsset(SRC_ID, "link.bin")).toEqual({ kind: "outside-root" });
  });

  it("rejects absolute and escape-bearing path literals as invalid", () => {
    expect(reader.readAsset(SRC_ID, "/etc/hostname").kind).toBe("not-found");
    expect(reader.readAsset(SRC_ID, "a\\x2Eb.bin").kind).toBe("not-found");
    expect(reader.readAsset(SRC_ID, "").kind).toBe("not-found");
  });

  it("reports an unknown source id as not-found", () => {
    expect(reader.readAsset(999, "raw.bin").kind).toBe("not-found");
  });

  it("reports a genuinely missing in-root file as not-found", () => {
    expect(reader.readAsset(SRC_ID, "nope.bin").kind).toBe("not-found");
  });
});

/**
 * Implementation tests for `build()` edges: outName derivation, binary
 * read-back on failure/over-budget, and report absence on a pre-emit abort.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { build } from "./build.js";
import { fakeBuildDeps, GATE_SRC, memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-build-impl-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("build(): outName derivation", () => {
  it("uses an explicit outName verbatim", async () => {
    const result = await build(
      { platform: "c64", cwd, outName: "custom", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
      fakeBuildDeps(),
    );
    expect(result.config.outName).toBe("custom");
  });

  it("derives outName from the explicit file basename minus extension", async () => {
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["zed.blend"] },
      memHost({ "zed.blend": GATE_SRC }),
      fakeBuildDeps(),
    );
    expect(result.config.outName).toBe("zed");
  });

  it("derives outName from the lexicographically-first discovered file", async () => {
    // No sourceFiles → discovery order; derivation ignores compile errors.
    const result = await build(
      { platform: "c64", cwd },
      memHost({ "b.blend": "module B;\n", "a.blend": "module A;\n" }),
      fakeBuildDeps(),
    );
    expect(result.config.outName).toBe("a");
  });
});

describe("build(): binary read-back", () => {
  it("does not read back a binary on ACME failure but retains the .asm", async () => {
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
      fakeBuildDeps({ acmeSuccess: false }),
    );

    expect(result.binary).toBeUndefined();
    expect(result.binaryPath).toBeUndefined();
    expect(result.asmPath).toBeDefined(); // retained on failure
    expect(result.hasErrors).toBe(true);
  });

  it("still reads back the binary when over budget (artifact exists, AR-V5)", async () => {
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
      fakeBuildDeps({ binarySize: 30000 }),
    );

    expect(result.binary).toBeInstanceOf(Uint8Array);
    expect(result.diagnostics.some((d) => d.code === DiagCode.BinaryTooLarge)).toBe(true);
    expect(result.hasErrors).toBe(true);
  });
});

describe("build(): report absence on pre-emit abort", () => {
  it("returns no resourceReport, binary, or asmText for an unknown platform", async () => {
    const result = await build({ platform: "nope", cwd }, undefined, fakeBuildDeps());

    expect(result.resourceReport).toBeUndefined();
    expect(result.binary).toBeUndefined();
    expect(result.asmText).toBeUndefined();
  });
});

/**
 * Specification tests for facade file-discovery errors.
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: a missing explicit file emits `E10250`
 * (`Source file not found: '<path>'`), and an empty discovery set emits `E10251`
 * (`No .blend source files found (project root: '<root>')`). Both abort before
 * lexing (no other diagnostics), null span.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { compile } from "./compile.js";
import { memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  // A hermetic empty project dir — no blend65.json → clean config defaults.
  cwd = mkdtempSync(join(tmpdir(), "b65-discovery-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: explicit missing source file → E10250 (ST-5)", () => {
  it("emits E10250 with a null span and the given path, and does not lex (ST-5)", () => {
    const result = compile({ platform: "c64", cwd, sourceFiles: ["missing.blend"] }, memHost({}));

    const errors = result.diagnostics;
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe(DiagCode.DriverSourceFileNotFound);
    expect(errors[0]!.severity).toBe("error");
    expect(errors[0]!.primarySpan).toBeNull();
    expect(errors[0]!.message).toBe("Source file not found: 'missing.blend'");
    expect(result.hasErrors).toBe(true);
  });
});

describe("Specification: empty discovery set → E10251 (ST-6)", () => {
  it("emits E10251 naming the project root when discovery yields no files (ST-6)", () => {
    // No injected host and no sourceFiles → the facade builds a disk host over the
    // empty temp project, whose listSourceFiles() returns [].
    const result = compile({ platform: "c64", cwd });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.code).toBe(DiagCode.DriverNoSourceFiles);
    expect(result.diagnostics[0]!.message).toBe(
      `No .blend source files found (project root: '${result.config.projectRoot}')`,
    );
    expect(result.hasErrors).toBe(true);
  });
});

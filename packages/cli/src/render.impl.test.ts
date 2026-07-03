/**
 * Implementation tests for `render.ts` (03-03 "Testing Requirements"): the trailer
 * pluralization matrix, the color matrix, and the artifact write-failure path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceMap, type Diagnostic } from "@blend65/core";
import { renderDiagnostics, writeTextArtifact } from "./render.js";
import { fakeIo } from "./test-fixtures.js";

/** A minimal span-less diagnostic of the given severity. */
function diag(severity: "error" | "warning", code: string): Diagnostic {
  return { code, severity, message: "x", primarySpan: null, secondarySpans: [], notes: [] };
}

/** Render `diagnostics` (terminal, no color) and return the stderr trailer line. */
function trailerOf(diagnostics: Diagnostic[]): string {
  const io = fakeIo();
  renderDiagnostics(io, diagnostics, createSourceMap(), "terminal", false);
  const lines = io.err.trimEnd().split("\n");
  return lines[lines.length - 1] ?? "";
}

describe("render: trailer pluralization matrix", () => {
  it("1 error → singular", () => {
    expect(trailerOf([diag("error", "E10001")])).toBe("error: 1 error emitted");
  });

  it("2 errors → plural", () => {
    expect(trailerOf([diag("error", "E10001"), diag("error", "E10002")])).toBe(
      "error: 2 errors emitted",
    );
  });

  it("2 errors + 1 warning → both clauses", () => {
    expect(
      trailerOf([diag("error", "E10001"), diag("error", "E10002"), diag("warning", "W10191")]),
    ).toBe("error: 2 errors, 1 warning emitted");
  });

  it("1 warning only → warning trailer", () => {
    expect(trailerOf([diag("warning", "W10191")])).toBe("warning: 1 warning emitted");
  });

  it("2 warnings only → plural warning trailer", () => {
    expect(trailerOf([diag("warning", "W10191"), diag("warning", "W10210")])).toBe(
      "warning: 2 warnings emitted",
    );
  });

  it("no diagnostics → no trailer written", () => {
    const io = fakeIo();
    renderDiagnostics(io, [], createSourceMap(), "terminal", false);
    expect(io.err).toBe("");
  });
});

describe("render: color matrix", () => {
  const SGR = /\x1b\[/;

  it("paints the trailer severity word when color is on", () => {
    const io = fakeIo();
    renderDiagnostics(io, [diag("error", "E10001")], createSourceMap(), "terminal", true);
    expect(SGR.test(io.err)).toBe(true);
  });

  it("emits no SGR when color is off", () => {
    const io = fakeIo();
    renderDiagnostics(io, [diag("error", "E10001")], createSourceMap(), "terminal", false);
    expect(SGR.test(io.err)).toBe(false);
  });

  it("emits no trailer and no SGR in JSON format", () => {
    const io = fakeIo();
    renderDiagnostics(io, [diag("error", "E10001")], createSourceMap(), "json", true);
    expect(io.err).not.toContain("error: 1 error emitted");
    expect(SGR.test(io.err)).toBe(false);
  });
});

describe("render: artifact write-failure path", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "b65-render-impl-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws when the output dir cannot be created (a file blocks the path)", () => {
    // Plant a regular file, then try to write under it → ENOTDIR from mkdirSync.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "x", "utf8");
    expect(() => writeTextArtifact(join(blocker, "sub"), "out.asm", "; asm")).toThrow();
  });

  it("writes the artifact and returns its path on success", () => {
    const path = writeTextArtifact(join(dir, "out"), "main.asm", "; asm\n");
    expect(path).toBe(join(dir, "out", "main.asm"));
  });
});

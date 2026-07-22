/**
 * Emit-tier specification tests for the width check on `poke`'s value
 * operand.
 *
 * `poke` stores exactly one byte. When the value is wider than a byte the
 * frontend must reject the program, and a frontend error blocks ALL code
 * emission — so the dangerous second store (the one that would clobber the
 * neighbouring hardware register) never comes into existence in any
 * emitted assembly. The byte-valued control pins what a correct poke
 * emits: exactly one store to the target address and nothing to its
 * neighbour.
 *
 * Runs `emitAsm` only (no assembler, no emulator), so the suite is
 * CI-safe ungated.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitAsm, type EmitResult } from "@blend65/compiler";

/** Stages `source` as `main.blend` in a fresh temp dir and emits its ACME text. */
function emitSource(source: string): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-poke-width-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("Specification: poke width check at the emit boundary", () => {
  it("should emit no assembly at all when the poke value is a word", () => {
    const result = emitSource(
      `module Main;\nfunction main(): void { let w: word = 300; poke($D020, w); }\n`,
    );
    // The wide poke is a compile error, and an erroring program yields no
    // emitted text — the two-byte store never exists anywhere downstream.
    expect(result.hasErrors).toBe(true);
    expect(result.text).toBeUndefined();
  });

  it("should emit exactly one store to the target and none to its neighbour when the poke value is a byte", () => {
    const result = emitSource(
      `module Main;\nfunction main(): void { let b: byte = 7; poke($D020, b); }\n`,
    );
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    const text = result.text ?? "";
    // A one-byte poke is a single STA to the literal address — no high-byte
    // companion store spilling into the neighbouring register.
    expect(text.match(/STA \$D020/g) ?? []).toHaveLength(1);
    expect(text).not.toContain("STX $D020+1");
    expect(text).not.toContain("STX $D021");
  });
});

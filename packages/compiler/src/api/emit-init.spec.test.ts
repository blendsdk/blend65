/**
 * Specification tests for module-initializer emission through `emitAsm` — a
 * program with module initializers serializes a generated init routine FIRST
 * (before the entry function) and the startup shim calls it after banking and
 * before the entry call (initializers run once, before `main`, in the same
 * memory configuration — frozen spec Ch 10 §5.4); an initializer-free program
 * emits neither the routine nor the call, byte-identical to today's output.
 * Word initializers store little-endian through the split store; a module
 * const is a compile-time value inlined at its use site — it owns NO storage
 * symbol of any kind.
 *
 * Expectations derive from the frozen spec Ch 03/Ch 10 — never from the
 * implementation. Exercised through the real public facade (`emitAsm`).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitAsm } from "./emit.js";
import { memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-emit-init-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

/** Runs `emitAsm` over one `main.blend` source and returns the ACME text. */
function asmOf(source: string): string {
  const result = emitAsm(
    { platform: "c64", cwd, sourceFiles: ["main.blend"] },
    memHost({ "main.blend": source }),
  );
  if (result.text === undefined) throw new Error("emitAsm produced no text");
  return result.text;
}

const WITH_INIT =
  "module Main;\n" + "let g: byte = 7;\n" + "function main(): void { poke($C000, g); }\n";

const WITHOUT_INIT =
  "module Main;\n" + "let g: byte;\n" + "function main(): void { poke($C000, g); }\n";

describe("Specification: init routine emission and startup wiring", () => {
  it("should serialize the init routine first and call it between banking and the entry call", () => {
    const text = asmOf(WITH_INIT);

    // The generated routine exists and is serialized BEFORE the entry function.
    const initLabel = text.indexOf("__init:");
    const mainLabel = text.indexOf("_main:");
    expect(initLabel).toBeGreaterThanOrEqual(0);
    expect(mainLabel).toBeGreaterThanOrEqual(0);
    expect(initLabel).toBeLessThan(mainLabel);

    // The shim calls it after banking and before the entry call.
    const banking = text.indexOf("STA $01");
    const jsrInit = text.indexOf("JSR __init");
    const jsrMain = text.indexOf("JSR _main");
    expect(banking).toBeGreaterThanOrEqual(0);
    expect(jsrInit).toBeGreaterThan(banking);
    expect(jsrMain).toBeGreaterThan(jsrInit);
  });

  it("should emit neither the init routine nor its call for an initializer-free program", () => {
    const text = asmOf(WITHOUT_INIT);
    expect(text).not.toContain("__init");
  });

  it("should store a word initializer little-endian through the init routine", () => {
    const text = asmOf(
      "module Main;\n" + "let w: word = $0102;\n" + "function main(): void {}\n",
    );
    expect(text).toContain("LDA #$02");
    expect(text).toContain("LDX #$01");
    expect(text).toContain("STA __var_Main_w");
    expect(text).toContain("STX __var_Main_w+1");
  });

  it("should inline a module const at its use site with no storage symbol", () => {
    const text = asmOf(
      "module Main;\n" + "const K: byte = 3;\n" + "function main(): void { poke($C000, K); }\n",
    );
    expect(text).toContain("LDA #$03");
    expect(text).not.toContain("__frame_Main_main_K");
    expect(text).not.toContain("__var_Main_K");
  });
});

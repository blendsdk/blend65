/**
 * Specification tests for emit orchestration (`emitBinary`).
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: the emit-asm-only short-circuit, the success aggregation, and the
 * post-ACME budget check (`E10034`).
 *
 * Filesystem and ACME invocation are injected via {@link EmitDeps} so no test
 * writes real files or spawns a real ACME binary.
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag, DiagCode } from "@blend65/core";
import { emitBinary, type EmitDeps, type EmitOptions } from "./emit-binary.js";

const ASM = '!to "main.prg", cbm\n; --- symbol definitions ---\n';

/** Baseline options; tests override per case. */
function options(overrides: Partial<EmitOptions> = {}): EmitOptions {
  return {
    outDir: "/build",
    projectName: "main",
    emitAsmOnly: false,
    ...overrides,
  };
}

/** Build injected deps with per-test invoke behaviour and recording fs hooks. */
function deps(opts: {
  invokeSuccess?: boolean;
  binarySize?: number;
  labelContent?: string;
  written?: Map<string, string>;
}): EmitDeps {
  const written = opts.written ?? new Map<string, string>();
  return {
    ensureDir: vi.fn(),
    writeFile: vi.fn((path: string, content: string) => {
      written.set(path, content);
    }),
    readFile: vi.fn(() => opts.labelContent ?? ""),
    invoke: vi.fn(async () => {
      if (opts.invokeSuccess === false) {
        return { success: false };
      }
      return {
        success: true,
        binaryPath: "/build/main.prg",
        labelFilePath: "/build/main.lbl",
        binarySize: opts.binarySize ?? 0,
      };
    }),
  };
}

describe("Specification: emitBinary — emit-asm-only (ST-E1)", () => {
  it("writes the .asm and stops without invoking ACME (ST-E1)", async () => {
    const bag = createDiagnosticBag();
    const d = deps({});
    const result = await emitBinary(ASM, options({ emitAsmOnly: true }), bag, d);
    expect(result.success).toBe(true);
    expect(result.asmPath).toBe("/build/main.asm");
    expect(result.binaryPath).toBeUndefined();
    expect(d.invoke).not.toHaveBeenCalled();
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: emitBinary — full run (ST-E2)", () => {
  it("aggregates binary, asm, symbols, and size on a successful ACME run (ST-E2)", async () => {
    const bag = createDiagnosticBag();
    const d = deps({
      invokeSuccess: true,
      binarySize: 25,
      labelContent: "al C:080d ._main",
    });
    const result = await emitBinary(ASM, options(), bag, d);
    expect(result.success).toBe(true);
    expect(result.binaryPath).toBe("/build/main.prg");
    expect(result.asmPath).toBe("/build/main.asm");
    expect(result.binarySize).toBe(25);
    expect(result.symbols?.get("_main")).toBe(0x080d);
  });
});

describe("Specification: emitBinary — post-ACME budget check (ST-E3)", () => {
  it("emits E10034 and fails when the binary exceeds maxBinarySize (ST-E3)", async () => {
    const bag = createDiagnosticBag();
    const d = deps({ invokeSuccess: true, binarySize: 5000 });
    const result = await emitBinary(ASM, options({ maxBinarySize: 4096 }), bag, d);
    expect(result.success).toBe(false);
    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors().some((e) => e.code === DiagCode.BinaryTooLarge)).toBe(true);
  });
});

/**
 * Implementation tests for RD-09 emit orchestration (`emitBinary`). Written AFTER
 * the implementation — these cover internals beyond the ST-E* spec oracles: output
 * directory creation, the `.asm` path being retained on an ACME failure (R36), the
 * no-budget-check path, and the at-limit boundary of the budget check.
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag, DiagCode } from "@blend65/core";
import { emitBinary, type EmitDeps, type EmitOptions } from "./emit-binary.js";

const ASM = "; --- symbol definitions ---\n";

function options(overrides: Partial<EmitOptions> = {}): EmitOptions {
  return { outDir: "/build", projectName: "main", emitAsmOnly: false, ...overrides };
}

function deps(opts: {
  invokeSuccess?: boolean;
  binarySize?: number;
  labelContent?: string;
  ensureDir?: ReturnType<typeof vi.fn>;
  writeFile?: ReturnType<typeof vi.fn>;
}): EmitDeps {
  return {
    ensureDir: opts.ensureDir ?? vi.fn(),
    writeFile: opts.writeFile ?? vi.fn(),
    readFile: vi.fn(() => opts.labelContent ?? ""),
    invoke: vi.fn(async () =>
      opts.invokeSuccess === false
        ? { success: false }
        : {
            success: true,
            binaryPath: "/build/main.prg",
            labelFilePath: "/build/main.lbl",
            binarySize: opts.binarySize ?? 0,
          },
    ),
  };
}

describe("emitBinary — output directory & artifacts", () => {
  it("ensures the output directory exists and writes the .asm before anything else", async () => {
    const bag = createDiagnosticBag();
    const ensureDir = vi.fn();
    const writeFile = vi.fn();
    await emitBinary(ASM, options({ emitAsmOnly: true }), bag, deps({ ensureDir, writeFile }));
    expect(ensureDir).toHaveBeenCalledWith("/build");
    expect(writeFile).toHaveBeenCalledWith("/build/main.asm", ASM);
  });
});

describe("emitBinary — failure retains the .asm path (R36)", () => {
  it("returns the asmPath even when ACME invocation fails", async () => {
    const bag = createDiagnosticBag();
    const result = await emitBinary(ASM, options(), bag, deps({ invokeSuccess: false }));
    expect(result.success).toBe(false);
    expect(result.asmPath).toBe("/build/main.asm");
    expect(result.binaryPath).toBeUndefined();
  });
});

describe("emitBinary — budget check boundaries", () => {
  it("does not run the budget check when maxBinarySize is undefined", async () => {
    const bag = createDiagnosticBag();
    const result = await emitBinary(ASM, options(), bag, deps({ binarySize: 999999 }));
    expect(result.success).toBe(true);
    expect(bag.getErrors().some((e) => e.code === DiagCode.BinaryTooLarge)).toBe(false);
  });

  it("passes when the binary size is exactly at the limit (not over)", async () => {
    const bag = createDiagnosticBag();
    const result = await emitBinary(
      ASM,
      options({ maxBinarySize: 4096 }),
      bag,
      deps({ binarySize: 4096 }),
    );
    expect(result.success).toBe(true);
    expect(bag.getErrors().some((e) => e.code === DiagCode.BinaryTooLarge)).toBe(false);
  });
});

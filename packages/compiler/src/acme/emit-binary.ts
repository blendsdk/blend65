/**
 * RD-09 emit orchestration — `emitBinary`
 * (`plans/rd-09-acme-emitter/03-02-acme-process-layer.md`, R34, R39–R44;
 * AR-63/AR-67/AR-81).
 *
 * The top-level driver that turns serialized ACME text into build artifacts:
 *
 *   1. Ensure the output directory exists and write `<projectName>.asm` (R39/R42).
 *   2. If `--emit-asm` is set, stop here — no ACME, no binary (R34, AC-03).
 *   3. Discover ACME (`discoverAcme`); a missing assembler fails the build (R28/R29).
 *   4. Invoke ACME (`invokeAcme`); a non-zero exit is an ICE and the `.asm` is
 *      retained (R35/R36).
 *   5. Parse the VICE label file into a symbol map (R45–R47).
 *   6. Post-ACME budget check: a binary larger than the platform's
 *      `maxBinarySize` emits `E10034` (R43, AC-14).
 *   7. Aggregate the {@link BuildResult} (binary/asm/label paths, symbol map, size).
 *
 * Filesystem, discovery, and invocation are injected via {@link EmitDeps} so the
 * orchestration is unit-testable without real I/O or a real ACME binary (AR-27).
 * {@link defaultEmitDeps} wires the real implementations.
 *
 * Lives in `@blend65/compiler` (R15/AR-20).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DiagCode, type Diagnostic, type DiagnosticBag } from "@blend65/core";
import { discoverAcme } from "./discover-acme.js";
import { invokeAcme, type AcmeResult } from "./invoke-acme.js";
import { parseLabelFile } from "./label-file.js";

/** Options controlling a build emit (R34, R40–R43). */
export interface EmitOptions {
  /** Output directory; created if missing (default `./build`, R42). */
  readonly outDir: string;
  /** Base name for the binary/asm/label artifacts (R40). */
  readonly projectName: string;
  /** `--emit-asm`: write the `.asm` and stop, no ACME (R34). */
  readonly emitAsmOnly: boolean;
  /** Explicit ACME path (discovery tier 1). */
  readonly acmePath?: string;
  /** Platform binary budget; exceeding it emits `E10034` (R43). */
  readonly maxBinarySize?: number;
}

/** The aggregated outcome of a build emit (RD §4.7). */
export interface BuildResult {
  /** Whether the emit succeeded end-to-end. */
  readonly success: boolean;
  /** All diagnostics accumulated during the emit. */
  readonly diagnostics: Diagnostic[];
  /** Path to the binary output (present on a successful ACME run). */
  readonly binaryPath?: string | undefined;
  /** Path to the written `.asm` (always set once written, even on failure, R36). */
  readonly asmPath?: string | undefined;
  /** Symbol→address map from the VICE label file (present on success). */
  readonly symbols?: Map<string, number> | undefined;
  /** Binary size in bytes, excluding the PRG load header (present on success). */
  readonly binarySize?: number | undefined;
}

/**
 * Injected I/O seam — keeps {@link emitBinary} testable without real files,
 * discovery, or process spawning. Production wiring uses {@link defaultEmitDeps}.
 */
export interface EmitDeps {
  /** Create the output directory (recursively) if it does not exist. */
  readonly ensureDir: (dir: string) => void;
  /** Write `content` to `path`. */
  readonly writeFile: (path: string, content: string) => void;
  /** Read a file's text (used for the label file). */
  readonly readFile: (path: string) => string;
  /** Discover + invoke ACME, returning its result. */
  readonly invoke: (
    asmPath: string,
    opts: EmitOptions & { binaryPath: string; labelPath: string; reportPath: string },
    bag: DiagnosticBag,
  ) => Promise<AcmeResult>;
}

/**
 * Write the serialized ACME text to disk and drive ACME to a platform binary,
 * aggregating the artifacts into a {@link BuildResult} (R34, R39–R44).
 *
 * @param asmText The serialized ACME source (from `serializeToAcme`).
 * @param opts The emit options (output dir, project name, flags, budget).
 * @param bag Diagnostic sink — receives ACME/budget diagnostics.
 * @param deps Injected I/O seam (defaults to {@link defaultEmitDeps}).
 * @returns The aggregated {@link BuildResult}.
 */
export async function emitBinary(
  asmText: string,
  opts: EmitOptions,
  bag: DiagnosticBag,
  deps: EmitDeps = defaultEmitDeps,
): Promise<BuildResult> {
  // 1. Ensure the output dir exists and write `<projectName>.asm` (R39/R42).
  deps.ensureDir(opts.outDir);
  const asmPath = join(opts.outDir, `${opts.projectName}.asm`);
  deps.writeFile(asmPath, asmText);

  // 2. `--emit-asm`: write and stop, no ACME (R34, AC-03).
  if (opts.emitAsmOnly) {
    return { success: true, diagnostics: bag.getAll(), asmPath };
  }

  // 3+4. Discover + invoke ACME. A discovery failure / ICE is recorded on `bag`;
  //      the `.asm` file is already on disk and is retained (R36).
  const binaryPath = join(opts.outDir, `${opts.projectName}.prg`);
  const labelPath = join(opts.outDir, `${opts.projectName}.lbl`);
  const reportPath = join(opts.outDir, `${opts.projectName}.report`);
  const acme = await deps.invoke(
    asmPath,
    { ...opts, binaryPath, labelPath, reportPath },
    bag,
  );
  if (!acme.success) {
    return { success: false, diagnostics: bag.getAll(), asmPath };
  }

  // 5. Parse the VICE label file into a symbol map (R45–R47).
  const symbols = parseLabelFile(deps.readFile(labelPath));

  // 6. Post-ACME budget check: a too-large binary emits `E10034` (R43, AC-14).
  const binarySize = acme.binarySize ?? 0;
  if (opts.maxBinarySize !== undefined && binarySize > opts.maxBinarySize) {
    bag.addError(
      DiagCode.BinaryTooLarge,
      null,
      `Output binary (${binarySize} bytes) exceeds the platform maximum binary ` +
        `size (${opts.maxBinarySize} bytes)`,
    );
    return {
      success: false,
      diagnostics: bag.getAll(),
      binaryPath: acme.binaryPath,
      asmPath,
      symbols,
      binarySize,
    };
  }

  // 7. Aggregate the successful result (R39, AC-16).
  return {
    success: true,
    diagnostics: bag.getAll(),
    binaryPath: acme.binaryPath,
    asmPath,
    symbols,
    binarySize,
  };
}

/**
 * Production {@link EmitDeps}: real `node:fs` I/O and the real discover→invoke
 * pipeline. Discovery failure short-circuits to an unsuccessful {@link AcmeResult}
 * (the diagnostic is already on the bag).
 */
export const defaultEmitDeps: EmitDeps = {
  ensureDir(dir: string): void {
    mkdirSync(dir, { recursive: true });
  },
  writeFile(path: string, content: string): void {
    writeFileSync(path, content, "utf8");
  },
  readFile(path: string): string {
    return readFileSync(path, "utf8");
  },
  async invoke(asmPath, opts, bag): Promise<AcmeResult> {
    const acmeExe = discoverAcme(
      opts.acmePath !== undefined ? { acmePath: opts.acmePath } : {},
      bag,
    );
    if (acmeExe === null) {
      return { success: false };
    }
    return invokeAcme(
      {
        acmeExe,
        asmPath,
        binaryPath: opts.binaryPath,
        labelPath: opts.labelPath,
        reportPath: opts.reportPath,
        cwd: opts.outDir,
      },
      bag,
    );
  },
};

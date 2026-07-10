/**
 * `build()` — the full-pipeline facade entry point.
 *
 * Runs the `emitAsm` pipeline, writes + assembles the binary via `emitBinary`,
 * threads `binarySize` into the resource report so the canonical
 * platform-named `checkBinaryBudget` E10034 cannot no-op, reads the binary
 * back on success, runs the mandatory code/data overlap check against the
 * allocation plan's data base, and returns a {@link BuildResult}. ACME I/O is
 * injected via {@link BuildDeps} for tests. Never throws, never prints.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  buildResourceReport,
  checkBinaryBudget,
  checkDataOverlap,
  type CompilerHost,
} from "@blend65/core";
import { defaultEmitDeps, emitBinary, type EmitDeps } from "../acme/emit-binary.js";
import type { CompilerOptions } from "./options.js";
import type { BuildResult } from "./results.js";
import { assembleCompileResult } from "./compile.js";
import { assembleAsmText } from "./emit.js";
import { runFrontend } from "./run-frontend.js";

/**
 * Injectable seam for `build()` — mirrors the {@link EmitDeps}
 * precedent. Tests supply an in-memory fs + fake ACME; production uses
 * {@link defaultBuildDeps}.
 */
export interface BuildDeps {
  /** Forwarded to `emitBinary` (fs + ACME invocation). */
  readonly emitDeps: EmitDeps;
  /** Read the binary back after a successful ACME run. */
  readonly readBinary: (path: string) => Uint8Array;
}

/** Production {@link BuildDeps}: the real ACME emit deps + `fs.readFileSync`. */
export const defaultBuildDeps: BuildDeps = {
  emitDeps: defaultEmitDeps,
  readBinary(path: string): Uint8Array {
    return new Uint8Array(readFileSync(path));
  },
};

/**
 * Compile, assemble, and link the program to a platform binary.
 *
 * @param options The compiler options (`platform` required).
 * @param host An optional injected {@link CompilerHost}.
 * @param deps ACME/fs injection seam (defaults to {@link defaultBuildDeps}).
 * @returns The {@link BuildResult} — never throws.
 */
export async function build(
  options: CompilerOptions,
  host?: CompilerHost,
  deps: BuildDeps = defaultBuildDeps,
): Promise<BuildResult> {
  const run = runFrontend(options, host);
  const asmText = assembleAsmText(run);

  // Pre-emit error (config/discovery/frontend/codegen): no ACME, no report.
  if (asmText === undefined || run.plugin === undefined || run.allocationPlan === undefined) {
    return assembleCompileResult(run);
  }

  // Write the .asm and drive ACME. `maxBinarySize` is deliberately NOT
  // passed — the facade owns the canonical E10034 via `checkBinaryBudget`.
  const emit = await emitBinary(
    asmText,
    {
      outDir: run.config.outDir,
      projectName: run.outName,
      emitAsmOnly: false,
      ...(run.config.acmePath !== "" ? { acmePath: run.config.acmePath } : {}),
    },
    run.bag,
    deps.emitDeps,
  );

  // Assemble the resource report, threading `binarySize` so the budget check
  // cannot silently no-op. Segment sizes/ranges stay absent → zeros.
  const targetName =
    emit.binaryPath !== undefined ? basename(emit.binaryPath) : `${run.outName}.prg`;
  const report = buildResourceReport({
    platformName: run.config.platform,
    targetName,
    plan: run.allocationPlan,
    binaryBudget: run.plugin.profile.maxBinarySize,
    ...(emit.binarySize !== undefined ? { binarySize: emit.binarySize } : {}),
  });
  // The canonical post-ACME budget check (E10034, platform-named). Mirrors
  // the opt-in inline check in `acme/emit-binary.ts`.
  checkBinaryBudget(report, run.bag);

  // Read the binary back when ACME produced one (success or over-budget artifact).
  const binary =
    emit.binaryPath !== undefined ? deps.readBinary(emit.binaryPath) : undefined;

  // Mandatory code/data overlap check: the PRG header's first two bytes are
  // the load address (little-endian); the size excludes that header. The data
  // base comes from the allocation plan, never from a profile constant.
  if (binary !== undefined && binary.length >= 2 && emit.binarySize !== undefined) {
    checkDataOverlap(
      {
        loadAddress: binary[0] | (binary[1] << 8),
        binarySize: emit.binarySize,
        dataBase: run.allocationPlan.dataBase,
      },
      run.bag,
    );
  }

  // Assemble the base AFTER every bag mutation (codegen + ACME + budget), so
  // the severity policy sees the complete diagnostic set (failure is derived
  // from the final diagnostics array, not `emit.success`).
  const base = assembleCompileResult(run);
  return {
    ...base,
    asmText,
    ...(emit.asmPath !== undefined ? { asmPath: emit.asmPath } : {}),
    ...(emit.binaryPath !== undefined ? { binaryPath: emit.binaryPath } : {}),
    ...(binary !== undefined ? { binary } : {}),
    ...(emit.symbols !== undefined ? { symbolMap: emit.symbols } : {}),
    resourceReport: report,
  };
}

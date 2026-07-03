/**
 * `emitIl` / `emitAsm` — the partial-pipeline facade entry points (RD-15 R7/R8,
 * AR-V19; PF-001 startup/out-name seam).
 *
 * `emitIl` runs the frontend → IL lowering → IL optimizer (always, AR-V19) →
 * `printIL`. `emitAsm` continues into `assembleProgram` (with the PF-001 overrides
 * threading the effective `outName` and `startup`), the peephole optimizer (only
 * when `config.optimize`, AR-V19), runtime-section embedding, and `serializeToAcme`.
 * Neither invokes ACME nor writes files (R7/R8) — the CLI writes the artifact.
 */

import { RT_ROUTINES, type CompilerHost } from "@blend65/core";
import type { ShimVariant } from "@blend65/core/platform";
import {
  assembleProgram,
  buildRuntimeSection,
  collectReferencedRoutines,
  lowerToIL,
  optimizeIL,
  optimizeInstr,
  printIL,
  serializeToAcme,
  type ILProgram,
} from "@blend65/codegen";
import type { CompilerOptions } from "./options.js";
import type { EmitResult } from "./results.js";
import { assembleCompileResult } from "./compile.js";
import { runFrontend, type FrontendRun } from "./run-frontend.js";

/**
 * Map the config `startup` value to core's {@link ShimVariant} (RD-16 R18, AR-69):
 * `terminating`→`"terminating"`, `minimal`→`"non-terminating"`, `bare`→`"bare"`,
 * `auto`→`undefined` (falls through to the codegen Half-A default).
 *
 * @param startup The resolved `config.startup`.
 * @returns The shim variant, or `undefined` for `"auto"`.
 */
export function toShimVariant(
  startup: "auto" | "terminating" | "minimal" | "bare",
): ShimVariant | undefined {
  switch (startup) {
    case "terminating":
      return "terminating";
    case "minimal":
      return "non-terminating";
    case "bare":
      return "bare";
    case "auto":
      return undefined;
  }
}

/**
 * Emit IL text for the program (R8/AC-04). No codegen.
 *
 * @param options The compiler options.
 * @param host An optional injected {@link CompilerHost}.
 * @returns The {@link EmitResult} with `text` = the IL, absent on a pre-emit error.
 */
export function emitIl(options: CompilerOptions, host?: CompilerHost): EmitResult {
  const run = runFrontend(options, host);
  const il = lowerProgram(run);
  const text = il !== undefined ? printIL(il) : undefined;
  return withText(assembleCompileResult(run), text);
}

/**
 * Emit ACME assembly text for the program (R7/AC-03). No ACME invocation, no
 * file writes.
 *
 * @param options The compiler options.
 * @param host An optional injected {@link CompilerHost}.
 * @returns The {@link EmitResult} with `text` = the ACME source, absent on a
 *   pre-emit error.
 */
export function emitAsm(options: CompilerOptions, host?: CompilerHost): EmitResult {
  const run = runFrontend(options, host);
  const text = assembleAsmText(run);
  return withText(assembleCompileResult(run), text);
}

/**
 * Lower + IL-optimize the run's programs, or `undefined` when a pre-emit error
 * makes codegen unsafe (aborted run or any pipeline error, R11). Mutates `run.bag`.
 */
function lowerProgram(run: FrontendRun): ILProgram | undefined {
  if (
    run.aborted ||
    run.programs === undefined ||
    run.semanticModel === undefined ||
    run.allocationPlan === undefined ||
    run.registry === undefined ||
    run.bag.hasErrors()
  ) {
    return undefined;
  }
  const il = lowerToIL(
    {
      program: run.programs,
      model: run.semanticModel,
      plan: run.allocationPlan,
      registry: run.registry,
    },
    run.bag,
  );
  // The IL optimizer always runs (AR-V19); v1 ships no passes → identity.
  return optimizeIL(il, [], run.bag);
}

/**
 * Assemble the full ACME text from the run, or `undefined` on a pre-emit error.
 * Mutates `run.bag` with codegen diagnostics. Exported (internal) so `build()`
 * reuses the exact `emitAsm` pipeline (no re-derivation).
 */
export function assembleAsmText(run: FrontendRun): string | undefined {
  const il = lowerProgram(run);
  if (il === undefined || run.plugin === undefined) {
    return undefined;
  }
  const plugin = run.plugin;
  // PF-001: thread the effective out-name and startup shim into the preamble.
  // `auto` maps to undefined → keep the codegen Half-A default (omit the key).
  const shim = toShimVariant(run.config.startup);
  const program = assembleProgram(il, plugin, run.bag, {
    projectName: run.outName,
    ...(shim !== undefined ? { shimVariant: shim } : {}),
  });
  // Peephole runs only under --optimize (AR-V19); otherwise the program is verbatim.
  const optimized = run.config.optimize
    ? optimizeInstr(program, plugin.profile.cpu, run.bag)
    : program;
  const referenced = collectReferencedRoutines(
    optimized,
    [...RT_ROUTINES, ...plugin.intrinsics],
    plugin.runtimeModules,
  );
  const section = buildRuntimeSection(referenced, RT_ROUTINES, plugin.runtimeModules);
  return serializeToAcme(optimized, { runtimeSection: section ?? "" });
}

/** Attach `text` to the base result only when defined (exactOptionalPropertyTypes). */
function withText(base: EmitResult, text: string | undefined): EmitResult {
  return text !== undefined ? { ...base, text } : base;
}

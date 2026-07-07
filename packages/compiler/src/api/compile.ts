/**
 * `compile()` — the frontend-only facade entry point, plus the shared
 * result-assembly the emit/build paths reuse.
 *
 * `compile` runs the shared frontend and assembles a {@link CompileResult}. The
 * severity policy is applied exactly **once**, over the config-first merged
 * diagnostic array. Sync, never throws, never prints.
 */

import {
  applySeverityPolicy,
  createSeverityPolicy,
  type CompilerHost,
  type Diagnostic,
} from "@blend65/core";
import type { BlendConfig } from "@blend65/config";
import type { CompilerOptions } from "./options.js";
import type { CompileResult } from "./results.js";
import { runFrontend, type FrontendRun } from "./run-frontend.js";

/**
 * Compile the frontend only — the language server's API. Runs config →
 * discovery → lex/parse → analyze → SFA and returns a structured
 * {@link CompileResult}.
 *
 * @param options The compiler options (`platform` required).
 * @param host An optional injected {@link CompilerHost}.
 * @returns The compile result — never throws, never prints.
 */
export function compile(options: CompilerOptions, host?: CompilerHost): CompileResult {
  return assembleCompileResult(runFrontend(options, host));
}

/**
 * Apply the severity policy once over the config-first merged diagnostics
 * and return the final diagnostics + the effective config.
 *
 * Shared by `compile`/`emitIl`/`emitAsm`/`build` so the policy runs exactly
 * once per invocation. The returned `config` carries the derived effective
 * `outName`.
 *
 * @param run The completed {@link FrontendRun}.
 * @returns The final diagnostics, the `hasErrors` flag, and the effective config.
 */
export function finalizeRun(run: FrontendRun): {
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  config: BlendConfig;
} {
  const policy = createSeverityPolicy({
    warnAsError: run.config.warnAsError,
    suppressWarnings: run.config.suppressWarnings,
  });
  // Config diagnostics first, then pipeline diagnostics.
  const diagnostics = applySeverityPolicy([...run.configDiagnostics, ...run.bag.getAll()], policy);
  const hasErrors = diagnostics.some((d) => d.severity === "error");
  // Surface the effective (never-empty) output name on the returned config.
  const config: BlendConfig = { ...run.config, outName: run.outName };
  return { diagnostics, hasErrors, config };
}

/**
 * Assemble a {@link CompileResult} from a completed run — the base every facade
 * result extends.
 *
 * @param run The completed {@link FrontendRun}.
 * @returns The frontend-only compile result.
 */
export function assembleCompileResult(run: FrontendRun): CompileResult {
  const { diagnostics, hasErrors, config } = finalizeRun(run);
  return {
    hasErrors,
    diagnostics,
    config,
    sourceMap: run.sourceMap,
    // Optional fields under exactOptionalPropertyTypes: include only when present.
    ...(run.semanticModel !== undefined ? { semanticModel: run.semanticModel } : {}),
    ...(run.allocationPlan !== undefined ? { allocationPlan: run.allocationPlan } : {}),
  };
}

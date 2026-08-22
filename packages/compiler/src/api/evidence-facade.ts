import type { CompilerHost } from "@blend65/core";

import { assembleCompileResult } from "./compile.js";
import { buildFromRun, defaultBuildDeps, type BuildDeps } from "./build.js";
import {
  createCompilerDiagnosticCaptureV1,
  type CompilerDiagnosticEvidenceV1,
} from "./diagnostic-evidence.js";
import { emitAsmFromRun, emitIlFromRun } from "./emit.js";
import type { CompilerOptions } from "./options.js";
import type { BuildResult, CompileResult, EmitResult } from "./results.js";
import { runFrontend } from "./run-frontend.js";

/** Ordinary compiler result paired with its separate diagnostic evidence sidecar. */
export interface CompileWithEvidenceResultV1<T extends CompileResult = CompileResult> {
  /** Unchanged ordinary compiler result. */
  readonly result: T;
  /** Accepted-entry diagnostic provenance from the same invocation. */
  readonly evidence: CompilerDiagnosticEvidenceV1;
}

/** Additive compiler façade used when one invocation also needs evidence. */
export interface CompilerEvidenceFacadeV1 {
  /** Frontend-only compile with evidence. */
  readonly compile: typeof compileWithEvidence;
  /** IL emission with evidence. */
  readonly emitIl: typeof emitIlWithEvidence;
  /** Assembly emission with evidence. */
  readonly emitAsm: typeof emitAsmWithEvidence;
  /** Full binary build with evidence. */
  readonly build: typeof buildWithEvidence;
}

function closeResult<T extends CompileResult>(
  result: T,
  evidence: CompilerDiagnosticEvidenceV1,
): CompileWithEvidenceResultV1<T> {
  return Object.freeze({ result, evidence });
}

/** Runs the frontend once and returns its unchanged result plus accepted diagnostic provenance. */
export function compileWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1 {
  const capture = createCompilerDiagnosticCaptureV1();
  const result = assembleCompileResult(runFrontend(options, host, capture));
  return closeResult(result, capture.finalize(result.diagnostics));
}

/** Runs frontend and IL emission once with a separate diagnostic evidence sidecar. */
export function emitIlWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1<EmitResult> {
  const capture = createCompilerDiagnosticCaptureV1();
  const result = emitIlFromRun(runFrontend(options, host, capture));
  return closeResult(result, capture.finalize(result.diagnostics));
}

/** Runs frontend and assembly emission once with a separate diagnostic evidence sidecar. */
export function emitAsmWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1<EmitResult> {
  const capture = createCompilerDiagnosticCaptureV1();
  const result = emitAsmFromRun(runFrontend(options, host, capture));
  return closeResult(result, capture.finalize(result.diagnostics));
}

/** Runs the full build once with a separate diagnostic evidence sidecar. */
export async function buildWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
  deps: BuildDeps = defaultBuildDeps,
): Promise<CompileWithEvidenceResultV1<BuildResult>> {
  const capture = createCompilerDiagnosticCaptureV1();
  const result = await buildFromRun(runFrontend(options, host, capture), deps);
  return closeResult(result, capture.finalize(result.diagnostics));
}

/** Default evidence façade over the shipped compiler entry points. */
export const defaultCompilerEvidenceFacadeV1: CompilerEvidenceFacadeV1 = Object.freeze({
  compile: compileWithEvidence,
  emitIl: emitIlWithEvidence,
  emitAsm: emitAsmWithEvidence,
  build: buildWithEvidence,
});

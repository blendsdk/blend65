/**
 * Facade result types (RD-15 §4.1, R51).
 *
 * `CompileResult` is the frontend-only result (the LSP's return type); `EmitResult`
 * and `BuildResult` extend it for the emit and full-build paths. Every result
 * carries the **resolved** `config` (R51) — including the R21-derived effective
 * `outName` (PF-001/PF-010) — so consumers read the effective settings from one
 * place. PF-002: this `BuildResult` owns the `BuildResult` name; the acme-layer
 * aggregate is `EmitBinaryResult` (its `symbols` map is surfaced here as
 * `symbolMap`, its binary read back from disk per AR-V12).
 */

import type {
  AllocationPlan,
  Diagnostic,
  ResourceReport,
  SemanticModel,
  SourceMap,
} from "@blend65/core";
import type { BlendConfig } from "@blend65/config";

/** Result of `compile()` — frontend only (R5). */
export interface CompileResult {
  /** Whether any error-severity diagnostic is present (post severity policy). */
  hasErrors: boolean;
  /** All diagnostics (config + pipeline), severity-policy-applied, in final order. */
  diagnostics: Diagnostic[];
  /** The resolved configuration: defaults ← blend65.json ← overrides (R51). */
  config: BlendConfig;
  /** The source map for span resolution (empty on a pre-lex abort). */
  sourceMap: SourceMap;
  /** The semantic model — present once the frontend reached analysis. */
  semanticModel?: SemanticModel;
  /** The SFA allocation plan — present once the frontend reached planning. */
  allocationPlan?: AllocationPlan;
}

/** Result of `emitIl()` / `emitAsm()` — a partial pipeline (R7/R8). */
export interface EmitResult extends CompileResult {
  /** The emitted IL or ACME text; absent when an error preceded the emit stage. */
  text?: string;
}

/** Result of `build()` — the full pipeline through ACME (R6). */
export interface BuildResult extends CompileResult {
  /** The serialized ACME text (present once codegen ran). */
  asmText?: string;
  /** Path to the written `.asm` (present once emit reached disk). */
  asmPath?: string;
  /** Path to the binary output (present on a successful ACME run). */
  binaryPath?: string;
  /** The binary bytes read back after a successful ACME run (AR-V12). */
  binary?: Uint8Array;
  /** Symbol→address map from the VICE label file (present on success). */
  symbolMap?: Map<string, number>;
  /** The resource report (present once the pipeline assembled it). */
  resourceReport?: ResourceReport;
}

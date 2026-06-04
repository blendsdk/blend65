/**
 * The four semantic-analysis pass seams (RD-04 §4.1, R1–R6).
 *
 * The real RD-04 analyzer is a four-pass pipeline: declaration collection, type
 * resolution, body checking, and post-check validation. In this **passthrough
 * skeleton** each pass is a documented no-op — the seams exist so the future
 * checker has named, traceable insertion points and `analyze()` already calls
 * them in the correct order. None of R30–R117 is enforced here; see
 * plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md.
 *
 * The pass functions take `AnalyzeInput`/`SemanticModel` to document the future
 * checker's signature, but the passthrough uses neither. Parameters are
 * `_`-prefixed (D15) so they satisfy both `tsc --noUnusedParameters` and ESLint
 * (root `argsIgnorePattern: "^_"`) — the single canonical mechanism for an
 * intentionally-unused deferred-seam parameter. The future checker renames them
 * and fills in the body.
 */

import type { SemanticModel } from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";

/**
 * Pass 1 — Declaration Collection (RD-04 R2, §4.1).
 *
 * DEFERRED(RD-04-checker): register modules + top-level declarations + struct
 * fields + enum members + export visibility + intrinsic symbols. Emits E10003 on
 * duplicate declarations.
 *
 * @param _input The analyzer input (unused in the passthrough).
 * @param _model The model under construction (unused in the passthrough).
 */
export function collectDeclarations(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 2 — Type Resolution (RD-04 R3, §4.1).
 *
 * DEFERRED(RD-04-checker): resolve named types, validate struct fields (no
 * recursion), compute struct sizeof, validate enum backing values. Emits
 * E10151/E10142/E10143/E10163.
 *
 * @param _input The analyzer input (unused in the passthrough).
 * @param _model The model under construction (unused in the passthrough).
 */
export function resolveTypes(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 3 — Body Checking (RD-04 R4, §4.1).
 *
 * DEFERRED(RD-04-checker): type-check expressions, validate statements,
 * const-eval, intrinsic validation, build the call graph, resolve identifiers.
 * Emits the bulk of the E10xxx surface.
 *
 * @param _input The analyzer input (unused in the passthrough).
 * @param _model The model under construction (unused in the passthrough).
 */
export function checkBodies(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 4 — Post-Check Validation (RD-04 R5, §4.1).
 *
 * DEFERRED(RD-04-checker): verify main() signature, detect recursion, compute
 * module init order, flag unused variables and unreachable code. Emits
 * E10020/E10021/E10174/W10130/W10191/E10194.
 *
 * @param _input The analyzer input (unused in the passthrough).
 * @param _model The model under construction (unused in the passthrough).
 */
export function postCheck(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

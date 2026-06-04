/**
 * The single deferred wiring seam between RD-04's `SemanticModel` and RD-05's SFA
 * planner (RD-05 D1/D3/D5; spec Ch 11).
 *
 * `modelToFunctionInfo` projects a populated {@link SemanticModel} into the flat
 * {@link FunctionInfo}[] the planner consumes. This is the **only** place the
 * "RD-04 checker not yet wired" deferral lives: every SFA algorithm operates on
 * `FunctionInfo` fixtures and is fully implemented and tested, so when the RD-04b
 * checker populates the model's call graph / symbol map / type map, only this
 * adapter is filled in — no SFA pass changes.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).
 * See plans/rd-05-sfa-frame-planner/03-05-allocation-plan-and-api.md.
 */

import type { SemanticModel, FunctionInfo } from "@blend65/core";

/**
 * Extracts the planner's {@link FunctionInfo}[] from a {@link SemanticModel}.
 *
 * DEFERRED(RD-05-wiring): the RD-04 analyzer is a passthrough that returns an
 * **empty** model (no functions, empty call graph), so there is nothing to extract
 * yet — this returns `[]` today (AC-22). When the RD-04b checker populates
 * `callGraph` / `symbolMap` / `typeMap`, this adapter is implemented here WITHOUT
 * touching any SFA pass.
 *
 * The `_model` parameter is `_`-prefixed to mark it intentionally unused under the
 * passthrough (RD-04 D15 convention), satisfying both `tsc --noUnusedParameters`
 * and ESLint `argsIgnorePattern: "^_"`.
 *
 * @param _model The semantic model (unused in the passthrough).
 * @returns `[]` today; the projected functions once RD-04b populates the model.
 */
export function modelToFunctionInfo(_model: SemanticModel): FunctionInfo[] {
  return []; // DEFERRED(RD-05-wiring): empty passthrough model has no functions.
}

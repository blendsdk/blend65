/**
 * Public barrel for the Blend65 Static Frame Allocation planner (RD-05, frontend
 * half).
 *
 * Re-exports the planner entry point `planAllocation` and its `PlanInput`/
 * `ModuleVarInput`/`ZpUserVar` input types, plus the deferred `modelToFunctionInfo`
 * wiring seam. The individual passes (frame computation, interference, coloring,
 * ZP allocation, stack analysis, budgets, symbols) are implementation details of
 * `planAllocation` and are deliberately NOT re-exported — like RD-04's analyzer,
 * the package exposes only the orchestrating entry point and its adapter.
 *
 * The SFA *data* vocabulary (`AllocationPlan`, `FunctionInfo`, …) lives in
 * `@blend65/core` and is imported from there, so `frontend` and `language-server`
 * share one source of truth without importing `@blend65/codegen` (R15/AR-20).
 *
 * See plans/rd-05-sfa-frame-planner/ (03-05) and the Ambiguity Register (D6/D9).
 */

export { planAllocation } from "./plan-allocation.js";
export type { PlanInput, ModuleVarInput, ZpUserVar } from "./plan-allocation.js";

export { modelToFunctionInfo } from "./model-adapter.js";

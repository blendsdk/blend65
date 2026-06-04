/**
 * Public barrel for the Blend65 Static Frame Allocation (SFA) vocabulary
 * (RD-05, core half).
 *
 * Re-exports the planner's **input** record (`FunctionInfo`/`FrameVar`, D3/D5), the
 * **frame** records (`FunctionFrame`/`FrameSlot`/`InterferenceGraph`), and the
 * **output** records (`AllocationPlan` and its sub-records). These are pure data
 * (no logic): the frontend `sfa/` passes produce/consume them, and downstream
 * phases (RD-06/RD-07/RD-09) read the resulting `AllocationPlan`. Living in
 * `@blend65/core` keeps `frontend` and `language-server` sharing one source of
 * truth without importing `@blend65/codegen` (R15/AR-20).
 *
 * See plans/rd-05-sfa-frame-planner/ (03-01..03-05) and the Ambiguity Register
 * (D2/D3/D5/D6/D8).
 */

export type { FrameVar, FunctionInfo } from "./function-info.js";

export type { FrameSlot, FunctionFrame, InterferenceGraph } from "./frame.js";

export type {
  ModuleVariableAllocation,
  ZpAllocation,
  StackAnalysis,
  FrameAllocation,
  SymbolDefinition,
  SfaResourceData,
  AllocationPlan,
} from "./allocation-plan.js";

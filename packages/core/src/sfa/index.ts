/**
 * Public barrel for the Blend65 Static Frame Allocation (SFA) vocabulary.
 *
 * Re-exports the planner's **input** record (`FunctionInfo`/`FrameVar`), the
 * **frame** records (`FunctionFrame`/`FrameSlot`/`InterferenceGraph`), and the
 * **output** records (`AllocationPlan` and its sub-records). These are pure data
 * (no logic): the frontend `sfa/` passes produce/consume them, and downstream
 * phases (IL generation, codegen, the ACME emitter) read the resulting
 * `AllocationPlan`. Living in `@blend65/core` keeps `frontend` and
 * `language-server` sharing one source of truth without importing
 * `@blend65/codegen`.
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

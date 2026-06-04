/**
 * The SFA planner's **input record** vocabulary (RD-05 §4.2, R1–R6; D3/D5).
 *
 * `FunctionInfo` is the RD-05-owned, flat view of a single function — the unit the
 * Static Frame Allocation passes consume. It is deliberately **decoupled** from the
 * semantic `Symbol`: the planner never reaches into the semantic model's
 * scope/symbol/type machinery. Instead, a thin adapter (`modelToFunctionInfo`,
 * the single deferred wiring seam — see the frontend `sfa/model-adapter.ts`)
 * projects a populated `SemanticModel` into `FunctionInfo[]`. Under the RD-04
 * passthrough the adapter returns `[]`; the algorithm tests build `FunctionInfo`
 * fixtures directly.
 *
 * This is pure data (no logic), so it lives in `@blend65/core` and is shared by
 * `frontend` without importing `@blend65/codegen` (R15/AR-20).
 *
 * See plans/rd-05-sfa-frame-planner/03-01-frame-model.md and the Ambiguity
 * Register decisions D3/D5.
 */

import type { Type } from "../semantics/type.js";

/**
 * One parameter or local in a function's frame input (RD-05 §4.2).
 *
 * The `byRef` flag distinguishes struct/array parameters that are passed *by
 * reference* (a 2-byte pointer slot) from value slots; the frame-computation pass
 * (03-01) uses it to size parameter slots per the Ch 11 §3.3 type-size table.
 */
export interface FrameVar {
  /** The variable's declared name (unique within its function's frame). */
  readonly name: string;
  /** The resolved semantic type of the variable. */
  readonly type: Type;
  /** `true` for struct/array params passed by reference (a 2-byte pointer slot). */
  readonly byRef: boolean;
}

/**
 * The SFA-owned, flat view of one function — the planner's input unit (D3/D5).
 *
 * Carries the function's fully-qualified name, its ordered parameters and locals
 * (each a {@link FrameVar}), the three always-live flags the interference/coloring
 * and stack passes consult, and the outgoing call edges (the call-graph
 * projection). Built by fixtures now, and by `modelToFunctionInfo` (DEFERRED) when
 * the RD-04b checker populates the semantic model — with no change to any SFA pass.
 */
export interface FunctionInfo {
  /** Fully-qualified `module.function` (e.g. `"Game.update"`). */
  readonly name: string;
  /** Parameters in declaration order (placed first in the frame, R6). */
  readonly parameters: readonly FrameVar[];
  /** Locals in declaration order (placed after the parameters, R6). */
  readonly locals: readonly FrameVar[];
  /** `true` for an interrupt handler — always-live in the interference graph (R14). */
  readonly isInterrupt: boolean;
  /** `true` if the function's address is taken (`&fn`) — always-live (R15). */
  readonly isEscaped: boolean;
  /** `true` if called/exported/address-taken; unreachable functions are excluded (R17). */
  readonly isReachable: boolean;
  /** Outgoing call edges, by callee fully-qualified name (call-graph projection). */
  readonly callees: readonly string[];
}

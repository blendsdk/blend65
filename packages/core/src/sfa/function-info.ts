/**
 * The SFA planner's **input record** vocabulary.
 *
 * `FunctionInfo` is the flat view of a single function — the unit the Static
 * Frame Allocation passes consume. It is deliberately **decoupled** from the
 * semantic `Symbol`: the planner never reaches into the semantic model's
 * scope/symbol/type machinery. Instead, a thin adapter (`modelToFunctionInfo`,
 * the single wiring seam — see the frontend `sfa/model-adapter.ts`) projects a
 * populated `SemanticModel` into `FunctionInfo[]`. Before a real semantic model
 * is available, the adapter returns `[]`; the algorithm tests build
 * `FunctionInfo` fixtures directly.
 *
 * This is pure data (no logic), so it lives in `@blend65/core` and is shared by
 * `frontend` without importing `@blend65/codegen`.
 */

import type { Type } from "../semantics/type.js";

/**
 * One parameter or local in a function's frame input.
 *
 * The `byRef` flag marks a by-reference struct/array parameter that is BOUND
 * to a zero-page pointer pair — one the body accesses through its pointer.
 * The pointer-pool sizing and pair coloring key on it. Frame SLOT sizing does
 * not: every struct/array parameter takes a 2-byte pointer slot by its type
 * and kind alone, so a dead or pass-through-only by-ref parameter carries
 * `byRef: false` (no pair, no pool bytes) yet still frames at 2 bytes.
 */
export interface FrameVar {
  /** The variable's declared name (unique within its function's frame). */
  readonly name: string;
  /** The resolved semantic type of the variable. */
  readonly type: Type;
  /** `true` for a pair-bound by-reference parameter (consumes pointer-pool bytes). */
  readonly byRef: boolean;
}

/**
 * The SFA-owned, flat view of one function — the planner's input unit.
 *
 * Carries the function's fully-qualified name, its ordered parameters and locals
 * (each a {@link FrameVar}), the three always-live flags the interference/coloring
 * and stack passes consult, and the outgoing call edges (the call-graph
 * projection). Built by fixtures in tests, and by `modelToFunctionInfo` once a
 * populated semantic model is available — with no change to any SFA pass.
 */
export interface FunctionInfo {
  /** Fully-qualified `module.function` (e.g. `"Game.update"`). */
  readonly name: string;
  /** Parameters in declaration order (placed first in the frame). */
  readonly parameters: readonly FrameVar[];
  /** Locals in declaration order (placed after the parameters). */
  readonly locals: readonly FrameVar[];
  /** `true` for an interrupt handler — always-live in the interference graph. */
  readonly isInterrupt: boolean;
  /** `true` if the function's address is taken (`&fn`) — always-live. */
  readonly isEscaped: boolean;
  /** `true` if called/exported/address-taken; unreachable functions are excluded. */
  readonly isReachable: boolean;
  /**
   * `true` when this function is reachable along call edges from an interrupt
   * handler. The whole set joins the always-live interference tier: an
   * interrupt can fire while any mainline function is live, so these frames
   * (and their pointer pairs) must never share memory with anything. Absent
   * means `false`.
   */
  readonly isIrqReachable?: boolean;
  /**
   * `true` when this function is reachable ONLY from interrupt handlers —
   * never from `main`, the module initializer, or an escaped non-interrupt
   * function. Interrupt-only functions draw spill temps from the separate
   * irq pool and stage pointer formation through the irq scratch pair.
   * Absent means `false`.
   */
  readonly isIrqOnly?: boolean;
  /** Outgoing call edges, by callee fully-qualified name (call-graph projection). */
  readonly callees: readonly string[];
  /**
   * Functions (fully-qualified names, sorted, deduplicated) that may execute
   * while THIS function's arguments are being marshalled: everything reachable
   * from a call nested in an argument after the first. Arguments are stored
   * into this function's frame slots one by one, so anything that runs during
   * that window must not share frame bytes with it — the interference pass
   * unions these as extra edges.
   */
  readonly argWindowInterferes: readonly string[];
}

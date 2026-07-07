/**
 * Frame and interference-graph records for the SFA planner.
 *
 * A {@link FunctionFrame} is the per-function result of the frame-computation pass
 * (frontend `sfa/frame-computation.ts`): the ordered slots (parameters first, then
 * locals, no padding) and the total frame size. The {@link InterferenceGraph}
 * captures which functions may be simultaneously live (so their frames must not
 * overlap) and is consumed by the coloring and ZP-pointer-sharing passes.
 *
 * Pure data — lives in `@blend65/core`, shared without importing codegen, so
 * `frontend` and `language-server` can consume the same frame model.
 */

import type { Type } from "../semantics/type.js";

/**
 * One slot in a function's frame — a placed parameter or local.
 *
 * `size` is the slot's byte size per the type-size table (struct/array params are
 * 2-byte pointers); `offset` is the running byte offset from the frame base
 * (parameters are laid out first, then locals, with no alignment padding).
 */
export interface FrameSlot {
  /** The slot's variable name. */
  readonly name: string;
  /** Whether this slot holds a parameter or a local. */
  readonly kind: "parameter" | "local";
  /** The resolved semantic type of the variable. */
  readonly type: Type;
  /** The slot's byte size per the type-size table. */
  readonly size: number;
  /** Byte offset from the frame base (params first, then locals; no padding). */
  readonly offset: number;
}

/**
 * The computed frame for one function.
 *
 * Slots are ordered parameters-first then locals, each in declaration order; the
 * `totalSize` is the sum of slot sizes with no padding. The three always-live
 * flags are carried through from the {@link FunctionInfo} so the coloring pass can
 * treat interrupt/escaped/`main` frames as interfering with all others.
 */
export interface FunctionFrame {
  /** Fully-qualified function name (matches the source {@link FunctionInfo}). */
  readonly functionName: string;
  /** Placed slots: parameters first, then locals, each in declaration order. */
  readonly slots: readonly FrameSlot[];
  /** Σ of slot sizes, with no alignment padding. */
  readonly totalSize: number;
  /** Carried from the input: interrupt handler (always-live). */
  readonly isInterrupt: boolean;
  /** Carried from the input: address-taken (always-live). */
  readonly isEscaped: boolean;
  /** Carried from the input: reachable (unreachable frames are excluded). */
  readonly isReachable: boolean;
}

/**
 * The interference graph over function frames.
 *
 * Two functions *interfere* when they may be simultaneously live on the stack
 * (ancestor-descendant call pairs; interrupt/escaped/`main` interfere with all).
 * Interfering frames must not share memory; non-interfering frames may. The graph
 * is symmetric: if `a` interferes with `b`, then `b` interferes with `a`.
 */
export interface InterferenceGraph {
  /** The reachable function names that have a node (unreachable excluded). */
  readonly nodes: ReadonlySet<string>;
  /** Adjacency: function name → the set of names it interferes with (symmetric). */
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>;
}

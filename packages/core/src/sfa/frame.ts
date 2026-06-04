/**
 * Frame and interference-graph records for the SFA planner (RD-05 §4.2/§4.3,
 * R1–R6, R10–R18; spec Ch 11 §3.1/§3.3/§3.4).
 *
 * A {@link FunctionFrame} is the per-function result of the frame-computation pass
 * (frontend `sfa/frame-computation.ts`): the ordered slots (parameters first, then
 * locals, no padding) and the total frame size. The {@link InterferenceGraph}
 * captures which functions may be simultaneously live (so their frames must not
 * overlap) and is consumed by the coloring and ZP-pointer-sharing passes.
 *
 * Pure data — lives in `@blend65/core`, shared without importing codegen
 * (R15/AR-20). See plans/rd-05-sfa-frame-planner/03-01-frame-model.md and
 * 03-02-interference-and-coloring.md.
 */

import type { Type } from "../semantics/type.js";

/**
 * One slot in a function's frame — a placed parameter or local (RD-05 §4.2, R2).
 *
 * `size` is the slot's byte size per the Ch 11 §3.3 type-size table (struct/array
 * params are 2-byte pointers); `offset` is the running byte offset from the frame
 * base (parameters are laid out first, then locals, with no alignment padding, R3).
 */
export interface FrameSlot {
  /** The slot's variable name. */
  readonly name: string;
  /** Whether this slot holds a parameter or a local. */
  readonly kind: "parameter" | "local";
  /** The resolved semantic type of the variable. */
  readonly type: Type;
  /** The slot's byte size per the §3.3 table (R2). */
  readonly size: number;
  /** Byte offset from the frame base (params first, then locals; no padding, R3). */
  readonly offset: number;
}

/**
 * The computed frame for one function (RD-05 §4.2, R1/R3/R6).
 *
 * Slots are ordered parameters-first then locals, each in declaration order; the
 * `totalSize` is the sum of slot sizes with no padding. The three always-live
 * flags are carried through from the {@link FunctionInfo} so the coloring pass can
 * treat interrupt/escaped/`main` frames as interfering with all others.
 */
export interface FunctionFrame {
  /** Fully-qualified function name (matches the source {@link FunctionInfo}). */
  readonly functionName: string;
  /** Placed slots: parameters first, then locals, each in declaration order (R6). */
  readonly slots: readonly FrameSlot[];
  /** Σ of slot sizes, with no alignment padding (R3). */
  readonly totalSize: number;
  /** Carried from the input: interrupt handler (always-live, R14). */
  readonly isInterrupt: boolean;
  /** Carried from the input: address-taken (always-live, R15). */
  readonly isEscaped: boolean;
  /** Carried from the input: reachable (unreachable frames are excluded, R17). */
  readonly isReachable: boolean;
}

/**
 * The interference graph over function frames (RD-05 §4.3, R10–R17).
 *
 * Two functions *interfere* when they may be simultaneously live on the stack
 * (ancestor-descendant call pairs; interrupt/escaped/`main` interfere with all).
 * Interfering frames must not share memory; non-interfering frames may. The graph
 * is symmetric: if `a` interferes with `b`, then `b` interferes with `a`.
 */
export interface InterferenceGraph {
  /** The reachable function names that have a node (unreachable excluded, R17). */
  readonly nodes: ReadonlySet<string>;
  /** Adjacency: function name → the set of names it interferes with (symmetric). */
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>;
}

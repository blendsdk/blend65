/**
 * IL control-flow-graph records — basic blocks, functions, and the whole
 * program.
 *
 * The IL is organized as a per-function CFG: an {@link ILFunction} owns an
 * ordered list of {@link BasicBlock}s, each a straight-line run of
 * {@link ILInstruction}s ending in exactly one {@link ILTerminator}. The
 * {@link ILProgram} aggregates all functions plus module-init code, constant
 * data, and the carried {@link AllocationPlan} that codegen consumes.
 *
 * Every record is `readonly` — immutability is a contract: the optimizer
 * reads, codegen reads, nobody mutates in place. Records plus one pure
 * successor helper ({@link terminatorTargets}) — no other behavior lives here.
 */

import type { AllocationPlan } from "@blend65/core";
import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { ILOperand } from "./operand.js";
import type { ILType } from "./il-type.js";

/**
 * A straight-line run of instructions ending in one terminator.
 *
 * Blocks have no fall-through: control leaves a block only via its
 * {@link ILTerminator}. Labels are unique within the owning function and are
 * generated deterministically by the builder (`_entry`, `_L0`, `_L1`, …).
 */
export interface BasicBlock {
  /** Unique label within the function (`"_entry"`, `"_L0"`, …). */
  readonly label: string;
  /** The block's instructions, in execution order. */
  readonly instructions: readonly ILInstruction[];
  /** The single control-flow operation that ends the block. */
  readonly terminator: ILTerminator;
}

/**
 * The branch-target labels of a terminator, in declaration order.
 *
 * The single place a terminator's outgoing edges are enumerated: the
 * translator's target validation and the reachability walk behind startup-shim
 * selection both read it, so neither can drift from the other or quietly
 * forget a terminator kind. Callers that treat some edge specially (a constant
 * condition follows only its taken edge, say) layer that on top rather than
 * re-deriving the edge set.
 *
 * @param t The terminator to enumerate.
 * @returns Its targets — one for `br`, true-then-false for the conditional
 *   forms, none for `ret` and `unreachable`.
 *
 * @example
 * terminatorTargets({ kind: "br", target: "_L0" });   // ["_L0"]
 * terminatorTargets({ kind: "ret" });                 // []
 */
export function terminatorTargets(t: ILTerminator): readonly string[] {
  switch (t.kind) {
    case "br":
      return [t.target];
    case "brcond":
    case "brcmp":
      return [t.trueTarget, t.falseTarget];
    case "ret":
    case "unreachable":
      return [];
    default: {
      // Exhaustiveness guard: a new terminator kind without a case here is a
      // compile error naming the kind, never a silently dropped edge.
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

/**
 * One lowered function as a CFG.
 *
 * `blocks[0]` is always the entry block (`_entry`). `params` are the
 * incoming parameters as `Location` operands drawn from the `AllocationPlan`.
 * `returnType` is an {@link ILType} or the literal `"void"`.
 */
export interface ILFunction {
  /** Fully-qualified function name (`"Module.function"`). */
  readonly name: string;
  /** Parameters as plan-backed `Location` operands, in declaration order. */
  readonly params: readonly ILOperand[];
  /** The IL return type, or `"void"` for value-less functions. */
  readonly returnType: ILType | "void";
  /** The CFG blocks; `blocks[0]` is the entry block. */
  readonly blocks: readonly BasicBlock[];
  /** Total number of virtual temps used by this function. */
  readonly tempCount: number;
  /** `true` if this function is an interrupt handler (affects codegen ABI). */
  readonly isInterrupt: boolean;
}

/**
 * A boundary a const image can be placed on, in bytes.
 *
 * Closed deliberately, and this is the reason: ACME's `!align` takes a bitmask
 * rather than a modulus, so the emitted directive is derived as `boundary - 1`.
 * That derivation is only meaningful for a power of two — any other value
 * assembles cleanly, appears in the listing, and aligns nothing, which shows up
 * as a sprite reading from the wrong block with no diagnostic anywhere. Naming
 * the two boundaries the hardware actually dereferences in makes the mistake
 * unrepresentable instead of merely warned about.
 */
export type AlignBoundary = 64 | 256;

/**
 * A blob of constant data emitted into the binary.
 *
 * Produced for array/struct literals and `embed`ded data (the embed arm is
 * tagged from the const value's provenance).
 */
export interface ConstDataEntry {
  /** The ACME label this data is emitted under. */
  readonly symbol: string;
  /** The raw bytes. */
  readonly data: Uint8Array;
  /** What produced the entry, for emitter formatting. */
  readonly type: "array" | "struct" | "embed";
  /**
   * The boundary this image must start on, in bytes — absent when nothing
   * demands one.
   *
   * A demand comes from a source-level `&` on the aggregate, the only way a
   * program can hand the raw address to hardware that reads in page or block
   * units, and its value follows the arithmetic the source writes around it:
   * naming a 64-byte block demands 64, any other form demands a page, and a
   * symbol named both ways takes the coarser of the two. Passing the aggregate
   * by reference demands nothing — the compiler's own indexed access does not
   * care where the data sits, and aligning every table ever passed to a helper
   * would cost padding for nothing.
   */
  readonly boundary?: AlignBoundary;
}

/**
 * The whole lowered program.
 *
 * Aggregates every {@link ILFunction}, the module-initializer stream, constant
 * data, and the {@link AllocationPlan} carried through for codegen.
 * `initCode` holds the lowered module-variable initializers (in dependency
 * order, closed by `ret`) and is empty when no module variable has an
 * initializer; `constData` is present in the shape but **empty** until
 * const/embed data lowering lands.
 */
export interface ILProgram {
  /** Every lowered function, in deterministic order. */
  readonly functions: readonly ILFunction[];
  /** The module-initializer blocks (empty when nothing is initialized). */
  readonly initCode: readonly BasicBlock[];
  /** Virtual-temp count of the init stream (`0` when `initCode` is empty). */
  readonly initTempCount: number;
  /** Constant data blobs (empty until const/embed lowering lands). */
  readonly constData: readonly ConstDataEntry[];
  /** The SFA plan, carried to codegen unchanged. */
  readonly allocationPlan: AllocationPlan;
}

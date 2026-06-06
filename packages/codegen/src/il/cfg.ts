/**
 * IL control-flow-graph records — basic blocks, functions, and the whole
 * program (RD-06 §4.4–§4.5, R12/R15/R16/R64–R67).
 *
 * The IL is organized as a per-function CFG: an {@link ILFunction} owns an
 * ordered list of {@link BasicBlock}s, each a straight-line run of
 * {@link ILInstruction}s ending in exactly one {@link ILTerminator}. The
 * {@link ILProgram} aggregates all functions plus module-init code, constant
 * data, and the carried {@link AllocationPlan} that codegen (RD-07) consumes.
 *
 * Every record is `readonly` — immutability is a contract (R67): the optimizer
 * reads, codegen reads, nobody mutates in place. Pure data, no behavior.
 */

import type { AllocationPlan } from "@blend65/core";
import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { ILOperand } from "./operand.js";
import type { ILType } from "./il-type.js";

/**
 * A straight-line run of instructions ending in one terminator (§4.4, R12).
 *
 * Blocks have no fall-through: control leaves a block only via its
 * {@link ILTerminator}. Labels are unique within the owning function and are
 * generated deterministically by the builder (`_entry`, `_L0`, `_L1`, …; R15).
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
 * One lowered function as a CFG (§4.4, R16).
 *
 * `blocks[0]` is always the entry block (`_entry`, R16). `params` are the
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
  /** The CFG blocks; `blocks[0]` is the entry block (R16). */
  readonly blocks: readonly BasicBlock[];
  /** Total number of virtual temps used by this function. */
  readonly tempCount: number;
  /** `true` if this function is an interrupt handler (affects codegen ABI). */
  readonly isInterrupt: boolean;
}

/**
 * A blob of constant data emitted into the binary (§4.5, R64).
 *
 * Produced for array/struct literals and `embed`ded data. Empty in v1 — const
 * and embed lowering arrive with their slices.
 */
export interface ConstDataEntry {
  /** The ACME label this data is emitted under. */
  readonly symbol: string;
  /** The raw bytes. */
  readonly data: Uint8Array;
  /** What produced the entry, for emitter formatting. */
  readonly type: "array" | "struct" | "embed";
}

/**
 * The whole lowered program (§4.5, R64–R67).
 *
 * Aggregates every {@link ILFunction}, the module-level init code, constant
 * data, and the {@link AllocationPlan} carried through for codegen (R66).
 * `initCode` and `constData` are present in the shape (R64) but **empty in v1** —
 * module-variable init ordering (AR-91) and const/embed data arrive with their
 * slices.
 */
export interface ILProgram {
  /** Every lowered function, in deterministic order. */
  readonly functions: readonly ILFunction[];
  /** Module-level startup/init blocks (empty in v1). */
  readonly initCode: readonly BasicBlock[];
  /** Constant data blobs (empty in v1). */
  readonly constData: readonly ConstDataEntry[];
  /** The SFA plan, carried to codegen (RD-07) unchanged (R66). */
  readonly allocationPlan: AllocationPlan;
}

import type { BinaryOperation } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import type { FunctionLoweringState } from "./lower-state.js";

/**
 * Materialize a modeled zero test as the expert hand-written Boolean branch.
 *
 * The masked byte is already in A and its `AND` already set Z. The current
 * machine block ends with a branch; the arms load the canonical 0/1 value and
 * fall through to the continuation. No storage request, helper call or data
 * object is created, so the NMI private-home proof is untouched.
 *
 * @param operation The selected `== 0`/`!= 0` comparison.
 * @param state Exact selected CPU and source span.
 * @param entryLabel Label of the block that already contains the masked value.
 * @param prefix Instructions already emitted into that block.
 * @param ordinal Monotone per-block split index for unique labels.
 * @returns The split blocks and the continuation label for the remaining source.
 */
export function lowerBooleanBranch(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const cpu = state.input.profile.cpu;
  const nonzeroLabel = `${entryLabel}.boolean.${ordinal}.nonzero`;
  const zeroLabel = `${entryLabel}.boolean.${ordinal}.zero`;
  const continuation = `${entryLabel}.boolean.${ordinal}.continue`;
  const branch = (target: string, fallthrough: string): MachineBlock["terminator"] =>
    Object.freeze({
      kind: "branch",
      opcode: "beq",
      target,
      fallthrough,
      uses: machineState([], ["z"]),
      cost: machineCost(cpu, "beq", "relative"),
    });
  const loadOne = machineInstruction(
    cpu,
    "lda",
    "immediate",
    Object.freeze({ kind: "immediate", value: 1 }),
    [],
    operation.span,
  );
  const invert = machineInstruction(
    cpu,
    "eor",
    "immediate",
    Object.freeze({ kind: "immediate", value: 1 }),
    [],
    operation.span,
  );
  const blocks: readonly MachineBlock[] =
    operation.operator === "!="
      ? Object.freeze([
          Object.freeze({
            label: entryLabel,
            instructions: Object.freeze([...prefix]),
            terminator: branch(continuation, nonzeroLabel),
          }),
          Object.freeze({
            label: nonzeroLabel,
            instructions: Object.freeze([loadOne]),
            terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
          }),
        ])
      : Object.freeze([
          Object.freeze({
            label: entryLabel,
            instructions: Object.freeze([...prefix]),
            terminator: branch(zeroLabel, nonzeroLabel),
          }),
          Object.freeze({
            label: nonzeroLabel,
            instructions: Object.freeze([loadOne]),
            terminator: Object.freeze({ kind: "fallthrough" as const, target: zeroLabel }),
          }),
          Object.freeze({
            label: zeroLabel,
            instructions: Object.freeze([invert]),
            terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
          }),
        ]);
  return Object.freeze({ blocks, continuation });
}

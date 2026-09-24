import type { BinaryOperation } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState, operandForValue } from "./lower-control.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import { isSignedType, loweringFailure, type FunctionLoweringState, typeBytes } from "./lower.js";
import { lowerOperation } from "./lower-operation.js";

/** Split a selected divider call after its operand staging, before any division executes. */
export function lowerCheckedDivision(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const instructions = lowerOperation(operation, state);
  const width = typeBytes(operation.type);
  const signed = isSignedType(operation.type);
  const helper = state.divideHelpers.get(`${width}:${signed}`);
  if (helper === undefined)
    throw loweringFailure("Checked divider has no selected helper", operation.span);
  const callIndex = instructions.findIndex(
    ({ opcode, operand }) =>
      opcode === "jsr" && operand?.kind === "label" && operand.label === helper.label,
  );
  if (callIndex < 0) throw loweringFailure("Checked divider has no call boundary", operation.span);
  const cpu = state.input.profile.cpu;
  const callLabel = `${entryLabel}.divide.${ordinal}.call`;
  const stopLabel = `${entryLabel}.divide.${ordinal}.zero-stop`;
  const continuation = `${entryLabel}.divide.${ordinal}.continue`;
  const test = [...prefix, ...instructions.slice(0, callIndex)];
  test.push(
    machineInstruction(
      cpu,
      "lda",
      "storage",
      operandForValue(helper.divisor, 0),
      [],
      operation.span,
    ),
  );
  if (width === 2) {
    test.push(
      machineInstruction(
        cpu,
        "ora",
        "storage",
        operandForValue(helper.divisor, 1),
        [],
        operation.span,
      ),
    );
  }
  const blocks: readonly MachineBlock[] = Object.freeze([
    Object.freeze({
      label: entryLabel,
      instructions: Object.freeze(test),
      terminator: Object.freeze({
        kind: "branch",
        opcode: "beq",
        target: stopLabel,
        fallthrough: callLabel,
        uses: machineState([], ["z"]),
        cost: machineCost(cpu, "beq", "relative"),
      }),
    }),
    Object.freeze({
      label: callLabel,
      instructions: Object.freeze(instructions.slice(callIndex)),
      terminator: Object.freeze({ kind: "fallthrough", target: continuation }),
    }),
    Object.freeze({
      label: stopLabel,
      instructions: Object.freeze([
        machineInstruction(cpu, "sei", "implied", null, [], operation.span),
      ]),
      terminator: Object.freeze({
        kind: "jump",
        opcode: "jmp",
        target: stopLabel,
        cost: machineCost(cpu, "jmp", "absolute"),
      }),
    }),
  ]);
  return Object.freeze({ blocks, continuation });
}

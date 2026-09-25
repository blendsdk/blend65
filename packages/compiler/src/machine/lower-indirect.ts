import type { BindingId } from "../frontend/semantic-types.js";
import type { IndirectCallOperation } from "../semantic/operations.js";
import { lowerOperation } from "./lower-operation.js";
import { machineCost, machineInstruction, machineState, operandForValue } from "./lower-control.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  bindingLabel,
  loweringFailure,
  retainMachineValue,
  typeBytes,
  type FunctionLoweringState,
} from "./lower.js";

/** Lower one proved candidate with its own certified static parameter homes. */
function directArm(
  operation: IndirectCallOperation,
  callee: BindingId,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  return lowerOperation(Object.freeze({ ...operation, kind: "call" as const, callee }), state);
}

/** Choose a bounded comparison chain, with the final proved candidate as the default. */
export function lowerIndirectCall(
  operation: IndirectCallOperation,
  targets: readonly BindingId[],
  state: FunctionLoweringState,
  currentLabel: string,
  currentInstructions: readonly MachineInstruction[],
  index: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly continuationInstructions: readonly MachineInstruction[];
} {
  if (targets.length === 0) {
    throw loweringFailure("Indirect call has no finite source target", operation.span);
  }
  if (targets.length === 1) {
    return Object.freeze({
      blocks: Object.freeze([]),
      continuation: currentLabel,
      continuationInstructions: Object.freeze([
        ...currentInstructions,
        ...directArm(operation, targets[0]!, state),
      ]),
    });
  }
  const target = state.values.get(operation.target);
  if (target === undefined || target.kind === "condition") {
    throw loweringFailure("Indirect target was not retained", operation.span);
  }
  if (target.kind === "register") {
    throw loweringFailure("Indirect target was not staged before its arguments", operation.span);
  }
  const cpu = state.input.profile.cpu;
  const prefix = `${state.currentSemanticBlockId}.indirect.${index}`;
  // A no-argument scalar call can tail-jump from a local thunk. Its JSR return
  // address remains on the stack, and the target's ordinary RTS returns A/AX.
  const home =
    target.kind === "storage"
      ? state.input.placement.homes.find(({ requestId }) => requestId === target.requestId)
      : undefined;
  const pointer =
    home === undefined ? -1 : home.address + (target.kind === "storage" ? (target.offset ?? 0) : 0);
  if (
    operation.arguments.length === 0 &&
    (operation.type.kind === "scalar" ||
      operation.type.kind === "enum" ||
      operation.type.kind === "function") &&
    target.kind === "storage" &&
    home?.region === "ram" &&
    home.bytes >= (target.offset ?? 0) + 2 &&
    (pointer & 0xff) !== 0xff
  ) {
    const thunk = `${prefix}.thunk`;
    state.helperBlocks.push(
      Object.freeze({
        label: thunk,
        instructions: Object.freeze([
          machineInstruction(cpu, "jmp", "indirect", operandForValue(target), [], operation.span),
        ]),
        terminator: Object.freeze({ kind: "unreachable" }),
      }),
    );
    const instructions: MachineInstruction[] = [
      ...currentInstructions,
      machineInstruction(
        cpu,
        "jsr",
        "absolute",
        Object.freeze({ kind: "label", label: thunk }),
        [],
        operation.span,
      ),
    ];
    if (operation.result !== null) {
      const bytes = typeBytes(operation.type) === 1 ? 1 : 2;
      const retained = retainMachineValue(
        operation.result,
        Object.freeze({ kind: "register", registers: bytes === 1 ? "a" : "ax", bytes }),
        instructions,
        operation.type,
        operation.span,
        state,
      );
      state.values.set(operation.result, retained.value);
      return Object.freeze({
        blocks: Object.freeze([]),
        continuation: currentLabel,
        continuationInstructions: retained.instructions,
      });
    }
    return Object.freeze({
      blocks: Object.freeze([]),
      continuation: currentLabel,
      continuationInstructions: Object.freeze(instructions),
    });
  }
  const continuation = `${prefix}.continue`;
  const blocks: MachineBlock[] = [];
  let label = currentLabel;
  let instructions = [...currentInstructions];
  for (let candidate = 0; candidate < targets.length - 1; candidate += 1) {
    const callee = targets[candidate]!;
    const next = `${prefix}.candidate.${candidate + 1}`;
    const high = `${prefix}.high.${candidate}`;
    const arm = `${prefix}.call.${candidate}`;
    appendLoadA(instructions, target, 0, state, operation.span);
    instructions.push(
      machineInstruction(
        cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "label", label: bindingLabel("fn", callee), addressByte: "low" }),
        [],
        operation.span,
      ),
    );
    blocks.push(
      Object.freeze({
        label,
        instructions: Object.freeze(instructions),
        terminator: Object.freeze({
          kind: "branch",
          opcode: "bne",
          target: next,
          fallthrough: high,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    const highInstructions: MachineInstruction[] = [];
    appendLoadA(highInstructions, target, 1, state, operation.span);
    highInstructions.push(
      machineInstruction(
        cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "label", label: bindingLabel("fn", callee), addressByte: "high" }),
        [],
        operation.span,
      ),
    );
    blocks.push(
      Object.freeze({
        label: high,
        instructions: Object.freeze(highInstructions),
        terminator: Object.freeze({
          kind: "branch",
          opcode: "bne",
          target: next,
          fallthrough: arm,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    blocks.push(
      Object.freeze({
        label: arm,
        instructions: directArm(operation, callee, state),
        terminator: Object.freeze({
          kind: "jump",
          opcode: "jmp",
          target: continuation,
          cost: machineCost(cpu, "jmp", "absolute"),
        }),
      }),
    );
    label = next;
    instructions = [];
  }
  blocks.push(
    Object.freeze({
      label,
      instructions: directArm(operation, targets[targets.length - 1]!, state),
      terminator: Object.freeze({ kind: "fallthrough", target: continuation }),
    }),
  );
  return Object.freeze({
    blocks: Object.freeze(blocks),
    continuation,
    continuationInstructions: Object.freeze([]),
  });
}

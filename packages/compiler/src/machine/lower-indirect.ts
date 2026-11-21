import type { BindingId } from "../frontend/semantic-types.js";
import { interruptDepthAt, interruptExecutionContexts } from "../semantic/interrupt-contexts.js";
import { interruptCodeContexts } from "../semantic/interrupt-context-facts.js";
import type { IndirectCallOperation } from "../semantic/operations.js";
import type { PlatformOperation } from "../semantic/operations.js";
import type { InterruptRoute } from "../semantic/whole-program.js";
import { hasHandlerSideIrqInstall } from "../storage/inventory.js";
import { calleeNeverReturns } from "./call-returning-facts.js";
import { contextFunctionLabel } from "./interrupt-specialize.js";
import { lowerOperation } from "./lower-operation.js";
import {
  isSignedType,
  machineCost,
  machineInstruction,
  machineState,
  operandForValue,
} from "./lower-control.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  bindingLabel,
  loweringFailure,
  retainMachineValue,
  typeBytes,
  type FunctionLoweringState,
} from "./lower-state.js";

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
  const prefix = `${state.currentSemanticBlockId}.indirect.${index}`;
  // Every route out of this dispatch rejoins under one name, so it is built once.
  const continuation = `${prefix}.continue`;
  if (targets.length === 1) {
    const only = targets[0]!;
    const instructions = Object.freeze([
      ...currentInstructions,
      ...directArm(operation, only, state),
    ]);
    // One proved candidate is called by name, so this is the ordinary call it became and must
    // answer the non-returning shape exactly as that call does. The comparison chain and the
    // thunk already give a candidate that cannot return no executable edge; answering it
    // differently here would let the number of candidates decide whether a program compiles.
    if (calleeNeverReturns(only, state)) {
      return Object.freeze({
        blocks: Object.freeze([
          Object.freeze({
            label: currentLabel,
            instructions,
            terminator: Object.freeze({ kind: "unreachable" as const }),
          }),
        ]),
        continuation,
        continuationInstructions: Object.freeze([]),
      });
    }
    return Object.freeze({
      blocks: Object.freeze([]),
      continuation: currentLabel,
      continuationInstructions: instructions,
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
  // A no-argument scalar call can tail-jump from a local thunk. Its JSR return
  // address remains on the stack, and the target's ordinary RTS returns A/AX.
  const home =
    target.kind === "storage"
      ? state.input.placement?.homes.find(({ requestId }) => requestId === target.requestId)
      : undefined;
  const pointer =
    home === undefined ? -1 : home.address + (target.kind === "storage" ? (target.offset ?? 0) : 0);
  const contexts = interruptCodeContexts(
    interruptExecutionContexts(state.input.program),
    state.input.retainedInterrupts?.contexts ?? new Map(),
  );
  const rootAware =
    state.input.program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") === true ||
    hasHandlerSideIrqInstall(state.input.program, contexts);
  const at = interruptDepthAt(state.interruptDepth, operation, state.input.program);
  // A function value keeps its canonical address. The thunk is valid only
  // when that address already denotes the ABI selected at this call site.
  const hasContextVariant = targets.some((candidate) => {
    const label = bindingLabel("fn", candidate);
    return contextFunctionLabel(label, at, contexts, state.input.program, rootAware) !== label;
  });
  if (
    !hasContextVariant &&
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
        // The pointer can only hold one of these proved candidates, and the block adds no
        // effects of its own, so calling it behaves exactly like calling whichever candidate
        // the pointer names. Recording them keeps that knowledge available to later stages,
        // which would otherwise see only a transfer to an address chosen at run time.
        indirectTargets: Object.freeze(targets.map((candidate) => bindingLabel("fn", candidate))),
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
    // The thunk and its target may use X and the stack; the retained slice
    // re-reads SP before its next stack-relative load.
    state.stackXValid = false;
    state.stackXBulkDepth = null;
    let reached: readonly MachineInstruction[] = Object.freeze([...instructions]);
    if (operation.result !== null) {
      const bytes = typeBytes(operation.type) === 1 ? 1 : 2;
      const retained = retainMachineValue(
        operation.result,
        // Signedness travels with the retained register value and decides whether a later
        // ordering comparison is lowered signed or unsigned. Omitting it compares a negative
        // result as a large unsigned one, so it must match what a direct call records.
        Object.freeze({
          kind: "register",
          registers: bytes === 1 ? "a" : "ax",
          bytes,
          signed: isSignedType(operation.type),
        }),
        instructions,
        operation.type,
        operation.span,
        state,
      );
      state.values.set(operation.result, retained.value);
      reached = retained.instructions;
    }
    // When no candidate can return, execution never comes back from the dispatch, so this
    // block owns no exit of its own and anything written after the call is unreachable. The
    // comparison chain already answers this shape the same way; answering it differently here
    // would make the argument count decide whether the program is accepted at all. The
    // retained result stays: whatever follows still reads it, and unreachable code is legal.
    if (targets.every((candidate) => calleeNeverReturns(candidate, state))) {
      return Object.freeze({
        blocks: Object.freeze([
          Object.freeze({
            label: currentLabel,
            instructions: reached,
            terminator: Object.freeze({ kind: "unreachable" }),
          }),
        ]),
        continuation,
        continuationInstructions: Object.freeze([]),
      });
    }
    return Object.freeze({
      blocks: Object.freeze([]),
      continuation: currentLabel,
      continuationInstructions: reached,
    });
  }
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
        // Keep the ordinary call frame, but do not invent an executable edge
        // after a callee whose existing whole-program summary proves no return.
        // Unknown and returning candidates still join the shared continuation.
        terminator: calleeNeverReturns(callee, state)
          ? Object.freeze({ kind: "unreachable" })
          : Object.freeze({
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
      terminator: calleeNeverReturns(targets[targets.length - 1]!, state)
        ? Object.freeze({ kind: "unreachable" })
        : Object.freeze({ kind: "fallthrough", target: continuation }),
    }),
  );
  return Object.freeze({
    blocks: Object.freeze(blocks),
    continuation,
    continuationInstructions: Object.freeze([]),
  });
}

/** Select one of a finite set of typed handlers without a runtime registry. */
export function lowerInterruptSink(
  operation: PlatformOperation,
  routes: readonly InterruptRoute[],
  state: FunctionLoweringState,
  currentLabel: string,
  currentInstructions: readonly MachineInstruction[],
  index: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
} {
  const target = state.values.get(operation.arguments[0]!);
  if (target === undefined || target.kind === "condition" || target.kind === "register") {
    throw loweringFailure("Interrupt handler value was not staged", operation.span);
  }
  const cpu = state.input.profile.cpu;
  const prefix = `${state.currentSemanticBlockId}.interrupt.${index}`;
  const continuation = `${prefix}.continue`;
  const blocks: MachineBlock[] = [];
  let label = currentLabel;
  let instructions = [...currentInstructions];
  for (let candidate = 0; candidate < routes.length - 1; candidate += 1) {
    const route = routes[candidate]!;
    const next = `${prefix}.candidate.${candidate + 1}`;
    const high = `${prefix}.high.${candidate}`;
    const arm = `${prefix}.install.${candidate}`;
    appendLoadA(instructions, target, 0, state, operation.span);
    instructions.push(
      machineInstruction(
        cpu,
        "cmp",
        "immediate",
        Object.freeze({
          kind: "label",
          label: bindingLabel("fn", route.handler),
          addressByte: "low",
        }),
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
        Object.freeze({
          kind: "label",
          label: bindingLabel("fn", route.handler),
          addressByte: "high",
        }),
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
      Object.freeze({
        label: arm,
        instructions: lowerOperation(operation, state, route),
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
      instructions: lowerOperation(operation, state, routes[routes.length - 1]!),
      terminator: Object.freeze({ kind: "fallthrough", target: continuation }),
    }),
  );
  return Object.freeze({ blocks: Object.freeze(blocks), continuation });
}

import type { SemanticOperation } from "../semantic/operations.js";
import { aggregateDestination, restoreAggregateDestinationPage } from "./lower-aggregate.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import { appendLoadA, loweringFailure, typeBytes, type FunctionLoweringState } from "./lower.js";

/** Fill a large byte array with one scalar load and page-safe counted stores. */
export function lowerAggregateByteFillLoop(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly continuationInstructions: readonly MachineInstruction[];
} {
  if (
    operation.type.kind !== "array" ||
    typeBytes(operation.type.element) !== 1 ||
    operation.fill === null
  ) {
    throw loweringFailure("Counted aggregate fill needs a byte-array fill value", operation.span);
  }
  const { instructions, result, indirect } = aggregateDestination(operation, state);
  const fill = state.values.get(operation.fill);
  if (fill === undefined || fill.kind === "condition") {
    throw loweringFailure("Aggregate fill has no complete lowered value", operation.span);
  }
  const cpu = state.input.profile.cpu;
  appendLoadA(instructions, fill, 0, state, operation.span);
  state.values.set(operation.result, result);
  const blocks: MachineBlock[] = [];
  let currentLabel = entryLabel;
  let pending = [...prefix, ...instructions];
  const pages = Math.ceil(operation.type.length / 256);
  if (indirect && pages >= 4) {
    if (result.kind !== "storage") {
      throw loweringFailure("Aggregate fill pointer has no home", operation.span);
    }
    const fullPages = Math.floor(operation.type.length / 256);
    const partialBytes = operation.type.length % 256;
    const pageLabel = `${entryLabel}.fill.${ordinal}.page`;
    const byteLabel = `${entryLabel}.fill.${ordinal}.byte`;
    const nextPage = `${entryLabel}.fill.${ordinal}.next`;
    pending.push(
      machineInstruction(
        cpu,
        "ldx",
        "immediate",
        Object.freeze({ kind: "immediate", value: fullPages }),
        [],
        operation.span,
      ),
    );
    blocks.push(
      Object.freeze({
        label: currentLabel,
        instructions: Object.freeze(pending),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: pageLabel }),
      }),
    );
    blocks.push(
      Object.freeze({
        label: pageLabel,
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "ldy",
            "immediate",
            Object.freeze({ kind: "immediate", value: 0 }),
            [],
            operation.span,
          ),
        ]),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: byteLabel }),
      }),
    );
    blocks.push(
      Object.freeze({
        label: byteLabel,
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "sta",
            "indirect-indexed-y",
            Object.freeze({ kind: "indirect-y", requestId: result.requestId, offset: 0 }),
            [],
            operation.span,
          ),
          machineInstruction(cpu, "iny", "implied", null, [], operation.span),
        ]),
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne",
          target: byteLabel,
          fallthrough: nextPage,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    const partialLabel = `${entryLabel}.fill.${ordinal}.partial`;
    blocks.push(
      Object.freeze({
        label: nextPage,
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "inc",
            "storage",
            Object.freeze({ kind: "storage", requestId: result.requestId, offset: 1 }),
            [],
            operation.span,
          ),
          machineInstruction(cpu, "dex", "implied", null, [], operation.span),
        ]),
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne",
          target: pageLabel,
          fallthrough: partialLabel,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    if (partialBytes === 0)
      return Object.freeze({
        blocks: Object.freeze(blocks),
        continuation: partialLabel,
        continuationInstructions: restoreAggregateDestinationPage(
          result,
          indirect,
          fullPages,
          operation,
          state,
        ),
      });
    const partialBody = `${partialLabel}.byte`;
    const complete = `${partialLabel}.done`;
    blocks.push(
      Object.freeze({
        label: partialLabel,
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "ldy",
            "immediate",
            Object.freeze({ kind: "immediate", value: 0 }),
            [],
            operation.span,
          ),
        ]),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: partialBody }),
      }),
    );
    blocks.push(
      Object.freeze({
        label: partialBody,
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "sta",
            "indirect-indexed-y",
            Object.freeze({ kind: "indirect-y", requestId: result.requestId, offset: 0 }),
            [],
            operation.span,
          ),
          machineInstruction(cpu, "iny", "implied", null, [], operation.span),
          machineInstruction(
            cpu,
            "cpy",
            "immediate",
            Object.freeze({ kind: "immediate", value: partialBytes }),
            [],
            operation.span,
          ),
        ]),
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne",
          target: partialBody,
          fallthrough: complete,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    return Object.freeze({
      blocks: Object.freeze(blocks),
      continuation: complete,
      continuationInstructions: restoreAggregateDestinationPage(
        result,
        indirect,
        fullPages,
        operation,
        state,
      ),
    });
  }
  for (let page = 0; page < pages; page += 1) {
    if (page > 0 && indirect) {
      if (result.kind !== "storage")
        throw loweringFailure("Aggregate fill pointer has no home", operation.span);
      pending.push(
        machineInstruction(
          cpu,
          "inc",
          "storage",
          Object.freeze({ kind: "storage", requestId: result.requestId, offset: 1 }),
          [],
          operation.span,
        ),
      );
    }
    pending.push(
      machineInstruction(
        cpu,
        "ldy",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
    );
    const loopLabel = `${entryLabel}.fill.${ordinal}.${page}`;
    const nextLabel = `${loopLabel}.done`;
    blocks.push(
      Object.freeze({
        label: currentLabel,
        instructions: Object.freeze(pending),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: loopLabel }),
      }),
    );
    const operand = indirect
      ? result.kind === "storage"
        ? Object.freeze({ kind: "indirect-y" as const, requestId: result.requestId, offset: 0 })
        : null
      : result.kind === "storage"
        ? Object.freeze({
            kind: "storage" as const,
            requestId: result.requestId,
            offset: page * 256,
          })
        : result.kind === "label"
          ? Object.freeze({ kind: "label" as const, label: result.label, offset: page * 256 })
          : null;
    if (operand === null)
      throw loweringFailure("Aggregate fill has no addressable home", operation.span);
    const body: MachineInstruction[] = [
      machineInstruction(
        cpu,
        "sta",
        indirect ? "indirect-indexed-y" : "absolute-y",
        operand,
        [],
        operation.span,
      ),
      machineInstruction(cpu, "iny", "implied", null, [], operation.span),
    ];
    const count = Math.min(256, operation.type.length - page * 256);
    if (count < 256)
      body.push(
        machineInstruction(
          cpu,
          "cpy",
          "immediate",
          Object.freeze({ kind: "immediate", value: count }),
          [],
          operation.span,
        ),
      );
    blocks.push(
      Object.freeze({
        label: loopLabel,
        instructions: Object.freeze(body),
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne",
          target: loopLabel,
          fallthrough: nextLabel,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
    );
    currentLabel = nextLabel;
    pending = [];
  }
  return Object.freeze({
    blocks: Object.freeze(blocks),
    continuation: currentLabel,
    continuationInstructions: restoreAggregateDestinationPage(
      result,
      indirect,
      pages - 1,
      operation,
      state,
    ),
  });
}

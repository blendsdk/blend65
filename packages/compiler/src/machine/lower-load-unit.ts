import { machineInstruction } from "./lower-control.js";
import type { LoweredValue } from "./lower-control.js";
import type { MachineInstruction, MachineOperand } from "./machine-types.js";
import { loweringFailure } from "./lower-state.js";
import type { FunctionLoweringState } from "./lower-state.js";
import type { LoadUnitOperation } from "../semantic/operations.js";
import type { SemanticType } from "../frontend/semantic-types.js";

/** Return the packed byte count of one load unit type. */
function unitBytes(type: SemanticType): number {
  if (type.kind === "struct" || type.kind === "array") return type.size;
  if (type.kind === "enum") return 1;
  if (type.kind === "scalar") {
    if (type.name === "void") return 0;
    if (type.name === "word" || type.name === "sword") return 2;
  }
  return 1;
}

/** Build one immediate address-byte operand for a proved static value. */
function addressOperand(value: LoweredValue, offset: number, byte: "low" | "high"): MachineOperand {
  if (value.kind === "static-address") {
    if (value.requestId !== undefined) {
      return Object.freeze({
        kind: "storage",
        requestId: value.requestId,
        offset: value.offset + offset,
        addressByte: byte,
      });
    }
    if (value.label !== undefined) {
      return Object.freeze({
        kind: "label",
        label: value.label,
        offset: value.offset + offset,
        addressByte: byte,
      });
    }
  }
  if (value.kind === "storage") {
    return Object.freeze({
      kind: "storage",
      requestId: value.requestId,
      offset: (value.offset ?? 0) + offset,
      addressByte: byte,
    });
  }
  if (value.kind === "label") {
    return Object.freeze({
      kind: "label",
      label: value.label,
      offset: (value.offset ?? 0) + offset,
      addressByte: byte,
    });
  }
  throw loweringFailure("Load destination is not a proved static address", null);
}

/** Build one absolute label operand for the per-unit loader scratch object. */
function scratchOperand(id: string, offset: number): MachineOperand {
  return Object.freeze({ kind: "label", label: id, offset });
}

/**
 * Lower the inline KERNAL `SETLFS`/`SETNAM`/`LOAD` sequence.
 *
 * KERNAL LOAD uses zero-page scratch that overlaps the compiler's SFA window, so
 * every value needed across the call lives in a per-unit absolute scratch object.
 * The error vector is redirected to a one-byte `RTS` while LOAD runs so a missing
 * or unreadable file returns `false` instead of aborting the program.
 */
export function lowerLoadUnit(
  operation: LoadUnitOperation,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const destination = state.values.get(operation.destination);
  if (destination === undefined) {
    throw loweringFailure("Load destination address was not evaluated", operation.span);
  }
  const nameId = `compiler.c64.load-unit-name.${operation.unitId}`;
  const scratchId = `compiler.c64.load-unit-scratch.${operation.unitId}`;
  if (!state.generatedData.has(nameId)) {
    state.generatedData.set(
      nameId,
      Object.freeze({
        id: nameId,
        kind: "immutable" as const,
        alignment: 1,
        bytes: Object.freeze([...operation.unitName]),
      }),
    );
  }
  if (!state.generatedData.has(scratchId)) {
    state.generatedData.set(
      scratchId,
      Object.freeze({
        id: scratchId,
        kind: "bss" as const,
        alignment: 1,
        bytes: Object.freeze(new Array<number>(9).fill(0)),
      }),
    );
  }
  const instruction = (
    opcode: string,
    mode: string,
    operand: MachineOperand | null,
    role: "loader" | "callSite" = "callSite",
  ): MachineInstruction =>
    Object.freeze({
      ...machineInstruction(state.input.profile.cpu, opcode, mode, operand, [], operation.span),
      loadUnitRole: role,
    });
  const bytes = unitBytes(operation.unitType);
  const pointer =
    destination.kind === "storage"
      ? { requestId: destination.requestId, offset: destination.offset ?? 0 }
      : null;
  const instructions: MachineInstruction[] = [
    instruction("lda", "immediate", { kind: "immediate", value: 1 }, "loader"),
    instruction("ldx", "zero-page", { kind: "absolute", value: 0xba }, "loader"),
    instruction("ldy", "immediate", { kind: "immediate", value: 0 }, "loader"),
    instruction("jsr", "absolute", { kind: "absolute", value: 0xffba }, "loader"),
    instruction(
      "lda",
      "immediate",
      { kind: "immediate", value: operation.unitName.length },
      "loader",
    ),
    instruction(
      "ldx",
      "immediate",
      {
        kind: "label",
        label: nameId,
        addressByte: "low",
      },
      "loader",
    ),
    instruction(
      "ldy",
      "immediate",
      {
        kind: "label",
        label: nameId,
        addressByte: "high",
      },
      "loader",
    ),
    instruction("jsr", "absolute", { kind: "absolute", value: 0xffbd }, "loader"),
  ];
  if (pointer === null) {
    instructions.push(
      instruction("ldx", "immediate", addressOperand(destination, 0, "low")),
      instruction("ldy", "immediate", addressOperand(destination, 0, "high")),
    );
  } else {
    instructions.push(
      instruction("ldx", "storage", {
        kind: "storage",
        requestId: pointer.requestId,
        offset: pointer.offset,
      }),
      instruction("ldy", "storage", {
        kind: "storage",
        requestId: pointer.requestId,
        offset: pointer.offset + 1,
      }),
    );
  }
  instructions.push(
    instruction("stx", "absolute", scratchOperand(scratchId, 0), "loader"),
    instruction("sty", "absolute", scratchOperand(scratchId, 1), "loader"),
    // Decimal mode is not guaranteed after an external KERNAL call.
    instruction("cld", "implied", null, "loader"),
    instruction("txa", "implied", null, "loader"),
    instruction("clc", "implied", null, "loader"),
    instruction("adc", "immediate", { kind: "immediate", value: bytes & 0xff }, "loader"),
    instruction("sta", "absolute", scratchOperand(scratchId, 2), "loader"),
    instruction("tya", "implied", null, "loader"),
    instruction("adc", "immediate", { kind: "immediate", value: (bytes >> 8) & 0xff }, "loader"),
    instruction("sta", "absolute", scratchOperand(scratchId, 3), "loader"),
    // Suppress KERNAL error and control messages so LOAD returns with carry instead
    // of entering the BASIC warm-start error path.
    instruction("lda", "zero-page", { kind: "absolute", value: 0x9d }, "loader"),
    instruction("sta", "absolute", scratchOperand(scratchId, 8), "loader"),
    instruction("and", "immediate", { kind: "immediate", value: 0x3f }, "loader"),
    instruction("sta", "zero-page", { kind: "absolute", value: 0x9d }, "loader"),
    instruction("lda", "immediate", { kind: "immediate", value: 0 }, "loader"),
    instruction("ldx", "absolute", scratchOperand(scratchId, 0), "loader"),
    instruction("ldy", "absolute", scratchOperand(scratchId, 1), "loader"),
    instruction("jsr", "absolute", { kind: "absolute", value: 0xffd5 }, "loader"),
    instruction("lda", "absolute", scratchOperand(scratchId, 8), "loader"),
    instruction("sta", "zero-page", { kind: "absolute", value: 0x9d }, "loader"),
    // KERNAL LOAD sets STATUS bit 6 (EOI) even on success. Only the low error nibble
    // $00-$0F marks a failed transfer.
    instruction("cld", "implied", null),
    instruction("lda", "zero-page", { kind: "absolute", value: 0x90 }),
    instruction("and", "immediate", { kind: "immediate", value: 0x0f }),
    instruction("sta", "absolute", scratchOperand(scratchId, 6)),
  );
  if (bytes === 0) {
    instructions.push(instruction("lda", "absolute", scratchOperand(scratchId, 6)));
  } else {
    instructions.push(
      instruction("txa", "implied", null),
      instruction("eor", "absolute", scratchOperand(scratchId, 2)),
      instruction("sta", "absolute", scratchOperand(scratchId, 7)),
      instruction("tya", "implied", null),
      instruction("eor", "absolute", scratchOperand(scratchId, 3)),
      instruction("ora", "absolute", scratchOperand(scratchId, 7)),
      instruction("ora", "absolute", scratchOperand(scratchId, 6)),
    );
  }
  instructions.push(
    instruction("cmp", "immediate", { kind: "immediate", value: 1 }),
    instruction("lda", "immediate", { kind: "immediate", value: 0 }),
    instruction("adc", "immediate", { kind: "immediate", value: 0 }),
    instruction("eor", "immediate", { kind: "immediate", value: 1 }),
  );
  state.values.set(
    operation.result,
    Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
  );
  return Object.freeze(instructions);
}

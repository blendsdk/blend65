import { machineInstruction } from "./lower-control.js";
import type { LoweredValue } from "./lower-control.js";
import type { MachineInstruction, MachineOperand } from "./machine-types.js";
import { loweringFailure, requestStorage } from "./lower-state.js";
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

/** Build one absolute or storage address-byte operand for a proved static value. */
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

/**
 * Lower the inline KERNAL `SETLFS`/`SETNAM`/`LOAD` sequence.
 *
 * The destination is either a static address or a compiler temporary holding one. The unit name
 * bytes are written into one compiler-owned temporary and passed to `SETNAM`. The success check is
 * branchless: the KERNAL carry and the returned X/Y end address are combined into one byte.
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
  const result = requestStorage(
    state,
    `load-result:${operation.unitId}`,
    "temporary",
    4,
    "zero-page-required",
    operation.span,
    "Load success and expected-end temporaries",
  );
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
  const instructions: MachineInstruction[] = [];
  instructions.push(
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
    instruction("lda", "immediate", { kind: "immediate", value: 0 }, "loader"),
  );
  if (pointer === null) {
    instructions.push(
      instruction("ldx", "immediate", addressOperand(destination, 0, "low"), "callSite"),
      instruction("ldy", "immediate", addressOperand(destination, 0, "high"), "callSite"),
    );
  } else {
    instructions.push(
      instruction(
        "ldx",
        "storage",
        {
          kind: "storage",
          requestId: pointer.requestId,
          offset: pointer.offset,
        },
        "callSite",
      ),
      instruction(
        "ldy",
        "storage",
        {
          kind: "storage",
          requestId: pointer.requestId,
          offset: pointer.offset + 1,
        },
        "callSite",
      ),
    );
  }
  instructions.push(instruction("jsr", "absolute", { kind: "absolute", value: 0xffd5 }, "loader"));
  // The KERNAL status byte is zero on success. The returned X/Y end address is compared
  // against the evaluated destination plus the exact unit size.
  instructions.push(
    instruction("cld", "implied", null, "callSite"),
    instruction("lda", "zero-page", { kind: "absolute", value: 0x90 }, "callSite"),
    instruction("sta", "storage", { kind: "storage", requestId: result.id, offset: 0 }, "callSite"),
  );
  if (pointer === null) {
    instructions.push(
      instruction("txa", "implied", null),
      instruction("eor", "immediate", addressOperand(destination, bytes, "low")),
      instruction("sta", "storage", { kind: "storage", requestId: result.id, offset: 3 }),
      instruction("tya", "implied", null),
      instruction("eor", "immediate", addressOperand(destination, bytes, "high")),
      instruction("ora", "storage", { kind: "storage", requestId: result.id, offset: 3 }),
      instruction("ora", "storage", { kind: "storage", requestId: result.id, offset: 0 }),
    );
  } else {
    instructions.push(
      instruction("lda", "storage", {
        kind: "storage",
        requestId: pointer.requestId,
        offset: pointer.offset,
      }),
      instruction("clc", "implied", null),
      instruction("adc", "immediate", { kind: "immediate", value: bytes & 0xff }),
      instruction("sta", "storage", { kind: "storage", requestId: result.id, offset: 1 }),
      instruction("lda", "storage", {
        kind: "storage",
        requestId: pointer.requestId,
        offset: pointer.offset + 1,
      }),
      instruction("adc", "immediate", { kind: "immediate", value: (bytes >> 8) & 0xff }),
      instruction("sta", "storage", { kind: "storage", requestId: result.id, offset: 2 }),
      instruction("txa", "implied", null),
      instruction("eor", "storage", { kind: "storage", requestId: result.id, offset: 1 }),
      instruction("sta", "storage", { kind: "storage", requestId: result.id, offset: 3 }),
      instruction("tya", "implied", null),
      instruction("eor", "storage", { kind: "storage", requestId: result.id, offset: 2 }),
      instruction("ora", "storage", { kind: "storage", requestId: result.id, offset: 3 }),
      instruction("ora", "storage", { kind: "storage", requestId: result.id, offset: 0 }),
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

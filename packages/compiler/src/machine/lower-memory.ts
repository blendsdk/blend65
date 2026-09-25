import type { BindingId } from "../frontend/semantic-types.js";
import type { MemoryReadOperation, MemoryWriteOperation } from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import type { CpuFacts } from "../target/nmos6510.js";
import {
  machineInstruction,
  type LoweredValue,
  modeForValue,
  operandForValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineMemoryEffect } from "./machine-types.js";

/** Inputs shared by raw read/write lowering in one execution context. */
export interface RawMemoryLoweringContext {
  /** Selected CPU facts. */
  readonly cpu: CpuFacts;
  /** Current execution owner. */
  readonly owner: BindingId;
  /** Already-lowered semantic values. */
  readonly values: ReadonlyMap<string, LoweredValue>;
  /** Return the one function-owned zero-page pointer request. */
  readonly pointerRequest: (source: MemoryReadOperation | MemoryWriteOperation) => StorageRequest;
  /** Return the preplanned one-byte home used only while a word read loads its high byte. */
  readonly lowByteRequest?: (source: MemoryReadOperation) => string;
}

/** Create one ordered volatile effect through the selected zero-page pointer. */
function indirectEffect(
  kind: "read" | "write",
  requestId: string,
  order: number,
): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "indirect-y", requestId, offset: order }),
    width: 1,
    volatile: true,
    order,
  });
}

/** Keep each fixed volatile byte at its actual machine address, including $FFFF wrap. */
function absoluteEffect(
  kind: "read" | "write",
  address: number,
  order: number,
): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "absolute", value: address }),
    width: 1,
    volatile: true,
    order,
  });
}

/** Load a semantic byte into A from its retained value. */
function loadA(
  value: LoweredValue,
  offset: number,
  cpu: CpuFacts,
  source: MemoryReadOperation["span"] | MemoryWriteOperation["span"],
): MachineInstruction {
  return machineInstruction(
    cpu,
    "lda",
    modeForValue(value, offset),
    operandForValue(value, offset),
    [],
    source,
  );
}

/** Initialize the zero-page pointer exactly once from an already evaluated address. */
function setPointer(
  address: LoweredValue,
  requestId: string,
  cpu: CpuFacts,
  source: MemoryReadOperation["span"] | MemoryWriteOperation["span"],
): readonly MachineInstruction[] {
  return Object.freeze([
    loadA(address, 0, cpu, source),
    machineInstruction(
      cpu,
      "sta",
      "storage",
      Object.freeze({ kind: "storage", requestId, offset: 0 }),
      [],
      source,
    ),
    loadA(address, 1, cpu, source),
    machineInstruction(
      cpu,
      "sta",
      "storage",
      Object.freeze({ kind: "storage", requestId, offset: 1 }),
      [],
      source,
    ),
  ]);
}

/** Lower one dynamic volatile byte/word read with modulo-65536 `(zp),Y` addressing. */
export function lowerMemoryRead(
  operation: MemoryReadOperation,
  context: RawMemoryLoweringContext,
): readonly MachineInstruction[] {
  const address = context.values.get(operation.address);
  if (address === undefined || address.kind === "register" || address.kind === "condition") {
    throw new Error("Raw-memory address has no stable lowered value");
  }
  if (address.kind === "constant") {
    const low = address.value & 0xffff;
    const instructions: MachineInstruction[] = [
      machineInstruction(
        context.cpu,
        "lda",
        "absolute",
        Object.freeze({ kind: "absolute", value: low }),
        [absoluteEffect("read", low, 0)],
        operation.span,
      ),
    ];
    if (operation.width === 2) {
      const high = (low + 1) & 0xffff;
      instructions.push(
        machineInstruction(
          context.cpu,
          "ldx",
          "absolute",
          Object.freeze({ kind: "absolute", value: high }),
          [absoluteEffect("read", high, 1)],
          operation.span,
        ),
      );
    }
    return Object.freeze(instructions);
  }
  const pointer = context.pointerRequest(operation);
  const instructions = [...setPointer(address, pointer.id, context.cpu, operation.span)];
  instructions.push(
    machineInstruction(
      context.cpu,
      "ldy",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
    machineInstruction(
      context.cpu,
      "lda",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: pointer.id, offset: 0 }),
      [indirectEffect("read", pointer.id, 0)],
      operation.span,
    ),
  );
  if (operation.width === 2) {
    const lowByteRequest = context.lowByteRequest?.(operation);
    if (lowByteRequest === undefined) {
      throw new Error("Word raw-memory read has no finite low-byte home");
    }
    instructions.push(
      machineInstruction(
        context.cpu,
        "sta",
        "storage",
        Object.freeze({ kind: "storage", requestId: lowByteRequest, offset: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(context.cpu, "iny", "implied", null, [], operation.span),
      machineInstruction(
        context.cpu,
        "lda",
        "indirect-indexed-y",
        Object.freeze({ kind: "indirect-y", requestId: pointer.id, offset: 0 }),
        [indirectEffect("read", pointer.id, 1)],
        operation.span,
      ),
      machineInstruction(context.cpu, "tax", "implied", null, [], operation.span),
      machineInstruction(
        context.cpu,
        "lda",
        "storage",
        Object.freeze({ kind: "storage", requestId: lowByteRequest, offset: 0 }),
        [],
        operation.span,
      ),
    );
  }
  return Object.freeze(instructions);
}

/** Lower one dynamic volatile byte/word write with low-byte-first ordering. */
export function lowerMemoryWrite(
  operation: MemoryWriteOperation,
  context: RawMemoryLoweringContext,
): readonly MachineInstruction[] {
  const address = context.values.get(operation.address);
  const value = context.values.get(operation.value);
  if (
    address === undefined ||
    value === undefined ||
    address.kind === "register" ||
    address.kind === "condition" ||
    value.kind === "register" ||
    value.kind === "condition"
  ) {
    throw new Error("Raw-memory write has no stable lowered address/value");
  }
  if (address.kind === "constant") {
    const instructions: MachineInstruction[] = [];
    for (let offset = 0; offset < operation.width; offset += 1) {
      const target = (address.value + offset) & 0xffff;
      instructions.push(
        loadA(value, offset, context.cpu, operation.span),
        machineInstruction(
          context.cpu,
          "sta",
          "absolute",
          Object.freeze({ kind: "absolute", value: target }),
          [absoluteEffect("write", target, offset)],
          operation.span,
        ),
      );
    }
    return Object.freeze(instructions);
  }
  const pointer = context.pointerRequest(operation);
  const instructions = [...setPointer(address, pointer.id, context.cpu, operation.span)];
  instructions.push(
    machineInstruction(
      context.cpu,
      "ldy",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
  );
  for (let offset = 0; offset < operation.width; offset += 1) {
    if (offset > 0) {
      instructions.push(
        machineInstruction(context.cpu, "iny", "implied", null, [], operation.span),
      );
    }
    instructions.push(
      loadA(value, offset, context.cpu, operation.span),
      machineInstruction(
        context.cpu,
        "sta",
        "indirect-indexed-y",
        Object.freeze({ kind: "indirect-y", requestId: pointer.id, offset: 0 }),
        [indirectEffect("write", pointer.id, offset)],
        operation.span,
      ),
    );
  }
  return Object.freeze(instructions);
}

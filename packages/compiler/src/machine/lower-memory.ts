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
import type {
  MachineInstruction,
  MachineMemoryAddress,
  MachineMemoryEffect,
  MachineOperand,
} from "./machine-types.js";

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
  /** Keep one fixed-address byte in X while a later volatile byte is evaluated. */
  readonly byteRegister?: "a" | "x";
  /** Retain source associations only for the explicit size observer path. */
  readonly observerEvidence?: boolean;
}

/**
 * The raw producer identifies its own effective-byte members before any deferral.
 * These associations do not certify bus safety: final checking independently decodes
 * the actual instruction, including pointer and discarded accesses.
 */
function observeRawSequence(
  sequence: readonly MachineInstruction[],
  operation: MemoryReadOperation | MemoryWriteOperation,
  context: RawMemoryLoweringContext,
): readonly MachineInstruction[] {
  if (!context.observerEvidence) return Object.freeze(sequence);
  const address = context.values.get(operation.address);
  const recipe =
    address?.kind === "constant" ||
    address?.kind === "static-address" ||
    address?.kind === "symbol-address" ||
    address?.kind === "label"
      ? "raw-fixed"
      : address?.kind === "ordinal-address"
        ? "raw-indexed"
        : "raw-indirect";
  const addressInput = address?.kind === "ordinal-address" ? address.index : address!;
  const ordinalWrite = operation.kind === "memory-write" && address?.kind === "ordinal-address";
  const index = address?.kind === "ordinal-address" ? address.index : undefined;
  const normalizedIndex = index?.kind === "zero-extended" ? index.low : index;
  const indexPrefix =
    ordinalWrite && normalizedIndex?.kind === "register" && normalizedIndex.registers === "x"
      ? 0
      : 1;
  const rawLength = ordinalWrite ? Math.min(indexPrefix + 1, sequence.length) : sequence.length;
  return Object.freeze(
    sequence.map((instruction, position) => {
      // A proved write evaluates its value between the index setup and the
      // volatile store. The value is ordinary lowering work, not one byte of
      // the raw access, so it keeps no raw association.
      if (ordinalWrite && position >= indexPrefix && position < sequence.length - 1) {
        return instruction;
      }
      const rawPosition = ordinalWrite
        ? position === sequence.length - 1
          ? rawLength - 1
          : position
        : position;
      return Object.freeze({
        ...instruction,
        observerOrigins: Object.freeze([
          Object.freeze({
            kind: "raw" as const,
            operation,
            recipe,
            position: rawPosition,
            length: rawLength,
            byte: instruction.memory.find((effect) => effect.volatile)?.order ?? null,
            addressInput,
          }),
        ]),
      });
    }),
  );
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
export function absoluteEffect(
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

/** Describe one statically resolved address for a direct absolute or storage access. */
function staticAddressForm(
  address: Extract<LoweredValue, { readonly kind: "static-address" | "symbol-address" | "label" }>,
  offset: number,
): {
  readonly mode: string;
  readonly operand: MachineOperand;
  readonly effect: MachineMemoryAddress;
} {
  if (address.kind === "symbol-address") {
    return {
      mode: "absolute",
      operand: Object.freeze({ kind: "label", label: address.label, offset }),
      effect: Object.freeze({ kind: "symbolic", label: address.label, offset }),
    };
  }
  if (address.kind === "label") {
    const displacement = (address.offset ?? 0) + offset;
    return {
      mode: address.zeroPage === true ? "zero-page" : "absolute",
      operand: Object.freeze({ kind: "label", label: address.label, offset: displacement }),
      effect: Object.freeze({ kind: "symbolic", label: address.label, offset: displacement }),
    };
  }
  if (address.requestId === undefined || address.label !== undefined) {
    const displacement = address.offset + offset;
    return {
      mode: address.zeroPage === true ? "zero-page" : "absolute",
      operand: Object.freeze({
        kind: "label",
        label: address.label!,
        offset: displacement,
      }),
      effect: Object.freeze({
        kind: "symbolic",
        label: address.label!,
        offset: displacement,
      }),
    };
  }
  const displacement = address.offset + offset;
  return {
    mode: "storage",
    operand: Object.freeze({ kind: "storage", requestId: address.requestId, offset: displacement }),
    effect: Object.freeze({ kind: "storage", requestId: address.requestId, offset: displacement }),
  };
}

/** Lower a volatile read directly for fixed addresses or through `(zp),Y` for runtime ones. */
export function lowerMemoryRead(
  operation: MemoryReadOperation,
  context: RawMemoryLoweringContext,
): readonly MachineInstruction[] {
  const address = context.values.get(operation.address);
  if (address === undefined || address.kind === "register" || address.kind === "condition") {
    throw new Error("Raw-memory address has no stable lowered value");
  }
  if (address.kind === "ordinal-address") {
    if (operation.width !== 1)
      throw new Error("Proved ordinal raw address is only selected for byte reads");
    const index = address.index.kind === "zero-extended" ? address.index.low : address.index;
    const instructions: MachineInstruction[] = [];
    if (index.kind === "register" && index.registers === "x") {
      // The proved fixed counter already holds this exact ordinal in X.
    } else if (index.kind === "register" && index.registers === "a") {
      instructions.push(
        machineInstruction(context.cpu, "tax", "implied", null, [], operation.span),
      );
    } else {
      instructions.push(
        machineInstruction(
          context.cpu,
          "ldx",
          modeForValue(index),
          operandForValue(index),
          [],
          operation.span,
        ),
      );
    }
    instructions.push(
      machineInstruction(
        context.cpu,
        "lda",
        "absolute-x",
        Object.freeze({ kind: "absolute", value: address.base }),
        [absoluteEffect("read", address.base, 0)],
        operation.span,
      ),
    );
    return observeRawSequence(instructions, operation, context);
  }
  if (address.kind === "constant") {
    const low = address.value & 0xffff;
    const instructions: MachineInstruction[] = [
      machineInstruction(
        context.cpu,
        operation.width === 1 && context.byteRegister === "x" ? "ldx" : "lda",
        low < 0x100 ? "zero-page" : "absolute",
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
          high < 0x100 ? "zero-page" : "absolute",
          Object.freeze({ kind: "absolute", value: high }),
          [absoluteEffect("read", high, 1)],
          operation.span,
        ),
      );
    }
    return observeRawSequence(instructions, operation, context);
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
  return observeRawSequence(instructions, operation, context);
}

/** Lower a fixed or runtime volatile write, preserving low-byte-first order and 16-bit wrap. */
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
    value.kind === "condition"
  ) {
    throw new Error("Raw-memory write has no stable lowered address/value");
  }
  if (address.kind === "static-address" || address.kind === "symbol-address") {
    const instructions: MachineInstruction[] = [];
    for (let offset = 0; offset < operation.width; offset += 1) {
      const form = staticAddressForm(address, offset);
      if (!(value.kind === "register" && value.registers === "a" && offset === 0)) {
        instructions.push(loadA(value, offset, context.cpu, operation.span));
      }
      instructions.push(
        machineInstruction(
          context.cpu,
          "sta",
          form.mode,
          form.operand,
          [
            Object.freeze({
              kind: "write",
              address: form.effect,
              width: 1,
              volatile: true,
              order: offset,
            }),
          ],
          operation.span,
        ),
      );
    }
    return observeRawSequence(instructions, operation, context);
  }
  if (address.kind === "ordinal-address") {
    if (operation.width !== 1) {
      throw new Error("Proved ordinal raw address is only selected for byte writes");
    }
    const index = address.index.kind === "zero-extended" ? address.index.low : address.index;
    const instructions: MachineInstruction[] = [];
    if (index.kind === "register" && index.registers === "x") {
      // The proved counter already holds this exact ordinal in X.
    } else if (index.kind === "register" && index.registers === "a") {
      instructions.push(
        machineInstruction(context.cpu, "tax", "implied", null, [], operation.span),
      );
    } else {
      instructions.push(
        machineInstruction(
          context.cpu,
          "ldx",
          modeForValue(index),
          operandForValue(index),
          [],
          operation.span,
        ),
      );
    }
    if (value.kind === "register" && value.registers === "x") {
      if (!(index.kind === "register" && index.registers === "x")) {
        throw new Error("Ordinal raw write cannot preserve a distinct X-held value");
      }
      instructions.push(
        machineInstruction(context.cpu, "txa", "implied", null, [], operation.span),
      );
    } else if (!(value.kind === "register" && value.registers === "a")) {
      instructions.push(loadA(value, 0, context.cpu, operation.span));
    }
    instructions.push(
      machineInstruction(
        context.cpu,
        "sta",
        "absolute-x",
        Object.freeze({ kind: "absolute", value: address.base }),
        [absoluteEffect("write", address.base, 0)],
        operation.span,
      ),
    );
    return observeRawSequence(instructions, operation, context);
  }
  if (address.kind === "constant") {
    const instructions: MachineInstruction[] = [];
    for (let offset = 0; offset < operation.width; offset += 1) {
      const target = (address.value + offset) & 0xffff;
      if (value.kind === "register") {
        if (operation.width !== 1 || value.registers !== "a") {
          throw new Error("Raw-memory write has no stable lowered value");
        }
      } else {
        instructions.push(loadA(value, offset, context.cpu, operation.span));
      }
      instructions.push(
        machineInstruction(
          context.cpu,
          "sta",
          target < 0x100 ? "zero-page" : "absolute",
          Object.freeze({ kind: "absolute", value: target }),
          [absoluteEffect("write", target, offset)],
          operation.span,
        ),
      );
    }
    return observeRawSequence(instructions, operation, context);
  }
  if (value.kind === "register") {
    throw new Error("Dynamic raw-memory write needs a stable value before address setup");
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
  return observeRawSequence(instructions, operation, context);
}

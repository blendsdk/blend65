import type { SourceSpan } from "../project/types.js";
import type { PlatformOperation } from "../semantic/operations.js";
import type { TargetProfile } from "../target/profile.js";
import type { C64Lowering, C64LoweringSupport } from "./lower-c64.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineMemoryEffect } from "./machine-types.js";

const TIMER_A_LOW = 0x04;
const TIMER_B_LOW = 0x06;
const INTERRUPT_CONTROL = 0x0d;
const CONTROL_A = 0x0e;
const CONTROL_B = 0x0f;

/** Preserve the physical register address, access order, and volatility in machine IR. */
function ciaEffect(kind: "read" | "write", address: number, order: number): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "absolute", value: address }),
    width: 1,
    volatile: true,
    order,
  });
}

/** Emit one direct absolute access without a helper or a computed register pointer. */
function access(
  profile: TargetProfile,
  opcode: "lda" | "ldx" | "sta" | "stx" | "sty",
  kind: "read" | "write",
  address: number,
  order: number,
  source: SourceSpan,
): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    opcode,
    "absolute",
    Object.freeze({ kind: "absolute", value: address }),
    [ciaEffect(kind, address, order)],
    source,
  );
}

/** Read the present counter, not the reload latch, low byte before high byte. */
function counterRead(profile: TargetProfile, address: number, source: SourceSpan): C64Lowering {
  return Object.freeze({
    instructions: Object.freeze([
      access(profile, "lda", "read", address, 0, source),
      access(profile, "ldx", "read", address + 1, 1, source),
    ]),
    result: Object.freeze({ kind: "register", registers: "ax", bytes: 2, signed: false }),
    data: Object.freeze([]),
  });
}

/** Write the reload latch low byte before high byte, with no implicit LOAD strobe. */
function latchWrite(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  address: number,
): C64Lowering {
  const valueId = operation.arguments[0];
  const value = valueId === undefined ? undefined : values.get(valueId);
  if (value === undefined || value.kind === "condition" || value.bytes !== 2) {
    throw new Error(`Platform operation '${operation.capability}' requires a retained word`);
  }
  const source = operation.span;
  const instructions: MachineInstruction[] = [];
  if (value.kind === "register") {
    if (value.registers !== "ax" && value.registers !== "ay") {
      throw new Error("A word argument has no retained high register");
    }
    instructions.push(
      access(profile, "sta", "write", address, 0, source),
      access(profile, value.registers === "ax" ? "stx" : "sty", "write", address + 1, 1, source),
    );
  } else {
    for (const offset of [0, 1]) {
      instructions.push(
        machineInstruction(
          profile.cpu,
          "lda",
          modeForValue(value, offset),
          operandForValue(value, offset),
          [],
          source,
        ),
        access(profile, "sta", "write", address + offset, offset, source),
      );
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result: null, data: [] });
}

/** Make an already evaluated byte current in A without changing its meaning. */
function loadByteA(
  instructions: MachineInstruction[],
  value: LoweredValue,
  profile: TargetProfile,
  source: SourceSpan,
): void {
  if (value.kind === "register") {
    if (value.registers === "x") {
      instructions.push(machineInstruction(profile.cpu, "txa", "implied", null, [], source));
    } else if (value.registers !== "a") {
      throw new Error("Byte argument has no retained accumulator value");
    }
    return;
  }
  instructions.push(
    machineInstruction(profile.cpu, "lda", modeForValue(value), operandForValue(value), [], source),
  );
}

/**
 * Update only timer-owned control fields. The LOAD bit is written once as a strobe;
 * no software copy of the control register or hidden interrupt mask is maintained.
 */
function configureTimer(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  support: C64LoweringSupport,
  address: number,
  accepted: number,
  preserved: number,
): C64Lowering {
  const valueId = operation.arguments[0];
  const value = valueId === undefined ? undefined : values.get(valueId);
  if (value === undefined || value.kind === "condition" || value.bytes !== 1) {
    throw new Error(`Platform operation '${operation.capability}' requires a retained byte`);
  }
  const source = operation.span;
  const instructions: MachineInstruction[] = [];
  let flagsOperand;
  let flagsMode: "immediate" | "storage";
  if (value.kind === "constant") {
    flagsMode = "immediate";
    flagsOperand = Object.freeze({ kind: "immediate" as const, value: value.value & accepted });
  } else {
    // Stage dynamic flags before reading CRA/CRB: that read replaces A. The
    // request joins the function's ordinary SFA closure, never post-closure data.
    const scratch = support.requestScratch(
      "cia-control-flags",
      1,
      source,
      "Timer control flags staged before volatile register read",
    );
    loadByteA(instructions, value, profile, source);
    instructions.push(
      machineInstruction(
        profile.cpu,
        "and",
        "immediate",
        Object.freeze({ kind: "immediate", value: accepted }),
        [],
        source,
      ),
      machineInstruction(
        profile.cpu,
        "sta",
        "storage",
        Object.freeze({ kind: "storage", requestId: scratch.id, offset: 0 }),
        [],
        source,
      ),
    );
    flagsMode = "storage";
    flagsOperand = Object.freeze({ kind: "storage" as const, requestId: scratch.id, offset: 0 });
  }
  instructions.push(
    access(profile, "lda", "read", address, 0, source),
    machineInstruction(
      profile.cpu,
      "and",
      "immediate",
      Object.freeze({ kind: "immediate", value: preserved }),
      [],
      source,
    ),
    machineInstruction(profile.cpu, "ora", flagsMode, flagsOperand, [], source),
    access(profile, "sta", "write", address, 1, source),
  );
  return Object.freeze({ instructions: Object.freeze(instructions), result: null, data: [] });
}

/** Write a bounded source mask once; reading ICR would consume pending IRQ state. */
function writeInterruptMask(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  address: number,
  enabling: boolean,
): C64Lowering {
  const valueId = operation.arguments[0];
  const value = valueId === undefined ? undefined : values.get(valueId);
  if (value === undefined || value.kind === "condition" || value.bytes !== 1) {
    throw new Error(`Platform operation '${operation.capability}' requires a retained byte`);
  }
  const source = operation.span;
  const allowed = enabling ? 0x03 : 0x1f;
  const instructions: MachineInstruction[] = [];
  if (value.kind === "constant") {
    instructions.push(
      machineInstruction(
        profile.cpu,
        "lda",
        "immediate",
        Object.freeze({
          kind: "immediate",
          value: (value.value & allowed) | (enabling ? 0x80 : 0),
        }),
        [],
        source,
      ),
    );
  } else {
    loadByteA(instructions, value, profile, source);
    instructions.push(
      machineInstruction(
        profile.cpu,
        "and",
        "immediate",
        Object.freeze({ kind: "immediate", value: allowed }),
        [],
        source,
      ),
    );
    if (enabling) {
      instructions.push(
        machineInstruction(
          profile.cpu,
          "ora",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0x80 }),
          [],
          source,
        ),
      );
    }
  }
  instructions.push(access(profile, "sta", "write", address, 0, source));
  return Object.freeze({ instructions: Object.freeze(instructions), result: null, data: [] });
}

/** Lower only the CIA operations with a proved direct counter or latch sequence. */
export function lowerC64CiaOperation(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  support: C64LoweringSupport,
): C64Lowering | null {
  const name = operation.capability;
  const cia1 = name.startsWith("c64.cia1.");
  const cia2 = name.startsWith("c64.cia2.");
  if (!cia1 && !cia2) return null;
  const addressBase = cia1 ? profile.machine.cia1Base : profile.machine.cia2Base;
  const method = name.slice("c64.cia1.".length);
  if (method === "readTimerACounter") {
    return counterRead(profile, addressBase + TIMER_A_LOW, operation.span);
  }
  if (method === "readTimerBCounter") {
    return counterRead(profile, addressBase + TIMER_B_LOW, operation.span);
  }
  // CIA2 programming remains under the KERNAL's NMI ownership. Semantic
  // checking must reject it before this machine boundary is reached.
  if (cia2) return null;
  if (method === "writeTimerALatch") {
    return latchWrite(operation, values, profile, addressBase + TIMER_A_LOW);
  }
  if (method === "writeTimerBLatch") {
    return latchWrite(operation, values, profile, addressBase + TIMER_B_LOW);
  }
  if (method === "configureTimerA") {
    return configureTimer(operation, values, profile, support, addressBase + CONTROL_A, 0x19, 0xc6);
  }
  if (method === "configureTimerB") {
    return configureTimer(operation, values, profile, support, addressBase + CONTROL_B, 0x59, 0x86);
  }
  if (method === "enableInterruptSources" || method === "disableInterruptSources") {
    return writeInterruptMask(
      operation,
      values,
      profile,
      addressBase + INTERRUPT_CONTROL,
      method === "enableInterruptSources",
    );
  }
  if (method === "readAndClearPendingSources") {
    return Object.freeze({
      instructions: Object.freeze([
        access(profile, "lda", "read", addressBase + INTERRUPT_CONTROL, 0, operation.span),
      ]),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
      data: Object.freeze([]),
    });
  }
  return null;
}

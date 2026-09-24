import type { SourceSpan } from "../project/types.js";
import type { SemanticTerminator } from "../semantic/operations.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { nmosInstructionForm, nmosInstructionState } from "../target/nmos6510.js";
import type {
  MachineCost,
  MachineInstruction,
  MachineMemoryEffect,
  MachineOperand,
  MachineStateUse,
  MachineTerminator,
} from "./machine-types.js";

/** Value location retained while one semantic function is selected into machine operations. */
export type LoweredValue =
  | {
      readonly kind: "constant";
      readonly value: number;
      readonly bytes: number;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "storage";
      readonly requestId: string;
      readonly bytes: number;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "label";
      readonly label: string;
      readonly bytes: number;
      readonly signed?: boolean;
      readonly transform?: "vic-sprite-block";
      /** Source-owned zero-page data has a proved one-byte physical address. */
      readonly zeroPage?: boolean;
    }
  | {
      readonly kind: "register";
      readonly registers: "a" | "ax";
      readonly bytes: 1 | 2;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "zero-extended";
      readonly low: LoweredValue;
      readonly bytes: 2;
      readonly signed: boolean;
    }
  | {
      readonly kind: "condition";
      readonly whenTrue: string;
      readonly usesFlag: "n" | "v" | "z" | "c";
    };

/** Build an immutable machine-state record. */
export function machineState(
  registers: MachineStateUse["registers"] = [],
  flags: MachineStateUse["flags"] = [],
): MachineStateUse {
  return Object.freeze({ registers: Object.freeze(registers), flags: Object.freeze(flags) });
}

/** Return the exact cost of one documented physical form. */
export function machineCost(cpu: CpuFacts, opcode: string, mode: string): MachineCost {
  const form = nmosInstructionForm(cpu, opcode, mode);
  if (form === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  return Object.freeze({
    bytes: form.bytes,
    minCycles: form.minCycles,
    maxCycles: form.maxCycles,
  });
}

/**
 * Construct one documented instruction, preserving symbolic storage until final binding.
 *
 * A `storage` mode is not a second instruction set. It says only that final closure must choose
 * between the opcode's zero-page and absolute forms. Its provisional cost is the absolute form.
 */
export function machineInstruction(
  cpu: CpuFacts,
  opcode: string,
  mode: string,
  operand: MachineOperand | null,
  memory: readonly MachineMemoryEffect[] = [],
  source: SourceSpan | null = null,
): MachineInstruction {
  const physicalMode = mode === "storage" ? "absolute" : mode;
  const form = nmosInstructionForm(cpu, opcode, physicalMode);
  if (form === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  const state = nmosInstructionState(cpu, opcode, physicalMode);
  if (state === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  return Object.freeze({
    opcode,
    mode,
    operand,
    uses: machineState(state.usesRegisters, state.usesFlags),
    defines: machineState(state.definesRegisters, state.definesFlags),
    memory: Object.freeze(memory),
    cost: Object.freeze({
      bytes: form.bytes,
      minCycles: form.minCycles,
      maxCycles: form.maxCycles,
    }),
    source,
  });
}

/** Convert a retained value into an instruction operand at one byte offset. */
export function operandForValue(value: LoweredValue, offset = 0): MachineOperand {
  if (value.kind === "zero-extended") {
    return offset === 0
      ? operandForValue(value.low, 0)
      : Object.freeze({ kind: "immediate", value: 0 });
  }
  if (value.kind === "constant") {
    return Object.freeze({ kind: "immediate", value: (value.value >> (offset * 8)) & 0xff });
  }
  if (value.kind === "storage") {
    return Object.freeze({ kind: "storage", requestId: value.requestId, offset });
  }
  if (value.kind === "label") {
    return Object.freeze({
      kind: "label",
      label: value.label,
      offset,
      ...(value.transform === undefined ? {} : { transform: value.transform }),
    });
  }
  throw new Error("Machine value has no addressable operand");
}

/** Select the addressing mode implied by a retained value. */
export function modeForValue(
  value: LoweredValue,
  offset = 0,
): "immediate" | "storage" | "zero-page" | "absolute" {
  if (value.kind === "zero-extended") {
    return offset === 0 ? modeForValue(value.low, 0) : "immediate";
  }
  if (value.kind === "constant") return "immediate";
  if (value.kind === "storage") return "storage";
  if (value.kind === "label")
    return value.transform === "vic-sprite-block"
      ? "immediate"
      : value.zeroPage
        ? "zero-page"
        : "absolute";
  throw new Error("Machine value has no addressable mode");
}

/** Map one semantic terminator to a structured machine terminator. */
export function lowerTerminator(
  terminator: SemanticTerminator,
  values: ReadonlyMap<string, LoweredValue>,
  cpu: CpuFacts,
  returnsToStartup: boolean,
): MachineTerminator {
  if (terminator.kind === "jump") {
    return Object.freeze({
      kind: "jump",
      opcode: "jmp",
      target: terminator.target,
      cost: machineCost(cpu, "jmp", "absolute"),
    });
  }
  if (terminator.kind === "branch") {
    const condition = values.get(terminator.condition);
    const opcode = condition?.kind === "condition" ? condition.whenTrue : "bne";
    const flag = condition?.kind === "condition" ? condition.usesFlag : "z";
    return Object.freeze({
      kind: "branch",
      opcode,
      target: terminator.whenTrue,
      fallthrough: terminator.whenFalse,
      uses: machineState([], [flag]),
      cost: machineCost(cpu, opcode, "relative"),
    });
  }
  if (terminator.kind === "return") {
    if (returnsToStartup) {
      return Object.freeze({
        kind: "jump",
        opcode: "jmp",
        target: "startup.restore",
        cost: machineCost(cpu, "jmp", "absolute"),
      });
    }
    return Object.freeze({
      kind: "return",
      opcode: "rts",
      cost: machineCost(cpu, "rts", "implied"),
    });
  }
  return Object.freeze({ kind: "unreachable" });
}

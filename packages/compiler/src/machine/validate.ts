import type { CpuFacts } from "../target/nmos6510.js";
import { nmosInstructionForm, nmosInstructionState } from "../target/nmos6510.js";
import type { MachineFlag, MachineInstruction, MachineValidationResult } from "./machine-types.js";

/** Check that one structured operand is compatible with its selected physical mode. */
function validOperand(instruction: MachineInstruction): boolean {
  const { mode, operand } = instruction;
  if (mode === "implied" || mode === "accumulator") return operand === null;
  if (operand === null) return false;
  if (mode === "immediate") {
    return (
      (operand.kind === "immediate" &&
        Number.isInteger(operand.value) &&
        operand.value >= 0 &&
        operand.value <= 0xff) ||
      (operand.kind === "label" &&
        (operand.addressByte !== undefined || operand.transform !== undefined))
    );
  }
  if (mode === "relative") return operand.kind === "label";
  if (mode === "indirect-indexed-y") {
    return (
      operand.kind === "indirect-y" ||
      (operand.kind === "absolute" &&
        Number.isInteger(operand.value) &&
        operand.value >= 0 &&
        operand.value <= 0xff)
    );
  }
  if (mode === "indexed-indirect-x") {
    return (
      (operand.kind === "absolute" &&
        Number.isInteger(operand.value) &&
        operand.value >= 0 &&
        operand.value <= 0xff) ||
      operand.kind === "label"
    );
  }
  if (mode === "indirect") {
    return (
      (operand.kind === "absolute" &&
        Number.isInteger(operand.value) &&
        operand.value >= 0 &&
        operand.value <= 0xffff) ||
      operand.kind === "label"
    );
  }
  if (operand.kind === "absolute") {
    if (!Number.isInteger(operand.value) || operand.value < 0 || operand.value > 0xffff)
      return false;
    if (mode === "zero-page" || mode === "zero-page-x" || mode === "zero-page-y") {
      return operand.value <= 0xff;
    }
    return true;
  }
  return operand.kind === "label";
}

/**
 * Validate one final instruction against the documented CPU grid and current flag facts.
 * @param instruction Candidate structured instruction.
 * @param cpu Selected CPU facts.
 * @param validFlags Flags whose values are valid at this program point.
 * @returns The unchanged instruction when every check succeeds, otherwise a terminal error.
 * @example validateMachineInstruction(instruction, profile.cpu, ["z"])
 */
export function validateMachineInstruction(
  instruction: MachineInstruction,
  cpu: CpuFacts,
  validFlags: readonly MachineFlag[],
): MachineValidationResult {
  const form = nmosInstructionForm(cpu, instruction.opcode, instruction.mode);
  if (form === null) return Object.freeze({ kind: "error", reason: "opcode-mode" });
  const state = nmosInstructionState(cpu, instruction.opcode, instruction.mode);
  if (state === null) return Object.freeze({ kind: "error", reason: "opcode-mode" });
  if (
    instruction.uses.registers.join("\u0000") !== state.usesRegisters.join("\u0000") ||
    instruction.defines.registers.join("\u0000") !== state.definesRegisters.join("\u0000")
  ) {
    return Object.freeze({ kind: "error", reason: "operand" });
  }
  if (
    instruction.uses.flags.join("\u0000") !== state.usesFlags.join("\u0000") ||
    instruction.defines.flags.join("\u0000") !== state.definesFlags.join("\u0000")
  ) {
    return Object.freeze({ kind: "error", reason: "flag" });
  }
  if (
    instruction.cost.bytes !== form.bytes ||
    instruction.cost.minCycles !== form.minCycles ||
    instruction.cost.maxCycles !== form.maxCycles
  ) {
    return Object.freeze({ kind: "error", reason: "cost" });
  }
  if (!validOperand(instruction)) return Object.freeze({ kind: "error", reason: "operand" });
  const valid = new Set(validFlags);
  if (instruction.uses.flags.some((flag) => !valid.has(flag))) {
    return Object.freeze({ kind: "error", reason: "flag" });
  }
  return Object.freeze({ kind: "complete", instruction });
}

import type { MachineBlock, MachineInstruction, MachineOperand } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { validateAcmeInput, type CompleteC64Layout } from "./acme-validate.js";

/** Inputs to terminal deterministic ACME source serialization. */
export interface AcmeSerializationInput {
  /** Conflict-free final C64 layout. */
  readonly layout: CompleteC64Layout;
  /** Final storage-closure proof. */
  readonly certificate: StorageClosureCertificate;
  /** Exact selected target facts. */
  readonly profile: TargetProfile;
}

/** One compiler-owned ACME label and its exact final address. */
export interface AcmeExpectedLabel {
  /** Stable compiler identity before ACME-safe encoding. */
  readonly id: string;
  /** Emitted ASCII assembler spelling. */
  readonly name: string;
  /** Exact 16-bit address. */
  readonly address: number;
}

/** One loaded interval which the ACME report and PRG must reproduce. */
export interface AcmeExpectedSegment {
  /** Stable layout interval identity. */
  readonly id: string;
  /** Inclusive first loaded address. */
  readonly start: number;
  /** Inclusive last loaded address. */
  readonly end: number;
}

/** Deterministic source plus the exact labels and segments used for tool reconciliation. */
export type AcmeSerializationResult =
  | {
      readonly kind: "complete";
      readonly source: string;
      readonly expectedLabels: readonly AcmeExpectedLabel[];
      readonly expectedSegments: readonly AcmeExpectedSegment[];
    }
  | {
      readonly kind: "error";
      readonly reason: "invalid-program" | "invalid-layout" | "unsupported-form";
      readonly diagnostic: string;
    };

/** Convert one compiler identity to a collision-free ASCII-only ACME label. */
function labelName(id: string): string {
  return `b65_${Buffer.from(id, "utf8").toString("hex")}`;
}

/** Format an unsigned integer with an explicit ACME hexadecimal width. */
function hex(value: number, digits: number): string {
  return `$${value.toString(16).padStart(digits, "0")}`;
}

/** Format a symbolic expression with explicit parentheses and offset arithmetic. */
function labelExpression(operand: Extract<MachineOperand, { readonly kind: "label" }>): string {
  const label = labelName(operand.label);
  const offset = operand.offset ?? 0;
  if (offset === 0) return `(${label})`;
  const magnitude = hex(Math.abs(offset), 4);
  return `(${label} ${offset < 0 ? "-" : "+"} ${magnitude})`;
}

/** Format one already-bound operand according to its selected physical addressing mode. */
function operandText(instruction: MachineInstruction): string | null {
  const operand = instruction.operand;
  if (instruction.mode === "implied" || instruction.mode === "accumulator") {
    return operand === null ? "" : null;
  }
  if (operand === null) return null;
  let value: string;
  if (operand.kind === "immediate") value = hex(operand.value, 2);
  else if (operand.kind === "absolute") {
    value = hex(
      operand.value,
      instruction.mode.startsWith("zero-page") ||
        instruction.mode === "indexed-indirect-x" ||
        instruction.mode === "indirect-indexed-y"
        ? 2
        : 4,
    );
  } else if (operand.kind === "label") {
    const expression = labelExpression(operand);
    if (operand.addressByte === "low") value = `<${expression}`;
    else if (operand.addressByte === "high") value = `>${expression}`;
    else value = expression;
  } else {
    return null;
  }

  if (instruction.mode === "immediate") return `#${value}`;
  if (instruction.mode === "zero-page-x" || instruction.mode === "absolute-x") {
    return `${value},x`;
  }
  if (instruction.mode === "zero-page-y" || instruction.mode === "absolute-y") {
    return `${value},y`;
  }
  if (instruction.mode === "indirect") return `(${value})`;
  if (instruction.mode === "indexed-indirect-x") return `(${value},x)`;
  if (instruction.mode === "indirect-indexed-y") return `(${value}),y`;
  return value;
}

/** Force ACME to preserve the selected one- or two-byte address width. */
function mnemonic(instruction: MachineInstruction): string {
  if (
    instruction.mode === "zero-page" ||
    instruction.mode === "zero-page-x" ||
    instruction.mode === "zero-page-y" ||
    instruction.mode === "indexed-indirect-x" ||
    instruction.mode === "indirect-indexed-y"
  ) {
    return `${instruction.opcode}+1`;
  }
  if (
    instruction.mode === "absolute" ||
    instruction.mode === "absolute-x" ||
    instruction.mode === "absolute-y" ||
    instruction.mode === "indirect"
  ) {
    return `${instruction.opcode}+2`;
  }
  return instruction.opcode;
}

/** Serialize one physical instruction without changing its selected form. */
function instructionLine(instruction: MachineInstruction): string | null {
  const operand = operandText(instruction);
  if (operand === null) return null;
  return operand.length === 0
    ? `  ${mnemonic(instruction)}`
    : `  ${mnemonic(instruction)} ${operand}`;
}

/** Serialize the structured transfer at the end of one block. */
function terminatorLines(block: MachineBlock): readonly string[] {
  const terminator = block.terminator;
  if (terminator.kind === "fallthrough" || terminator.kind === "unreachable") return [];
  if (terminator.kind === "return") return ["  rts"];
  if (terminator.kind === "jump") return [`  jmp+2 (${labelName(terminator.target)})`];
  if (terminator.kind === "branch") {
    return [`  ${terminator.opcode} (${labelName(terminator.target)})`];
  }
  return [
    `  ${terminator.opcode} (${labelName(terminator.fallthrough)})`,
    `  jmp+2 (${labelName(terminator.jump.target)})`,
  ];
}

/** Emit explicit byte directives in short deterministic rows. */
function byteLines(bytes: readonly number[]): readonly string[] {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    lines.push(
      `  !byte ${bytes
        .slice(offset, offset + 16)
        .map((byte) => hex(byte, 2))
        .join(", ")}`,
    );
  }
  return lines;
}

/**
 * Serialize one final C64 machine/layout result to deterministic ACME 0.97 source.
 *
 * The serializer performs no lowering, placement, allocation, branch repair, or project-string
 * interpolation. Every symbol comes from a compiler identity and every address width has already
 * been selected by the machine representation.
 *
 * @param input Final layout, closure proof, and exact target profile.
 * @returns Source and reconciliation facts, or a terminal validation error.
 * @example serializeAcme({ layout, certificate, profile }).kind === "complete"
 */
export function serializeAcme(input: AcmeSerializationInput): AcmeSerializationResult {
  const validation = validateAcmeInput(input);
  if (validation.kind === "error") return validation;

  const lines: string[] = ["!cpu 6502"];
  const expectedLabels: AcmeExpectedLabel[] = [];
  const addLabel = (id: string, address: number) => {
    expectedLabels.push(Object.freeze({ id, name: labelName(id), address }));
    lines.push(`${labelName(id)}:`);
  };

  const basic = input.layout.intervals.find(({ id }) => id === "basic.stub");
  if (basic?.bytes === null || basic?.bytes === undefined) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-layout",
      diagnostic: "The selected C64 layout is missing its loaded BASIC stub",
    });
  }
  lines.push(`* = ${hex(basic.start, 4)}`);
  addLabel(basic.id, basic.start);
  lines.push(...byteLines(basic.bytes));

  const functions = [input.layout.program.startup, ...input.layout.program.functions];
  const functionLabels = new Map(functions.map((fn) => [fn.id, fn.origin!] as const));
  const blocks = functions
    .flatMap((fn) => fn.blocks.map((block) => ({ fn, block })))
    .sort((left, right) => left.block.origin! - right.block.origin!);
  const emittedFunctions = new Set<string>();
  for (const { fn, block } of blocks) {
    lines.push(`* = ${hex(block.origin!, 4)}`);
    if (!emittedFunctions.has(fn.id)) {
      addLabel(fn.id, functionLabels.get(fn.id)!);
      emittedFunctions.add(fn.id);
    }
    addLabel(block.label, block.origin!);
    for (const instruction of block.instructions) {
      const line = instructionLine(instruction);
      if (line === null) {
        return Object.freeze({
          kind: "error",
          reason: "unsupported-form",
          diagnostic: "A final machine instruction has no terminal ACME operand spelling",
        });
      }
      lines.push(line);
    }
    lines.push(...terminatorLines(block));
  }

  const codeInterval = input.layout.intervals.find(({ id }) => id === "program.code");
  const dataIntervals = input.layout.intervals.filter(
    ({ kind }) => kind !== "stub" && kind !== "code" && kind !== "sfa",
  );
  for (const interval of dataIntervals) {
    if (interval.bytes === null) continue;
    lines.push(`* = ${hex(interval.start, 4)}`);
    addLabel(interval.id, interval.start);
    if (interval.kind === "fill") {
      const fill = interval.bytes[0] ?? 0;
      if (interval.bytes.some((byte) => byte !== fill)) {
        return Object.freeze({
          kind: "error",
          reason: "invalid-layout",
          diagnostic: "A layout fill interval contains more than one fill value",
        });
      }
      lines.push(`  !fill ${interval.bytes.length}, ${hex(fill, 2)}`);
    } else {
      lines.push(...byteLines(interval.bytes));
    }
  }

  const expectedSegments = input.layout.intervals
    .filter(({ bytes, kind }) => bytes !== null && kind !== "sfa")
    .map(({ id, start, end }) => Object.freeze({ id, start, end }));
  if (codeInterval === undefined) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-layout",
      diagnostic: "The selected C64 layout is missing its machine-code interval",
    });
  }
  return Object.freeze({
    kind: "complete",
    source: `${lines.join("\n")}\n`,
    expectedLabels: Object.freeze(expectedLabels),
    expectedSegments: Object.freeze(expectedSegments),
  });
}

import { expect } from "vitest";
import { decodeLine, readMnemonics } from "./emitted-routine-support.js";
import type { Artifacts, Decoded, Instruction } from "./emitted-routine-support.js";

/** A named routine decoded from the public assembly and final label table. */
export interface RoutineView {
  /** Original assembly lines belonging to this routine. */
  readonly lines: readonly string[];
  /** Instructions in their emitted order. */
  readonly decoded: readonly Decoded[];
  /** Final addresses exported by the assembler. */
  readonly labels: Map<string, number>;
  /** Label prefix identifying blocks owned by this routine. */
  readonly stem: string;
}

/** One architectural memory write made by an evaluated instruction. */
export interface MemoryWrite {
  /** Position of the instruction in the decoded routine. */
  readonly position: number;
  /** Final sixteen-bit CPU address. */
  readonly address: number;
  /** Byte placed on the data bus. */
  readonly value: number;
}

/** Memory and writes produced by one bounded evaluation. */
export interface Evaluation {
  /** Memory bytes whose values are known after evaluation. */
  readonly memory: ReadonlyMap<number, number>;
  /** Writes in execution order, including both writes of an NMOS read-modify-write. */
  readonly writes: readonly MemoryWrite[];
}

/** The physical word home and inclusive instruction span of its increment. */
export interface WordStep {
  /** Address of the counter's low byte. */
  readonly low: number;
  /** First instruction belonging to the update. */
  readonly start: number;
  /** Instruction that commits the counter's high byte. */
  readonly end: number;
}

/**
 * Build the parameter-seeded witness, optionally with an installed NMI.
 *
 * The handler does not share the counter or array. Its presence must not turn
 * the word guard into a byte guard, but does not prescribe register reuse.
 */
export function scanSource(withHandler = false): string {
  return `module Game;
${withHandler ? "import { setNMI, restoreNMI } from c64.system;\n" : ""}let data: byte[8];
${withHandler ? "let pulse: byte = 0;\ninterrupt function handler(): void { pulse = 1; }\n" : ""}function scan(seed: word): void {
  for (let i: word = seed; i < 8; i += 1) {
    data[i] = byte(i);
  }
}
function main(): void {
  ${withHandler ? "setNMI(&handler); " : ""}scan(0);${withHandler ? " restoreNMI();" : ""}
}
`;
}

/**
 * Decode a specified source function using the same published section and label
 * conventions as the shared routine decoder.
 */
export function namedRoutine(artifacts: Artifacts, name: string): RoutineView {
  const labels = new Map<string, number>();
  for (const match of artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu))
    labels.set(match[1]!, Number.parseInt(match[2]!, 16));

  const marker = `; routine "Game.${name}"`;
  const start = artifacts.assembly.indexOf(marker);
  expect(start, `public assembly contains ${marker}`).toBeGreaterThanOrEqual(0);
  if (start < 0) throw new Error(`Missing emitted routine Game.${name}`);

  const rest = artifacts.assembly.slice(start);
  const nextSection = [...rest.matchAll(/^\s*;\s*(?:routine|bss|data|segment|startup)\b/gmu)]
    .map((match) => match.index)
    .find((index) => index > 0);
  const section = rest.slice(0, nextSection).split("\n");
  const stem = `b65_Game_${name}_`;
  const end = section.findIndex((line) => {
    const label = /^\s*([A-Za-z_][\w.]*):(?:\s|$)/u.exec(line);
    return label !== null && !label[1]!.startsWith(stem);
  });
  const lines = end < 0 ? section : section.slice(0, end);
  const decoded: Decoded[] = [];
  let placed: number | undefined;
  for (const [lineIndex, line] of lines.entries()) {
    const origin = /^\s*\*\s*=\s*\$([0-9a-f]+)/iu.exec(line);
    if (origin !== null) {
      placed = Number.parseInt(origin[1]!, 16);
      continue;
    }
    const instruction = decodeLine(line, labels);
    if (instruction === undefined) continue;
    decoded.push({ lineIndex, instruction, address: placed });
    placed = undefined;
  }
  expect(decoded.length, `decoded Game.${name}`).toBeGreaterThan(0);
  return { lines, decoded, labels, stem };
}

/** Whether an instruction writes memory rather than an accumulator operand. */
export function isMemoryWrite(instruction: Instruction): boolean {
  return (
    instruction.mode !== "implied" &&
    ["sta", "stx", "sty", "inc", "dec", "asl", "lsr", "rol", "ror"].includes(instruction.mnemonic)
  );
}

/** Whether a store uses the NMOS indirect-indexed addressing form. */
export function isIndirectYStore(instruction: Instruction): boolean {
  return instruction.mnemonic === "sta" && /\([^()]+\)\s*,\s*y\s*$/iu.test(instruction.text);
}

/** Whether an operand names one fixed byte directly. */
function isDirect(instruction: Instruction): boolean {
  return instruction.mode === "absolute" || instruction.mode === "zeroPage";
}

/**
 * Find the source home of the private word increment without depending on local
 * symbol spelling or requiring that forwarding already works.
 */
export function wordStep(view: RoutineView): WordStep {
  const code = view.decoded.map((entry) => entry.instruction);
  for (let start = 0; start < code.length; start += 1) {
    const first = code[start]!;
    if (!isDirect(first) || first.address === undefined) continue;
    const low = first.address;
    if (
      first.mnemonic === "lda" &&
      code[start + 1]?.mnemonic === "clc" &&
      code[start + 2]?.mnemonic === "adc" &&
      code[start + 2]?.immediate === 1 &&
      code[start + 3]?.mnemonic === "sta" &&
      code[start + 4]?.mnemonic === "lda" &&
      isDirect(code[start + 4]!) &&
      code[start + 4]?.address === low + 1 &&
      code[start + 5]?.mnemonic === "adc" &&
      code[start + 5]?.immediate === 0 &&
      code[start + 6]?.mnemonic === "sta"
    ) {
      const end = code.findIndex(
        (instruction, position) =>
          position >= start + 6 && isMemoryWrite(instruction) && instruction.address === low + 1,
      );
      if (end >= 0) return { low, start, end };
    }
    if (first.mnemonic === "inc") {
      const end = code.findIndex(
        (instruction, position) =>
          position > start &&
          instruction.mnemonic === "inc" &&
          isDirect(instruction) &&
          instruction.address === low + 1,
      );
      if (end >= 0) return { low, start, end };
    }
  }
  throw new Error(`Missing a full-width word increment:\n${view.lines.join("\n")}`);
}

/**
 * Identify the single word parameter of a leaf witness from its incoming reads.
 *
 * Parameter bytes are read before this routine writes them. Scratch bytes and
 * local homes are initialized by the routine itself. A missing high-byte read
 * is not silently supplied by this discovery step.
 */
export function inputWordHome(view: RoutineView): number {
  const written = new Set<number>();
  const incoming = new Set<number>();
  for (const { instruction } of view.decoded) {
    if (!isDirect(instruction) || instruction.address === undefined) continue;
    if (readMnemonics.has(instruction.mnemonic) && !written.has(instruction.address))
      incoming.add(instruction.address);
    if (isMemoryWrite(instruction)) written.add(instruction.address);
  }
  const homes = [...incoming].sort((left, right) => left - right);
  expect(homes.length, "incoming bytes of the single word parameter").toBeGreaterThan(0);
  expect(homes.length, "no additional incoming scalar storage").toBeLessThanOrEqual(2);
  if (homes.length === 2) expect(homes[1], "little-endian parameter high byte").toBe(homes[0]! + 1);
  return homes[0]!;
}

/** Seed a little-endian word without supplying arbitrary values for scratch RAM. */
export function wordMemory(low: number, value: number): Map<number, number> {
  return new Map([
    [low, value & 0xff],
    [low + 1, value >>> 8],
  ]);
}

/**
 * Resolve a named or anonymous branch target to an instruction position.
 *
 * A known label owned by another emitted region is a routine exit. Missing
 * labels and unresolved targets owned by this routine remain errors, rather
 * than silently terminating evaluation.
 */
function targetPosition(view: RoutineView, from: number, target: string): number | undefined {
  const anonymous = /^[+-]+$/u.test(target);
  const direction = target.startsWith("-") ? -1 : 1;
  let remaining = anonymous ? target.length : 1;
  const fromLine = view.decoded[from]!.lineIndex;
  const candidates = anonymous
    ? Array.from(
        { length: direction < 0 ? fromLine : view.lines.length - fromLine - 1 },
        (_, offset) => fromLine + direction * (offset + 1),
      )
    : view.lines.map((_, position) => position);

  for (const lineIndex of candidates) {
    const text = view.lines[lineIndex]!.replace(/;.*$/u, "").trim();
    const defines = anonymous
      ? text === target[0]
      : text === target || text.startsWith(`${target}:`);
    if (!defines || --remaining !== 0) continue;
    const position = view.decoded.findIndex((entry) => entry.lineIndex >= lineIndex);
    return position >= 0 ? position : undefined;
  }

  const address = view.labels.get(target);
  const position = view.decoded.findIndex(
    (entry) => address !== undefined && entry.address === address,
  );
  if (position >= 0) return position;
  if (address !== undefined && !target.startsWith(view.stem)) return undefined;
  throw new Error(`Unresolved branch target: ${target}`);
}

/** Resolve a numeric immediate or an assembler low/high-byte label expression. */
function immediate(instruction: Instruction, labels: Map<string, number>): number {
  if (instruction.immediate !== undefined) return instruction.immediate;
  const match = /#\s*([<>])\s*(.+)$/u.exec(instruction.text);
  if (match !== null) {
    const expression = match[2]!.trim().replace(/^\((.*)\)$/u, "$1");
    const address = decodeLine(`lda ${expression}`, labels)?.address;
    if (address !== undefined) return match[1] === "<" ? address & 0xff : (address >>> 8) & 0xff;
  }
  throw new Error(`Unresolved immediate: ${instruction.text}`);
}

/**
 * Evaluate the binary-mode instruction subset used by these leaf witnesses.
 *
 * This deliberately bounded evaluator checks addresses, guard outcomes and carry
 * propagation independently of compiler lowering. It does not model interrupt
 * delivery or replace emulator qualification. Unknown inputs, instructions and
 * targets fail explicitly rather than being treated as zero or ignored.
 *
 * Routine evaluation ends on a return or a transfer to a known external label.
 * Span evaluation also ends whenever control leaves either boundary of the span,
 * so a counter update can finish by branching back to its loop header.
 */
export function evaluate(
  view: RoutineView,
  initial: ReadonlyMap<number, number>,
  span?: { readonly start: number; readonly end: number },
): Evaluation {
  const memory = new Map(initial);
  const writes: MemoryWrite[] = [];
  let a: number | undefined;
  let x: number | undefined;
  let y: number | undefined;
  let carry: boolean | undefined;
  let zero: boolean | undefined;
  let negative: boolean | undefined;
  let overflow: boolean | undefined;
  const start = span?.start ?? 0;
  let pc = start;
  const end = span?.end ?? view.decoded.length - 1;

  /** Reject an unknown register, flag or memory byte at its first use. */
  function known<T>(value: T | undefined, description: string): T {
    if (value === undefined) throw new Error(`Unknown ${description} at instruction ${pc}`);
    return value;
  }

  /** Read only memory initialized by the witness or by an executed instruction. */
  function read(address: number): number {
    return known(memory.get(address & 0xffff), `memory $${address.toString(16)}`);
  }

  /** Record bus-visible writes, keeping their originating instruction position. */
  function write(address: number, value: number): void {
    const effective = address & 0xffff;
    const byte = value & 0xff;
    memory.set(effective, byte);
    writes.push({ position: pc, address: effective, value: byte });
  }

  /** Set the two flags affected by loads and byte results. */
  function nz(value: number): number {
    const byte = value & 0xff;
    zero = byte === 0;
    negative = (byte & 0x80) !== 0;
    return byte;
  }

  /** Resolve direct, register-indexed and zero-page indirect-indexed operands. */
  function address(instruction: Instruction): number {
    const indirect = /\(([^()]+)\)\s*,\s*y\s*$/iu.exec(instruction.text);
    if (indirect !== null) {
      const pointer = known(
        decodeLine(`lda ${indirect[1]!}`, view.labels)?.address,
        "zero-page pointer operand",
      );
      if (pointer < 0 || pointer > 0xff)
        throw new Error("An indirect-indexed pointer must reside in zero page");
      return (read(pointer) + (read((pointer + 1) & 0xff) << 8) + known(y, "Y")) & 0xffff;
    }
    const base = known(instruction.address, `operand address: ${instruction.text}`);
    const index =
      instruction.index === "x" ? known(x, "X") : instruction.index === "y" ? known(y, "Y") : 0;
    return (base + index) & 0xffff;
  }

  /** Read a byte operand without guessing unresolved assembler expressions. */
  function operand(instruction: Instruction): number {
    return instruction.mode === "immediate"
      ? immediate(instruction, view.labels)
      : read(address(instruction));
  }

  /** Apply unsigned comparison flags without changing the compared register. */
  function compare(left: number, right: number): void {
    carry = left >= right;
    nz(left - right);
  }

  /** Read only the flag actually consumed by a particular branch. */
  function taken(mnemonic: string): boolean {
    switch (mnemonic) {
      case "beq":
        return known(zero, "Z");
      case "bne":
        return !known(zero, "Z");
      case "bcs":
        return known(carry, "C");
      case "bcc":
        return !known(carry, "C");
      case "bmi":
        return known(negative, "N");
      case "bpl":
        return !known(negative, "N");
      case "bvs":
        return known(overflow, "V");
      case "bvc":
        return !known(overflow, "V");
      default:
        throw new Error(`Unmodelled branch: ${mnemonic}`);
    }
  }

  for (let steps = 0; steps < 250_000; steps += 1) {
    if (span !== undefined && (pc < start || pc > end)) return { memory, writes };
    const instruction = view.decoded[pc]?.instruction;
    if (pc < 0 || pc > end || instruction === undefined)
      throw new Error(`Evaluation escaped the routine at instruction ${pc}`);

    const mnemonic = instruction.mnemonic;
    if (instruction.mode === "relative" || mnemonic === "jmp") {
      if (mnemonic === "jmp" || taken(mnemonic)) {
        const destination = targetPosition(view, pc, known(instruction.target, "branch target"));
        if (destination === undefined) return { memory, writes };
        pc = destination;
        continue;
      }
    } else {
      switch (mnemonic) {
        case "lda":
          a = nz(operand(instruction));
          break;
        case "ldx":
          x = nz(operand(instruction));
          break;
        case "ldy":
          y = nz(operand(instruction));
          break;
        case "sta":
          write(address(instruction), known(a, "A"));
          break;
        case "stx":
          write(address(instruction), known(x, "X"));
          break;
        case "sty":
          write(address(instruction), known(y, "Y"));
          break;
        case "clc":
          carry = false;
          break;
        case "sec":
          carry = true;
          break;
        case "cld":
        case "nop":
          break;
        case "tay":
          y = nz(known(a, "A"));
          break;
        case "tax":
          x = nz(known(a, "A"));
          break;
        case "tya":
          a = nz(known(y, "Y"));
          break;
        case "txa":
          a = nz(known(x, "X"));
          break;
        case "inx":
          x = nz(known(x, "X") + 1);
          break;
        case "dex":
          x = nz(known(x, "X") - 1);
          break;
        case "iny":
          y = nz(known(y, "Y") + 1);
          break;
        case "dey":
          y = nz(known(y, "Y") - 1);
          break;
        case "cmp":
          compare(known(a, "A"), operand(instruction));
          break;
        case "cpx":
          compare(known(x, "X"), operand(instruction));
          break;
        case "cpy":
          compare(known(y, "Y"), operand(instruction));
          break;
        case "and":
          a = nz(known(a, "A") & operand(instruction));
          break;
        case "ora":
          a = nz(known(a, "A") | operand(instruction));
          break;
        case "eor":
          a = nz(known(a, "A") ^ operand(instruction));
          break;
        case "adc": {
          const left = known(a, "A");
          const right = operand(instruction);
          const sum = left + right + Number(known(carry, "C"));
          overflow = (~(left ^ right) & (left ^ sum) & 0x80) !== 0;
          carry = sum > 0xff;
          a = nz(sum);
          break;
        }
        case "sbc": {
          const left = known(a, "A");
          const right = operand(instruction);
          const difference = left - right - Number(!known(carry, "C"));
          overflow = ((left ^ right) & (left ^ difference) & 0x80) !== 0;
          carry = difference >= 0;
          a = nz(difference);
          break;
        }
        case "inc":
        case "dec": {
          const destination = address(instruction);
          const old = read(destination);
          write(destination, old);
          write(destination, nz(old + (mnemonic === "inc" ? 1 : -1)));
          break;
        }
        case "rts":
          return { memory, writes };
        default:
          throw new Error(`Unmodelled witness instruction: ${instruction.text}`);
      }
    }
    pc += 1;
  }
  throw new Error("The witness exceeded its finite instruction budget");
}

/** Select array stores, excluding direct scalar homes and address-staging bytes. */
export function indexedWrites(view: RoutineView, evaluation: Evaluation): readonly MemoryWrite[] {
  return evaluation.writes.filter(({ position }) => {
    const instruction = view.decoded[position]!.instruction;
    return instruction.mnemonic === "sta" && instruction.index !== undefined;
  });
}

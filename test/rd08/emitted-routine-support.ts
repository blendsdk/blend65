/**
 * Read one emitted 6502 routine out of a build's public assembly artifact.
 *
 * Output oracles need to say what a routine is, where its repeated part is, and
 * what it costs, and none of that is specific to any one of them. The decoder
 * works from the published assembly text and label table only: operands are
 * resolved to final addresses, so an assertion never depends on how a label was
 * spelled, and an addressing form outside the modelled set is reported as
 * unmodelled rather than guessed at.
 */
import { expect } from "vitest";
import type { buildProfileSource } from "../rd05/profile-fixture.js";

/** Public artifacts of one real build, exactly as the profile build fixture returns them. */
export type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Final addressing mode of one emitted instruction, or `other` when unmodelled. */
export type Mode =
  | "implied"
  | "immediate"
  | "relative"
  | "zeroPage"
  | "zeroPageIndexed"
  | "absolute"
  | "absoluteIndexed"
  | "other";

/** One emitted instruction with its resolved operand, independent of label spelling. */
export interface Instruction {
  readonly text: string;
  readonly mnemonic: string;
  readonly mode: Mode;
  readonly index: "x" | "y" | undefined;
  readonly immediate: number | undefined;
  readonly address: number | undefined;
  readonly target: string | undefined;
}

/**
 * One decoded instruction, the line it came from, and its own final address.
 *
 * The address is present only for an instruction that directly follows an
 * emitted origin directive, which is the only case where the directive states
 * that instruction's own address rather than the address of its block.
 */
export interface Decoded {
  readonly lineIndex: number;
  readonly instruction: Instruction;
  readonly address: number | undefined;
}

const branchMnemonics = new Set(["bcc", "bcs", "beq", "bne", "bmi", "bpl", "bvc", "bvs"]);
const jumpMnemonics = new Set(["jmp", "jsr"]);
/** Instructions that read a value from an operand into a register or the flags. */
export const readMnemonics = new Set([
  "lda",
  "ldx",
  "ldy",
  "cmp",
  "cpx",
  "cpy",
  "and",
  "ora",
  "eor",
  "adc",
  "sbc",
  "bit",
]);
const storeMnemonics = new Set(["sta", "stx", "sty"]);
const modifyMnemonics = new Set(["asl", "lsr", "rol", "ror", "inc", "dec"]);

/** Documented cycle cost of every one-byte instruction these routines can use. */
const impliedCycles: Record<string, number> = {
  asl: 2,
  brk: 7,
  clc: 2,
  cld: 2,
  cli: 2,
  clv: 2,
  dex: 2,
  dey: 2,
  inx: 2,
  iny: 2,
  lsr: 2,
  nop: 2,
  pha: 3,
  php: 3,
  pla: 4,
  plp: 4,
  rol: 2,
  ror: 2,
  rti: 6,
  rts: 6,
  sec: 2,
  sed: 2,
  sei: 2,
  tax: 2,
  tay: 2,
  tsx: 2,
  txa: 2,
  txs: 2,
  tya: 2,
};

/** Every mnemonic the decoder recognizes, so a label can never parse as code. */
const mnemonics = new Set([
  ...branchMnemonics,
  ...jumpMnemonics,
  ...readMnemonics,
  ...storeMnemonics,
  ...modifyMnemonics,
  ...Object.keys(impliedCycles),
]);

/** Map every emitted label to its final address so an operand can be resolved exactly. */
export function labelAddresses(labels: string): Map<string, number> {
  const addresses = new Map<string, number>();
  for (const match of labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu))
    addresses.set(match[1]!, Number.parseInt(match[2]!, 16));
  return addresses;
}

/**
 * Resolve the single module global that owns one authored source name.
 *
 * Emitted data labels carry a provenance suffix, so the oracle matches the
 * declared name and requires exactly one home for it.
 */
export function globalAddress(labels: Map<string, number>, name: string): number {
  const prefix = `b65_Game_${name}_`;
  const homes = new Set(
    [...labels].filter(([label]) => label.startsWith(prefix)).map(([, address]) => address),
  );
  expect([...homes], `emitted home of ${name}`).toHaveLength(1);
  return [...homes][0]!;
}

/**
 * Resolve an emitted memory operand to one final address.
 *
 * A destination inside an object is emitted as its home label plus the field
 * displacement, so every term of the operand is resolved and summed. An operand
 * the oracle cannot resolve, such as an indirect pointer, resolves to nothing
 * rather than to a wrong address.
 */
function operandAddress(operand: string, labels: Map<string, number>): number | undefined {
  const base = operand.replace(/\s*,\s*[xy]\s*$/iu, "").trim();
  if (base.length === 0 || /[()]/u.test(base)) return undefined;
  let total = 0;
  for (const term of base.split(/(?=[+-])/u)) {
    const text = term.replace(/^\+/u, "").trim();
    const negative = text.startsWith("-");
    const literal = text.replace(/^-/u, "").trim();
    const value = literal.startsWith("$")
      ? Number.parseInt(literal.slice(1), 16)
      : /^[0-9]+$/u.test(literal)
        ? Number.parseInt(literal, 10)
        : labels.get(literal);
    if (value === undefined || Number.isNaN(value)) return undefined;
    total += negative ? -value : value;
  }
  return total;
}

/** Read one immediate operand written as a decimal or hexadecimal literal. */
function immediateValue(operand: string): number | undefined {
  const literal = operand.slice(1).trim();
  if (literal.startsWith("$")) return Number.parseInt(literal.slice(1), 16);
  return /^[0-9]+$/u.test(literal) ? Number.parseInt(literal, 10) : undefined;
}

/**
 * Decode one emitted line, or nothing for a label, comment or assembler directive.
 *
 * A label may share its line with the instruction that follows it, so a leading
 * label is stripped first. The assembler may carry an explicit operand-width
 * suffix on the mnemonic; when it does it decides the addressing mode, and
 * otherwise the resolved address does. An addressing form outside the modelled
 * set stays `other`, so a routine built from naive lowering can still be
 * inspected structurally.
 */
export function decodeLine(rawLine: string, labels: Map<string, number>): Instruction | undefined {
  const text = rawLine
    .replace(/;.*$/u, "")
    .replace(/^\s*[^\s;:]+:\s+/u, "")
    .trim();
  const match = /^([a-z]{3})(?:[+-]([0-9]))?(?:\s+(.*))?$/iu.exec(text);
  if (match === null) return undefined;
  const mnemonic = match[1]!.toLowerCase();
  if (!mnemonics.has(mnemonic)) return undefined;
  const operand = (match[3] ?? "").trim();
  const width = match[2];
  const common = {
    text,
    mnemonic,
    index: undefined,
    immediate: undefined,
    address: undefined,
    target: undefined,
  };
  if (branchMnemonics.has(mnemonic))
    return { ...common, mode: "relative", target: operand.length === 0 ? undefined : operand };
  if (jumpMnemonics.has(mnemonic))
    return {
      ...common,
      mode: operand.includes("(") ? "other" : "absolute",
      target: operand.length === 0 ? undefined : operand,
      address: operandAddress(operand, labels),
    };
  if (operand.length === 0 || /^a$/iu.test(operand)) return { ...common, mode: "implied" };
  if (operand.startsWith("#"))
    return { ...common, mode: "immediate", immediate: immediateValue(operand) };
  const indexed = /,\s*([xy])\s*$/iu.exec(operand);
  const index = indexed === null ? undefined : (indexed[1]!.toLowerCase() as "x" | "y");
  const address = operandAddress(operand, labels);
  const zeroPage =
    width === "1" || (width === undefined && address !== undefined && address < 0x100);
  const absolute =
    width === "2" || (width === undefined && address !== undefined && address >= 0x100);
  const mode: Mode = zeroPage
    ? index === undefined
      ? "zeroPage"
      : "zeroPageIndexed"
    : absolute
      ? index === undefined
        ? "absolute"
        : "absoluteIndexed"
      : "other";
  return { ...common, mode, index, address };
}

/**
 * Line that defines a branch target, searching backwards from the reference.
 *
 * Both named labels and the assembler's anonymous backward labels are accepted,
 * where a repeated marker selects that many definitions back.
 */
function definitionLine(lines: readonly string[], target: string, from: number): number {
  const anonymous = /^-+$/u.test(target);
  let remaining = anonymous ? target.length : 1;
  for (let line = from - 1; line >= 0; line -= 1) {
    const text = lines[line]!.replace(/;.*$/u, "").trim();
    const defines = anonymous ? text === "-" : text === target || text.startsWith(`${target}:`);
    if (defines) {
      remaining -= 1;
      if (remaining === 0) return line;
    }
  }
  return -1;
}

/** One repeated span of the routine, from its entry label through its closing branch. */
export interface Loop {
  readonly start: number;
  readonly end: number;
}

/**
 * Every counted loop in the routine, as a span closed by a backward branch.
 *
 * A span starts at the target label itself, because a label may share its line
 * with the first instruction it names.
 */
function countedLoops(lines: readonly string[], decoded: readonly Decoded[]): Loop[] {
  const spans: Loop[] = [];
  decoded.forEach((entry, position) => {
    const { instruction } = entry;
    if (instruction.target === undefined) return;
    if (instruction.mode !== "relative" && instruction.mnemonic !== "jmp") return;
    const definition = definitionLine(lines, instruction.target, entry.lineIndex);
    if (definition < 0) return;
    const start = decoded.findIndex((candidate) => candidate.lineIndex >= definition);
    if (start < 0 || start > position) return;
    spans.push({ start, end: position });
  });
  return spans;
}

/** The innermost counted loop, or nothing when the routine has no backward branch. */
export function findInnermostLoop(
  lines: readonly string[],
  decoded: readonly Decoded[],
): Loop | undefined {
  const spans = countedLoops(lines, decoded);
  if (spans.length === 0) return undefined;
  return spans.reduce((best, span) =>
    span.end - span.start < best.end - best.start ? span : best,
  );
}

/**
 * The innermost counted loop, required to exist.
 *
 * Everything that reads a loop's body hinges on this parse, so a routine with no
 * backward branch reports its complete emitted text.
 */
export function innermostLoop(lines: readonly string[], decoded: readonly Decoded[]): Loop {
  const loop = findInnermostLoop(lines, decoded);
  expect(loop, `emitted counted loop in:\n${lines.join("\n")}`).toBeDefined();
  if (loop === undefined) throw new Error("Missing an emitted counted loop");
  return loop;
}

/** Assembler directive that states the address the following instruction is placed at. */
const originDirective = /^\s*\*\s*=\s*\$([0-9a-f]+)/iu;

/** Emitted section markers that bound the region a routine can occupy. */
const sectionMarker = /^\s*;\s*(?:routine|bss|data|segment|startup)\b/gmu;

/** Routines that may own the authored loop, in preference order. */
const routineNames = ["Game.work", "Game.main"] as const;

/** Named label defined on one emitted line, when the line defines one. */
function labelOnLine(line: string): string | undefined {
  const match = /^\s*([A-Za-z_][\w.]*):(?:\s|$)/u.exec(line.replace(/;.*$/u, "").trimEnd());
  return match === null ? undefined : match[1]!;
}

/**
 * Decode the emitted routine that owns the authored loop.
 *
 * The routine ends at the first label that does not belong to it. Every one of
 * its blocks carries a label built from its own name, so a label without that
 * stem belongs to whatever was emitted next, which need not announce itself with
 * a section comment. Neither the first nor the last return bounds the routine: a
 * top-tested loop emits its exit, and therefore its return, ahead of the body it
 * guards, while a loop that jumps backwards to its header ends on that jump.
 */
export function routine(artifacts: Artifacts): {
  lines: string[];
  decoded: Decoded[];
  labels: Map<string, number>;
} {
  const labels = labelAddresses(artifacts.labels);
  const found = routineNames
    .map((name) => ({ name, index: artifacts.assembly.indexOf(`; routine "${name}"`) }))
    .find((candidate) => candidate.index >= 0);
  if (found === undefined) throw new Error("Missing the emitted routine that owns the loop");
  const stem = `b65_${found.name.replace(/\./gu, "_")}_`;
  const rest = artifacts.assembly.slice(found.index);
  const following = [...rest.matchAll(sectionMarker)]
    .map((match) => match.index)
    .filter((index) => index > 0);
  const section = rest
    .slice(0, following.length === 0 ? rest.length : Math.min(...following))
    .split("\n");
  let end = section.length;
  for (const [position, line] of section.entries()) {
    const label = labelOnLine(line);
    if (label === undefined || label.startsWith(stem)) continue;
    end = position;
    break;
  }
  const lines = section.slice(0, end);
  const decoded: Decoded[] = [];
  let placed: number | undefined;
  lines.forEach((line, lineIndex) => {
    const origin = originDirective.exec(line);
    if (origin !== null) {
      placed = Number.parseInt(origin[1]!, 16);
      return;
    }
    const instruction = decodeLine(line, labels);
    if (instruction === undefined) return;
    decoded.push({ lineIndex, instruction, address: placed });
    placed = undefined;
  });
  // Reported against the unbounded region, so a routine whose blocks are not
  // named after it is visible as a parse result rather than a compiler result.
  expect(decoded.length, `decoded instructions in:\n${section.join("\n")}`).toBeGreaterThan(0);
  return { lines, decoded, labels };
}

/** Instructions that leave the accumulator holding something else. */
const accumulatorWriters = new Set([
  "lda",
  "pla",
  "txa",
  "tya",
  "adc",
  "sbc",
  "and",
  "ora",
  "eor",
  "jsr",
]);

/**
 * Does this instruction destroy a value already held in the accumulator?
 *
 * A call counts: a callee is not obliged to preserve the accumulator, so a value
 * cannot be assumed to survive one.
 */
export function clobbersAccumulator(instruction: Instruction): boolean {
  if (accumulatorWriters.has(instruction.mnemonic)) return true;
  return (
    instruction.mode === "implied" && ["asl", "lsr", "rol", "ror"].includes(instruction.mnemonic)
  );
}

/** The right-hand byte a loop stores: either a literal or one module global. */
export type StoredValue =
  | { readonly kind: "immediate"; readonly literal: number }
  | { readonly kind: "global"; readonly address: number };

/** Does this instruction read the stored byte itself, into any register? */
export function readsStoredValue(instruction: Instruction, value: StoredValue): boolean {
  if (!["lda", "ldx", "ldy"].includes(instruction.mnemonic)) return false;
  if (value.kind === "immediate")
    return instruction.mode === "immediate" && instruction.immediate === value.literal;
  return (
    (instruction.mode === "absolute" || instruction.mode === "zeroPage") &&
    instruction.address === value.address
  );
}

/**
 * Final encoded size and documented base cycle count of one instruction.
 *
 * Figures exclude interrupts, video stalls and firmware latency, and the branch
 * figure is the cost of not taking it. An unmodelled addressing form throws
 * rather than contributing a wrong number, so this model suits routines whose
 * exact shape has already been asserted and which perform no indexed read.
 */
export function cost(instruction: Instruction): { bytes: number; cycles: number } {
  const { mnemonic, mode, text } = instruction;
  if (mode === "implied") {
    const cycles = impliedCycles[mnemonic];
    if (cycles === undefined) throw new Error(`Unmodelled one-byte instruction: ${text}`);
    return { bytes: 1, cycles };
  }
  if (mode === "relative") return { bytes: 2, cycles: 2 };
  if (mnemonic === "jmp") return { bytes: 3, cycles: 3 };
  if (mnemonic === "jsr") return { bytes: 3, cycles: 6 };
  if (mode === "immediate") {
    if (!readMnemonics.has(mnemonic)) throw new Error(`Unmodelled immediate form: ${text}`);
    return { bytes: 2, cycles: 2 };
  }
  if (mode === "other") throw new Error(`Unmodelled addressing mode: ${text}`);
  const table = {
    read: { zeroPage: 3, zeroPageIndexed: 4, absolute: 4, absoluteIndexed: 4 },
    store: { zeroPage: 3, zeroPageIndexed: 4, absolute: 4, absoluteIndexed: 5 },
    modify: { zeroPage: 5, zeroPageIndexed: 6, absolute: 6, absoluteIndexed: 7 },
  } as const;
  const group = readMnemonics.has(mnemonic)
    ? "read"
    : storeMnemonics.has(mnemonic)
      ? "store"
      : modifyMnemonics.has(mnemonic)
        ? "modify"
        : undefined;
  if (group === undefined) throw new Error(`Unmodelled instruction: ${text}`);
  const bytes = mode === "zeroPage" || mode === "zeroPageIndexed" ? 2 : 3;
  return { bytes, cycles: table[group][mode] };
}

/** Exact encoded size of the whole emitted routine. */
export function routineBytes(decoded: readonly Decoded[]): number {
  return decoded.reduce((total, entry) => total + cost(entry.instruction).bytes, 0);
}

/**
 * Cycles charged once for taking a loop's closing branch.
 *
 * Taking a branch costs one extra cycle, and a second one when its target lies
 * in a different page from the instruction after it. That depends on where the
 * routine was placed, never on how long it is, so both addresses are read from
 * the emitted origin directives. When those addresses are not stated the
 * same-page charge is used, which is the only figure available.
 */
function takenBranchCycles(decoded: readonly Decoded[], loop: Loop): number {
  const target = decoded[loop.start]?.address;
  const next = decoded[loop.end + 1]?.address;
  if (target === undefined || next === undefined) return 1;
  return (target & 0xff00) === (next & 0xff00) ? 1 : 2;
}

/**
 * Exact cycles of a bottom-tested counted loop that runs a known number of trips.
 *
 * Each instruction contributes its own cost, repeated for instructions inside
 * the loop, and the closing branch is taken on every trip except the last.
 */
export function routineCycles(decoded: readonly Decoded[], loop: Loop, trips: number): number {
  let total = 0;
  for (const [position, entry] of decoded.entries()) {
    const { cycles } = cost(entry.instruction);
    total += position >= loop.start && position <= loop.end ? cycles * trips : cycles;
  }
  return total + (trips - 1) * takenBranchCycles(decoded, loop);
}

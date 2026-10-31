import type { MachineInstruction } from "./machine-types.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { CpuFacts } from "../target/nmos6510.js";

/** One possible-address envelope for a selected NMOS bus access. */
export interface InstructionAccessEnvelope {
  /** A dummy read is still a real read when it reaches a mapped device. */
  readonly kind: "read" | "write";
  /** Distinguish opcode fetches, pointer bytes, discarded reads and effective data. */
  readonly role: "fetch" | "pointer" | "dummy" | "data";
  /** Inclusive possible addresses; this is not an ordered execution trace. */
  readonly ranges: readonly StorageRange[];
}

/** Actual instruction and already-proved value domains at its final placement. */
export interface InstructionAccessInput {
  /** Selected processor, not a host or a related processor's bus contract. */
  readonly cpu: CpuFacts;
  /** Actual selected instruction; optional memory annotations are not authoritative here. */
  readonly instruction: MachineInstruction;
  /** Final instruction address, including any branch/layout repair. */
  readonly pc: number;
  /** Final symbol origins when the structured operand still names a label. */
  readonly labels?: ReadonlyMap<string, number>;
  /** Proven inclusive X/Y domain; absence retains the complete byte domain. */
  readonly index?: StorageRange;
  /** Proven pointer values before Y addition, or final targets for indexed-indirect X. */
  readonly pointees?: readonly StorageRange[];
}

/** Data-reading official opcodes; immediate and accumulator forms are handled separately. */
const READ_OPCODES = new Set([
  "adc",
  "and",
  "bit",
  "cmp",
  "cpx",
  "cpy",
  "eor",
  "lda",
  "ldx",
  "ldy",
  "ora",
  "sbc",
]);
/** Official memory stores, whose NMOS indexed forms always perform the dummy read. */
const WRITE_OPCODES = new Set(["sta", "stx", "sty"]);
/** NMOS memory RMW performs a read, an old-value write and then the new-value write. */
const RMW_OPCODES = new Set(["asl", "dec", "inc", "lsr", "rol", "ror"]);
/** These implied forms touch no stack or vector bytes, but still read the next PC. */
const INTERNAL_OPCODES = new Set([
  "clc",
  "cld",
  "cli",
  "clv",
  "dex",
  "dey",
  "inx",
  "iny",
  "nop",
  "sec",
  "sed",
  "sei",
  "tax",
  "tay",
  "tsx",
  "txa",
  "txs",
  "tya",
]);

/**
 * Reject malformed domains rather than allowing NaN or an empty set to hide an access.
 * @param range Inclusive nonnegative domain to check.
 * @param maximum Largest permitted endpoint, such as FF or FFFF.
 * @returns Whether both endpoints are ordered safe integers inside that domain.
 */
export function validRange(range: StorageRange, maximum: number): boolean {
  return (
    Number.isSafeInteger(range.start) &&
    Number.isSafeInteger(range.end) &&
    range.start >= 0 &&
    range.start <= range.end &&
    range.end <= maximum
  );
}

/** Merge only within one access; merging separate RMW writes would lose their multiplicity. */
function mergeRanges(ranges: readonly StorageRange[]): readonly StorageRange[] {
  const merged: StorageRange[] = [];
  for (const range of [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  )) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end + 1)
      merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    else merged.push({ start: range.start, end: range.end });
  }
  return Object.freeze(merged.map((range) => Object.freeze(range)));
}

/**
 * Split a modular interval without enumerating all addresses or byte-index combinations.
 * @param start First nonnegative integer before wrapping; callers validate the source domain.
 * @param end Last integer, no smaller than start.
 * @param modulus Address-space size, normally 65536 or 256 for zero-page arithmetic.
 * @returns One or two inclusive intervals, or the full domain when the span covers it.
 */
export function wrappedRange(
  start: number,
  end: number,
  modulus = 0x10000,
): readonly StorageRange[] {
  if (end - start + 1 >= modulus) return [{ start: 0, end: modulus - 1 }];
  const first = start % modulus;
  const last = first + end - start;
  return last < modulus
    ? [{ start: first, end: last }]
    : [
        { start: first, end: modulus - 1 },
        { start: 0, end: last % modulus },
      ];
}

/**
 * Resolve final physical operands only; an unbound storage request is not an address.
 * @param input Selected operand and actual final symbol origins.
 * @returns Resolved numeric operand, or null when unavailable. Callers validate its range.
 */
export function operandAddress(input: InstructionAccessInput): number | null {
  const operand = input.instruction.operand;
  if (operand?.kind === "absolute") return operand.value;
  if (
    operand?.kind !== "label" ||
    operand.addressByte !== undefined ||
    operand.transform !== undefined
  )
    return null;
  const base = input.labels?.get(operand.label);
  return base === undefined ? null : base + (operand.offset ?? 0);
}

/**
 * Bound discarded indexed reads with the base's original high byte. A crossing
 * read performs this access only when low+index exceeds FF. A store/RMW performs
 * it even without crossing. At most 256 source pages are inspected, not 65536×256
 * combinations, and each page contributes at most two low-byte intervals.
 */
function indexedDummyRanges(
  bases: readonly StorageRange[],
  index: StorageRange,
  crossingOnly: boolean,
): readonly StorageRange[] {
  const result: StorageRange[] = [];
  for (const range of bases) {
    for (let page = range.start & 0xff00; page <= range.end; page += 0x100) {
      const lowStart = Math.max(page, range.start) - page;
      const lowEnd = Math.min(page + 0xff, range.end) - page;
      const first = Math.max(crossingOnly ? 0x100 : 0, lowStart + index.start);
      const last = lowEnd + index.end;
      if (first > last) continue;
      for (const wrapped of wrappedRange(first, last, 0x100))
        result.push({ start: page + wrapped.start, end: page + wrapped.end });
    }
  }
  return mergeRanges(result);
}

/**
 * Decode possible fetch/data/pointer/dummy addresses from actual NMOS forms.
 * Domains supplied by the caller must come from source/provenance proof. Missing
 * indirect targets remain unknown; optional instruction.memory never narrows them.
 * Separate entries preserve both RMW writes, but are not a cycle-by-cycle trace.
 * Stack/control transfers need their own route proof and return null here.
 * This query neither validates a whole candidate nor proves banking or MMIO order.
 *
 * @param input Final instruction placement and independently proved byte/pointer domains.
 * @returns Immutable access envelopes, or null for unsupported or unavailable evidence.
 * @example
 * instructionAccessEnvelope({ cpu, instruction, pc: 0x0900 });
 */
export function instructionAccessEnvelope(
  input: InstructionAccessInput,
): readonly InstructionAccessEnvelope[] | null {
  const { instruction, cpu, pc } = input;
  if (!Object.hasOwn(cpu.opcodes, instruction.opcode)) return null;
  const form = cpu.opcodes[instruction.opcode]?.forms.find(({ mode }) => mode === instruction.mode);
  const index = input.index ?? { start: 0, end: 0xff };
  if (
    cpu.id !== "nmos6510" ||
    !validRange({ start: pc, end: pc }, 0xffff) ||
    form === undefined ||
    form.bytes !== instruction.cost.bytes ||
    !validRange(index, 0xff) ||
    (input.pointees !== undefined &&
      (input.pointees.length === 0 || !input.pointees.every((range) => validRange(range, 0xffff))))
  )
    return null;
  const accesses: InstructionAccessEnvelope[] = [];
  const add = (
    kind: InstructionAccessEnvelope["kind"],
    role: InstructionAccessEnvelope["role"],
    ranges: readonly StorageRange[],
  ) => {
    if (ranges.length > 0)
      accesses.push(Object.freeze({ kind, role, ranges: mergeRanges(ranges) }));
  };
  const at = (address: number): readonly StorageRange[] => [{ start: address, end: address }];
  add("read", "fetch", wrappedRange(pc, pc + form.bytes - 1));
  if (instruction.mode === "immediate")
    return instruction.operand !== null && READ_OPCODES.has(instruction.opcode)
      ? Object.freeze(accesses)
      : null;
  if (instruction.mode === "implied" || instruction.mode === "accumulator") {
    if (!(instruction.mode === "implied" ? INTERNAL_OPCODES : RMW_OPCODES).has(instruction.opcode))
      return null;
    add("read", "dummy", at((pc + 1) & 0xffff));
    return Object.freeze(accesses);
  }
  const address = operandAddress(input);
  if (address === null || !validRange({ start: address, end: address }, 0xffff)) return null;
  if (instruction.opcode === "jmp" && instruction.mode === "indirect") {
    add("read", "pointer", at(address));
    add("read", "pointer", at((address & 0xff00) | ((address + 1) & 0xff)));
    return Object.freeze(accesses);
  }
  const write = WRITE_OPCODES.has(instruction.opcode);
  const rmw = RMW_OPCODES.has(instruction.opcode);
  if (!write && !rmw && !READ_OPCODES.has(instruction.opcode)) return null;
  let targets: readonly StorageRange[];
  if (instruction.mode === "absolute" || instruction.mode === "zero-page") {
    if (instruction.mode === "zero-page" && address > 0xff) return null;
    targets = at(address);
  } else if (instruction.mode === "zero-page-x" || instruction.mode === "zero-page-y") {
    if (address > 0xff) return null;
    add("read", "dummy", at(address));
    targets = wrappedRange(address + index.start, address + index.end, 0x100);
  } else if (instruction.mode === "absolute-x" || instruction.mode === "absolute-y") {
    add("read", "dummy", indexedDummyRanges(at(address), index, !write && !rmw));
    targets = wrappedRange(address + index.start, address + index.end);
  } else if (
    instruction.mode === "indexed-indirect-x" ||
    instruction.mode === "indirect-indexed-y"
  ) {
    if (address > 0xff || input.pointees === undefined) return null;
    if (instruction.mode === "indexed-indirect-x") {
      add("read", "dummy", at(address));
      add("read", "pointer", wrappedRange(address + index.start, address + index.end, 0x100));
      add(
        "read",
        "pointer",
        wrappedRange(address + index.start + 1, address + index.end + 1, 0x100),
      );
      targets = input.pointees;
    } else {
      add("read", "pointer", at(address));
      add("read", "pointer", at((address + 1) & 0xff));
      add("read", "dummy", indexedDummyRanges(input.pointees, index, !write));
      targets = input.pointees.flatMap((range) =>
        wrappedRange(range.start + index.start, range.end + index.end),
      );
    }
  } else return null;
  if (!write) add("read", "data", targets);
  if (rmw) add("write", "data", targets);
  if (write || rmw) add("write", "data", targets);
  return Object.freeze(accesses);
}

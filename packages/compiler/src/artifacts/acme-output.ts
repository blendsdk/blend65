import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineOperand,
} from "../machine/machine-types.js";
import type { AcmeSerializationResult } from "./acme-serializer.js";
import type { CompleteC64Layout } from "./acme-validate.js";
import { verifyPrg } from "./prg.js";

/** Inputs captured from one successful ACME process before publication. */
export interface AcmeOutputVerificationInput {
  /** Final expected labels and loaded segments. */
  readonly serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }>;
  /** Final address layout and structured machine program. */
  readonly layout: CompleteC64Layout;
  /** ACME listing report bytes. */
  readonly report: Uint8Array;
  /** ACME symbol-list bytes. */
  readonly labels: Uint8Array;
  /** Complete CBM PRG bytes. */
  readonly prg: Uint8Array;
}

/** Successful terminal reconciliation or a closed validation failure. */
export type AcmeOutputVerificationResult =
  | { readonly kind: "complete"; readonly report: string; readonly labels: string }
  | { readonly kind: "error"; readonly diagnostic: string };

interface CodeRecord {
  readonly address: number;
  readonly bytes: Uint8Array;
}

const OPCODE_BYTES: Readonly<Record<string, number>> = Object.freeze({
  "adc/immediate": 0x69,
  "adc/zero-page": 0x65,
  "adc/zero-page-x": 0x75,
  "adc/absolute": 0x6d,
  "adc/absolute-x": 0x7d,
  "adc/absolute-y": 0x79,
  "adc/indexed-indirect-x": 0x61,
  "adc/indirect-indexed-y": 0x71,
  "and/immediate": 0x29,
  "and/zero-page": 0x25,
  "and/zero-page-x": 0x35,
  "and/absolute": 0x2d,
  "and/absolute-x": 0x3d,
  "and/absolute-y": 0x39,
  "and/indexed-indirect-x": 0x21,
  "and/indirect-indexed-y": 0x31,
  "asl/accumulator": 0x0a,
  "asl/zero-page": 0x06,
  "asl/zero-page-x": 0x16,
  "asl/absolute": 0x0e,
  "asl/absolute-x": 0x1e,
  "bcc/relative": 0x90,
  "bcs/relative": 0xb0,
  "beq/relative": 0xf0,
  "bmi/relative": 0x30,
  "bne/relative": 0xd0,
  "bpl/relative": 0x10,
  "bvc/relative": 0x50,
  "bvs/relative": 0x70,
  "bit/zero-page": 0x24,
  "bit/absolute": 0x2c,
  "brk/implied": 0x00,
  "clc/implied": 0x18,
  "cld/implied": 0xd8,
  "cli/implied": 0x58,
  "clv/implied": 0xb8,
  "cmp/immediate": 0xc9,
  "cmp/zero-page": 0xc5,
  "cmp/zero-page-x": 0xd5,
  "cmp/absolute": 0xcd,
  "cmp/absolute-x": 0xdd,
  "cmp/absolute-y": 0xd9,
  "cmp/indexed-indirect-x": 0xc1,
  "cmp/indirect-indexed-y": 0xd1,
  "cpx/immediate": 0xe0,
  "cpx/zero-page": 0xe4,
  "cpx/absolute": 0xec,
  "cpy/immediate": 0xc0,
  "cpy/zero-page": 0xc4,
  "cpy/absolute": 0xcc,
  "dec/zero-page": 0xc6,
  "dec/zero-page-x": 0xd6,
  "dec/absolute": 0xce,
  "dec/absolute-x": 0xde,
  "dex/implied": 0xca,
  "dey/implied": 0x88,
  "eor/immediate": 0x49,
  "eor/zero-page": 0x45,
  "eor/zero-page-x": 0x55,
  "eor/absolute": 0x4d,
  "eor/absolute-x": 0x5d,
  "eor/absolute-y": 0x59,
  "eor/indexed-indirect-x": 0x41,
  "eor/indirect-indexed-y": 0x51,
  "inc/zero-page": 0xe6,
  "inc/zero-page-x": 0xf6,
  "inc/absolute": 0xee,
  "inc/absolute-x": 0xfe,
  "inx/implied": 0xe8,
  "iny/implied": 0xc8,
  "jmp/absolute": 0x4c,
  "jmp/indirect": 0x6c,
  "jsr/absolute": 0x20,
  "lda/immediate": 0xa9,
  "lda/zero-page": 0xa5,
  "lda/zero-page-x": 0xb5,
  "lda/absolute": 0xad,
  "lda/absolute-x": 0xbd,
  "lda/absolute-y": 0xb9,
  "lda/indexed-indirect-x": 0xa1,
  "lda/indirect-indexed-y": 0xb1,
  "ldx/immediate": 0xa2,
  "ldx/zero-page": 0xa6,
  "ldx/zero-page-y": 0xb6,
  "ldx/absolute": 0xae,
  "ldx/absolute-y": 0xbe,
  "ldy/immediate": 0xa0,
  "ldy/zero-page": 0xa4,
  "ldy/zero-page-x": 0xb4,
  "ldy/absolute": 0xac,
  "ldy/absolute-x": 0xbc,
  "lsr/accumulator": 0x4a,
  "lsr/zero-page": 0x46,
  "lsr/zero-page-x": 0x56,
  "lsr/absolute": 0x4e,
  "lsr/absolute-x": 0x5e,
  "nop/implied": 0xea,
  "ora/immediate": 0x09,
  "ora/zero-page": 0x05,
  "ora/zero-page-x": 0x15,
  "ora/absolute": 0x0d,
  "ora/absolute-x": 0x1d,
  "ora/absolute-y": 0x19,
  "ora/indexed-indirect-x": 0x01,
  "ora/indirect-indexed-y": 0x11,
  "pha/implied": 0x48,
  "php/implied": 0x08,
  "pla/implied": 0x68,
  "plp/implied": 0x28,
  "rol/accumulator": 0x2a,
  "rol/zero-page": 0x26,
  "rol/zero-page-x": 0x36,
  "rol/absolute": 0x2e,
  "rol/absolute-x": 0x3e,
  "ror/accumulator": 0x6a,
  "ror/zero-page": 0x66,
  "ror/zero-page-x": 0x76,
  "ror/absolute": 0x6e,
  "ror/absolute-x": 0x7e,
  "rti/implied": 0x40,
  "rts/implied": 0x60,
  "sbc/immediate": 0xe9,
  "sbc/zero-page": 0xe5,
  "sbc/zero-page-x": 0xf5,
  "sbc/absolute": 0xed,
  "sbc/absolute-x": 0xfd,
  "sbc/absolute-y": 0xf9,
  "sbc/indexed-indirect-x": 0xe1,
  "sbc/indirect-indexed-y": 0xf1,
  "sec/implied": 0x38,
  "sed/implied": 0xf8,
  "sei/implied": 0x78,
  "sta/zero-page": 0x85,
  "sta/zero-page-x": 0x95,
  "sta/absolute": 0x8d,
  "sta/absolute-x": 0x9d,
  "sta/absolute-y": 0x99,
  "sta/indexed-indirect-x": 0x81,
  "sta/indirect-indexed-y": 0x91,
  "stx/zero-page": 0x86,
  "stx/zero-page-y": 0x96,
  "stx/absolute": 0x8e,
  "sty/zero-page": 0x84,
  "sty/zero-page-x": 0x94,
  "sty/absolute": 0x8c,
  "tax/implied": 0xaa,
  "tay/implied": 0xa8,
  "tsx/implied": 0xba,
  "txa/implied": 0x8a,
  "txs/implied": 0x9a,
  "tya/implied": 0x98,
});

/** Return a safe immutable ACME output failure. */
function failure(diagnostic: string): AcmeOutputVerificationResult {
  return Object.freeze({ kind: "error", diagnostic });
}

/** Decode tool text strictly so replacement characters cannot hide malformed evidence. */
function decode(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Parse ACME's fixed symbol-list spelling into one exact name/address map. */
function parseLabels(text: string): ReadonlyMap<string, number> | null {
  const labels = new Map<string, number>();
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim().length === 0) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$([0-9a-fA-F]{1,4})(?:\s*;.*)?\s*$/u.exec(
      line,
    );
    if (match === null || labels.has(match[1]!)) return null;
    labels.set(match[1]!, Number.parseInt(match[2]!, 16));
  }
  return labels;
}

/** Resolve one terminal operand to its exact unsigned value. */
function operandValue(
  operand: MachineOperand | null,
  labels: ReadonlyMap<string, number>,
): number | null {
  if (operand?.kind === "immediate" || operand?.kind === "absolute") return operand.value;
  if (operand?.kind !== "label") return null;
  const address = labels.get(operand.label);
  if (address === undefined) return null;
  const value = address + (operand.offset ?? 0);
  if (operand.addressByte === "low") return value & 0xff;
  if (operand.addressByte === "high") return (value >>> 8) & 0xff;
  return value;
}

/** Independently encode one already-selected documented NMOS instruction. */
function instructionBytes(
  instruction: MachineInstruction,
  labels: ReadonlyMap<string, number>,
): Uint8Array | null {
  const opcode = OPCODE_BYTES[`${instruction.opcode}/${instruction.mode}`];
  if (opcode === undefined) return null;
  if (instruction.cost.bytes === 1) return Uint8Array.of(opcode);
  if (instruction.opcode === "brk" && instruction.cost.bytes === 2) {
    return Uint8Array.of(opcode, 0x00);
  }
  const value = operandValue(instruction.operand, labels);
  if (value === null || value < 0 || value > 0xffff) return null;
  if (instruction.cost.bytes === 2 && value <= 0xff) return Uint8Array.of(opcode, value);
  if (instruction.cost.bytes === 3) {
    return Uint8Array.of(opcode, value & 0xff, (value >>> 8) & 0xff);
  }
  return null;
}

/** Independently encode one relative branch to a known final label. */
function branchBytes(
  opcode: string,
  address: number,
  target: string,
  labels: ReadonlyMap<string, number>,
): Uint8Array | null {
  const opcodeByte = OPCODE_BYTES[`${opcode}/relative`];
  const targetAddress = labels.get(target);
  if (opcodeByte === undefined || targetAddress === undefined) return null;
  const displacement = targetAddress - (address + 2);
  if (displacement < -128 || displacement > 127) return null;
  return Uint8Array.of(opcodeByte, displacement & 0xff);
}

/** Return exact expected machine bytes in one block. */
function blockRecords(
  block: MachineBlock,
  labels: ReadonlyMap<string, number>,
): readonly CodeRecord[] | null {
  const records: CodeRecord[] = [];
  let address = block.origin!;
  for (const instruction of block.instructions) {
    const bytes = instructionBytes(instruction, labels);
    if (bytes === null || bytes.byteLength !== instruction.cost.bytes) return null;
    records.push(Object.freeze({ address, bytes }));
    address += bytes.byteLength;
  }
  const terminator = block.terminator;
  if (terminator.kind === "branch") {
    const bytes = branchBytes(terminator.opcode, address, terminator.target, labels);
    if (bytes === null) return null;
    records.push(Object.freeze({ address, bytes }));
  } else if (terminator.kind === "long-branch") {
    const branch = branchBytes(terminator.opcode, address, terminator.fallthrough, labels);
    const target = labels.get(terminator.jump.target);
    if (branch === null || target === undefined) return null;
    records.push(Object.freeze({ address, bytes: branch }));
    records.push(
      Object.freeze({
        address: address + 2,
        bytes: Uint8Array.of(OPCODE_BYTES["jmp/absolute"]!, target & 0xff, target >>> 8),
      }),
    );
  } else if (terminator.kind === "jump") {
    const target = labels.get(terminator.target);
    if (target === undefined) return null;
    records.push(
      Object.freeze({
        address,
        bytes: Uint8Array.of(OPCODE_BYTES["jmp/absolute"]!, target & 0xff, target >>> 8),
      }),
    );
  } else if (terminator.kind === "return") {
    records.push(Object.freeze({ address, bytes: Uint8Array.of(OPCODE_BYTES["rts/implied"]!) }));
  }
  return Object.freeze(records);
}

/** Collect code records from startup and ordinary functions. */
function codeRecords(
  layout: CompleteC64Layout,
  labels: ReadonlyMap<string, number>,
): readonly CodeRecord[] | null {
  const functions: readonly MachineFunction[] = [
    layout.program.startup,
    ...layout.program.functions,
  ];
  const blocks = functions.flatMap(({ blocks }) =>
    blocks.map((block) => blockRecords(block, labels)),
  );
  if (blocks.some((records) => records === null)) return null;
  return Object.freeze(
    blocks.flatMap((records) => records ?? []).sort((left, right) => left.address - right.address),
  );
}

/** Parse the complete byte spelling from each non-truncated ACME report line. */
function reportBytes(text: string): ReadonlyMap<number, Uint8Array> | null {
  const records = new Map<number, Uint8Array>();
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*\d+\s+([0-9a-fA-F]{4})\s+([0-9a-fA-F]+)(\.\.\.)?/u.exec(line);
    if (match === null || match[3] !== undefined) continue;
    const hex = match[2]!;
    if (hex.length === 0 || hex.length % 2 !== 0) return null;
    const address = Number.parseInt(match[1]!, 16);
    if (records.has(address)) return null;
    records.set(
      address,
      Uint8Array.from(hex.match(/.{2}/gu)!.map((pair) => Number.parseInt(pair, 16))),
    );
  }
  return records;
}

/** Check exact expected labels with no extra assembler-visible symbol. */
function labelsAgree(
  actual: ReadonlyMap<string, number>,
  serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }>,
): boolean {
  if (actual.size !== serialization.expectedLabels.length) return false;
  return serialization.expectedLabels.every(({ name, address }) => actual.get(name) === address);
}

/** Check that serialized segments are exactly the loaded layout intervals. */
function segmentsAgree(
  layout: CompleteC64Layout,
  serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }>,
): boolean {
  const loaded = layout.intervals.filter(({ bytes, kind }) => bytes !== null && kind !== "sfa");
  return (
    loaded.length === serialization.expectedSegments.length &&
    loaded.every(({ id, start, end }, index) => {
      const expected = serialization.expectedSegments[index];
      return expected?.id === id && expected.start === start && expected.end === end;
    })
  );
}

/**
 * Reconcile ACME's report, symbol list, machine bytes, and CBM PRG against final compiler facts.
 *
 * @param input Captured outputs plus the immutable serialization and layout expectations.
 * @returns Strictly decoded report/labels on success, or a closed failure.
 * @example verifyAcmeOutput({ serialization, layout, report, labels, prg }).kind === "complete"
 */
export function verifyAcmeOutput(input: AcmeOutputVerificationInput): AcmeOutputVerificationResult {
  const report = decode(input.report);
  const labelText = decode(input.labels);
  if (report === null || labelText === null) {
    return failure("ACME produced malformed UTF-8 report or symbol evidence");
  }
  const labels = parseLabels(labelText);
  if (labels === null || !labelsAgree(labels, input.serialization)) {
    return failure("ACME's symbol list disagrees with the expected final labels");
  }
  if (!segmentsAgree(input.layout, input.serialization)) {
    return failure("The serialized segment plan disagrees with the final layout");
  }
  const prg = verifyPrg(input.layout, input.prg);
  if (prg.kind === "error") return failure(prg.diagnostic);

  const listing = reportBytes(report);
  if (listing === null) return failure("ACME's report contains malformed or duplicate byte rows");
  const labelAddresses = new Map(
    input.serialization.expectedLabels.map(({ id, address }) => [id, address] as const),
  );
  const code = codeRecords(input.layout, labelAddresses);
  const codeIntervals = input.layout.intervals.filter(({ kind }) => kind === "code");
  if (codeIntervals.length === 0 || code === null || code.length === 0) {
    return failure("The final layout has no machine-code evidence to reconcile");
  }
  let checkedRecords = 0;
  for (const interval of codeIntervals) {
    let nextAddress = interval.start;
    while (checkedRecords < code.length && code[checkedRecords]!.address <= interval.end) {
      const record = code[checkedRecords]!;
      if (
        record.address < nextAddress ||
        record.address + record.bytes.byteLength - 1 > interval.end
      ) {
        return failure("Structured machine-code ranges disagree with the final code segment");
      }
      for (let address = nextAddress; address < record.address; address += 1) {
        if (prg.body[address - prg.loadAddress] !== 0) {
          return failure(
            "Unoccupied code-placement bytes are not zero-filled in the assembled PRG",
          );
        }
      }
      const reported = listing.get(record.address);
      if (reported === undefined || reported.byteLength !== record.bytes.byteLength) {
        return failure("ACME's report disagrees with a selected instruction width");
      }
      const offset = record.address - prg.loadAddress;
      for (let index = 0; index < reported.byteLength; index += 1) {
        if (
          prg.body[offset + index] !== reported[index] ||
          reported[index] !== record.bytes[index]
        ) {
          return failure("ACME's report bytes disagree with the assembled PRG body");
        }
      }
      nextAddress = record.address + record.bytes.byteLength;
      checkedRecords += 1;
    }
    for (let address = nextAddress; address <= interval.end; address += 1) {
      if (prg.body[address - prg.loadAddress] !== 0) {
        return failure("Unoccupied code-placement bytes are not zero-filled in the assembled PRG");
      }
    }
  }
  if (checkedRecords !== code.length) {
    return failure("Structured machine-code ranges disagree with the final code segment");
  }
  return Object.freeze({ kind: "complete", report, labels: labelText });
}

/**
 * ACME report-file parser — `parseReportFile`.
 *
 * ACME's `--report` output lists, for every emitted line: the source line
 * number, the final assembled address (4 hex digits), the emitted bytes (hex
 * pairs), and the source text. This parser turns the instruction lines into
 * classified `(opcode, mode, address, bytes, operand)` records typed on
 * core's instr-model unions.
 *
 * The addressing mode comes from the EMITTED OPCODE BYTE, never from the
 * operand text: `lda some_sym` is zeropage or absolute depending only on
 * what ACME encoded — the two are indistinguishable in source, which is why
 * no cost consumer parses raw assembly. Data lines (`!byte`, `!fill`, …) and
 * label-only lines produce no records; anything that looks like a code line
 * but cannot be decoded consistently fails loudly naming the file and line.
 *
 * One module serves every cost consumer (budget windows, twin diffing,
 * cycle annotation), concentrating the ACME-format risk in one place.
 * Pure text→data, no I/O. Lives in `@blend65/compiler`.
 */

import { getTiming, OPCODES } from "@blend65/core/platform";
import type { AddressingMode, NmosOpcode } from "@blend65/core/platform";

/** One classified instruction from an ACME report. */
export interface ReportInstruction {
  /** The report's source line number. */
  readonly line: number;
  /** The final assembled address. */
  readonly address: number;
  /** The emitted bytes (opcode + operand). */
  readonly bytes: Uint8Array;
  /** The decoded mnemonic. */
  readonly opcode: NmosOpcode;
  /** The addressing mode, decoded from the opcode byte. */
  readonly mode: AddressingMode;
  /**
   * The decoded operand: the immediate/address value, or the resolved TARGET
   * address for a relative branch; `null` for implied/accumulator modes.
   */
  readonly operand: number | null;
}

/** One row of the documented NMOS opcode matrix: byte → (mnemonic, mode). */
type EncodingRow = readonly [number, NmosOpcode, AddressingMode];

/**
 * The 151 documented NMOS 6502 encodings, grouped by family — the canonical
 * opcode matrix (the same data every assembler encodes).
 */
const ENCODING_ROWS: readonly EncodingRow[] = [
  // Load/store accumulator.
  [0xa9, "LDA", "Immediate"], [0xa5, "LDA", "ZeroPage"], [0xb5, "LDA", "ZeroPageX"],
  [0xad, "LDA", "Absolute"], [0xbd, "LDA", "AbsoluteX"], [0xb9, "LDA", "AbsoluteY"],
  [0xa1, "LDA", "IndirectX"], [0xb1, "LDA", "IndirectY"],
  [0x85, "STA", "ZeroPage"], [0x95, "STA", "ZeroPageX"], [0x8d, "STA", "Absolute"],
  [0x9d, "STA", "AbsoluteX"], [0x99, "STA", "AbsoluteY"], [0x81, "STA", "IndirectX"],
  [0x91, "STA", "IndirectY"],
  // Load/store index registers.
  [0xa2, "LDX", "Immediate"], [0xa6, "LDX", "ZeroPage"], [0xb6, "LDX", "ZeroPageY"],
  [0xae, "LDX", "Absolute"], [0xbe, "LDX", "AbsoluteY"],
  [0xa0, "LDY", "Immediate"], [0xa4, "LDY", "ZeroPage"], [0xb4, "LDY", "ZeroPageX"],
  [0xac, "LDY", "Absolute"], [0xbc, "LDY", "AbsoluteX"],
  [0x86, "STX", "ZeroPage"], [0x96, "STX", "ZeroPageY"], [0x8e, "STX", "Absolute"],
  [0x84, "STY", "ZeroPage"], [0x94, "STY", "ZeroPageX"], [0x8c, "STY", "Absolute"],
  // ALU ops.
  [0x69, "ADC", "Immediate"], [0x65, "ADC", "ZeroPage"], [0x75, "ADC", "ZeroPageX"],
  [0x6d, "ADC", "Absolute"], [0x7d, "ADC", "AbsoluteX"], [0x79, "ADC", "AbsoluteY"],
  [0x61, "ADC", "IndirectX"], [0x71, "ADC", "IndirectY"],
  [0x29, "AND", "Immediate"], [0x25, "AND", "ZeroPage"], [0x35, "AND", "ZeroPageX"],
  [0x2d, "AND", "Absolute"], [0x3d, "AND", "AbsoluteX"], [0x39, "AND", "AbsoluteY"],
  [0x21, "AND", "IndirectX"], [0x31, "AND", "IndirectY"],
  [0xc9, "CMP", "Immediate"], [0xc5, "CMP", "ZeroPage"], [0xd5, "CMP", "ZeroPageX"],
  [0xcd, "CMP", "Absolute"], [0xdd, "CMP", "AbsoluteX"], [0xd9, "CMP", "AbsoluteY"],
  [0xc1, "CMP", "IndirectX"], [0xd1, "CMP", "IndirectY"],
  [0x49, "EOR", "Immediate"], [0x45, "EOR", "ZeroPage"], [0x55, "EOR", "ZeroPageX"],
  [0x4d, "EOR", "Absolute"], [0x5d, "EOR", "AbsoluteX"], [0x59, "EOR", "AbsoluteY"],
  [0x41, "EOR", "IndirectX"], [0x51, "EOR", "IndirectY"],
  [0x09, "ORA", "Immediate"], [0x05, "ORA", "ZeroPage"], [0x15, "ORA", "ZeroPageX"],
  [0x0d, "ORA", "Absolute"], [0x1d, "ORA", "AbsoluteX"], [0x19, "ORA", "AbsoluteY"],
  [0x01, "ORA", "IndirectX"], [0x11, "ORA", "IndirectY"],
  [0xe9, "SBC", "Immediate"], [0xe5, "SBC", "ZeroPage"], [0xf5, "SBC", "ZeroPageX"],
  [0xed, "SBC", "Absolute"], [0xfd, "SBC", "AbsoluteX"], [0xf9, "SBC", "AbsoluteY"],
  [0xe1, "SBC", "IndirectX"], [0xf1, "SBC", "IndirectY"],
  // Shifts/rotates.
  [0x0a, "ASL", "Accumulator"], [0x06, "ASL", "ZeroPage"], [0x16, "ASL", "ZeroPageX"],
  [0x0e, "ASL", "Absolute"], [0x1e, "ASL", "AbsoluteX"],
  [0x4a, "LSR", "Accumulator"], [0x46, "LSR", "ZeroPage"], [0x56, "LSR", "ZeroPageX"],
  [0x4e, "LSR", "Absolute"], [0x5e, "LSR", "AbsoluteX"],
  [0x2a, "ROL", "Accumulator"], [0x26, "ROL", "ZeroPage"], [0x36, "ROL", "ZeroPageX"],
  [0x2e, "ROL", "Absolute"], [0x3e, "ROL", "AbsoluteX"],
  [0x6a, "ROR", "Accumulator"], [0x66, "ROR", "ZeroPage"], [0x76, "ROR", "ZeroPageX"],
  [0x6e, "ROR", "Absolute"], [0x7e, "ROR", "AbsoluteX"],
  // Increment/decrement memory.
  [0xe6, "INC", "ZeroPage"], [0xf6, "INC", "ZeroPageX"], [0xee, "INC", "Absolute"],
  [0xfe, "INC", "AbsoluteX"],
  [0xc6, "DEC", "ZeroPage"], [0xd6, "DEC", "ZeroPageX"], [0xce, "DEC", "Absolute"],
  [0xde, "DEC", "AbsoluteX"],
  // Compare index registers / bit test.
  [0xe0, "CPX", "Immediate"], [0xe4, "CPX", "ZeroPage"], [0xec, "CPX", "Absolute"],
  [0xc0, "CPY", "Immediate"], [0xc4, "CPY", "ZeroPage"], [0xcc, "CPY", "Absolute"],
  [0x24, "BIT", "ZeroPage"], [0x2c, "BIT", "Absolute"],
  // Jumps and subroutine linkage.
  [0x4c, "JMP", "Absolute"], [0x6c, "JMP", "Indirect"], [0x20, "JSR", "Absolute"],
  // Branches.
  [0x90, "BCC", "Relative"], [0xb0, "BCS", "Relative"], [0xf0, "BEQ", "Relative"],
  [0x30, "BMI", "Relative"], [0xd0, "BNE", "Relative"], [0x10, "BPL", "Relative"],
  [0x50, "BVC", "Relative"], [0x70, "BVS", "Relative"],
  // Implied-only operations.
  [0x00, "BRK", "Implied"], [0x18, "CLC", "Implied"], [0xd8, "CLD", "Implied"],
  [0x58, "CLI", "Implied"], [0xb8, "CLV", "Implied"], [0xca, "DEX", "Implied"],
  [0x88, "DEY", "Implied"], [0xe8, "INX", "Implied"], [0xc8, "INY", "Implied"],
  [0xea, "NOP", "Implied"], [0x48, "PHA", "Implied"], [0x08, "PHP", "Implied"],
  [0x68, "PLA", "Implied"], [0x28, "PLP", "Implied"], [0x40, "RTI", "Implied"],
  [0x60, "RTS", "Implied"], [0x38, "SEC", "Implied"], [0xf8, "SED", "Implied"],
  [0x78, "SEI", "Implied"], [0xaa, "TAX", "Implied"], [0xa8, "TAY", "Implied"],
  [0xba, "TSX", "Implied"], [0x8a, "TXA", "Implied"], [0x9a, "TXS", "Implied"],
  [0x98, "TYA", "Implied"],
];

/** Byte → (mnemonic, mode) lookup built once from the matrix rows. */
const ENCODINGS: ReadonlyMap<number, readonly [NmosOpcode, AddressingMode]> = new Map(
  ENCODING_ROWS.map(([byte, opcode, mode]) => [byte, [opcode, mode] as const]),
);

/** Every representable mnemonic (NMOS + 65C02), uppercase, for line detection. */
const ALL_MNEMONICS: ReadonlySet<string> = new Set(OPCODES);

/** A report line carrying an address column: line no, hex address, rest. */
const ADDRESSED_LINE = /^\s*(\d+)\s+([0-9a-fA-F]{4})\s+(\S+)(?:\s+(.*))?$/;

/**
 * Divide a report line's bytes column from its source column.
 *
 * Normally whitespace separates them. But ACME truncates a long byte run with a
 * literal `...`, and a run long enough to fill the column's fixed width leaves
 * no trailing space — so when the source is a directive written at column 0,
 * supplying no leading space either, the two columns touch. The truncation
 * marker is then the only place the division can be read from.
 *
 * @param token The whitespace-delimited token following the address.
 * @param rest The remainder of the line after that token.
 * @returns The bytes column and the source column.
 */
function splitBytesColumn(token: string, rest: string): { bytes: string; source: string } {
  const marker = token.indexOf("...");
  if (marker === -1) {
    return { bytes: token, source: rest };
  }
  const trailing = token.slice(marker + 3);
  return {
    bytes: token.slice(0, marker + 3),
    source: trailing === "" ? rest : `${trailing} ${rest}`.trimEnd(),
  };
}

/** Decode the operand value for a mode from the emitted bytes. */
function decodeOperand(mode: AddressingMode, address: number, bytes: Uint8Array): number | null {
  switch (mode) {
    case "Implied":
    case "Accumulator":
      return null;
    case "Relative": {
      const displacement = bytes[1] < 0x80 ? bytes[1] : bytes[1] - 256;
      return (address + 2 + displacement) & 0xffff;
    }
    case "Absolute":
    case "AbsoluteX":
    case "AbsoluteY":
    case "Indirect":
      return bytes[1] | (bytes[2] << 8);
    default:
      // Immediate and all zeropage/indirect-zp single-byte operands.
      return bytes[1];
  }
}

/** The mnemonic token of a source column, skipping one optional label. */
function mnemonicToken(source: string): string | null {
  const tokens = source.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === "") return null;
  const first = tokens[0].toUpperCase();
  if (ALL_MNEMONICS.has(first)) return first;
  const second = tokens[1]?.toUpperCase();
  if (second !== undefined && ALL_MNEMONICS.has(second)) return second;
  return null;
}

/**
 * Parse an ACME `--report` file into classified instruction records.
 *
 * @param content The raw report text.
 * @param fileName The report's name, carried into every error message.
 * @returns The instruction records, in address order of appearance.
 * @throws {Error} Naming `fileName` and the line on an unparseable bytes
 *   column, an unknown opcode byte, a bytes/mode size mismatch, or a
 *   bytes/mnemonic disagreement — never a silent guess.
 * @example
 * const instructions = parseReportFile(readFileSync(path, "utf8"), path);
 */
export function parseReportFile(content: string, fileName: string): ReportInstruction[] {
  const records: ReportInstruction[] = [];
  for (const rawLine of content.split("\n")) {
    const match = ADDRESSED_LINE.exec(rawLine);
    if (match === null) {
      continue; // no address column: source-only line, header, or blank
    }
    const line = Number(match[1]);
    const address = parseInt(match[2], 16);
    const { bytes: bytesToken, source } = splitBytesColumn(match[3], match[4] ?? "");

    // ACME truncates long data lines with a literal trailing "..." — strip
    // it before validating; an instruction line (≤3 bytes) never truncates.
    const truncated = bytesToken.endsWith("...");
    const hexToken = truncated ? bytesToken.slice(0, -3) : bytesToken;
    if (!/^([0-9a-fA-F]{2})+$/.test(hexToken)) {
      throw new Error(
        `${fileName} line ${line}: unparseable bytes column '${bytesToken}' in an addressed report line`,
      );
    }
    const mnemonic = mnemonicToken(source);
    if (mnemonic === null) {
      continue; // data directive (!byte/!fill/…), label-only, or continuation
    }
    if (truncated) {
      throw new Error(
        `${fileName} line ${line}: an instruction line's bytes column is truncated ('${bytesToken}')`,
      );
    }

    const bytes = new Uint8Array(hexToken.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexToken.slice(i * 2, i * 2 + 2), 16);
    }

    const encoding = ENCODINGS.get(bytes[0]);
    if (encoding === undefined) {
      throw new Error(
        `${fileName} line ${line}: opcode byte $${bytes[0].toString(16).padStart(2, "0")} is not a documented NMOS 6502 encoding`,
      );
    }
    const [opcode, mode] = encoding;
    if (opcode !== mnemonic) {
      throw new Error(
        `${fileName} line ${line}: emitted opcode byte decodes to ${opcode} but the source says ${mnemonic}`,
      );
    }
    const expectedSize = getTiming(opcode, mode).bytes;
    if (bytes.length !== expectedSize) {
      throw new Error(
        `${fileName} line ${line}: ${opcode} ${mode} emits ${expectedSize} byte(s), the report carries ${bytes.length}`,
      );
    }

    records.push({ line, address, bytes, opcode, mode, operand: decodeOperand(mode, address, bytes) });
  }
  return records;
}

/**
 * The static min–max cycle range of one classified instruction.
 *
 * Branch page-crossing is decided EXACTLY from the resolved target (a taken
 * branch pays +1 only when its target lies in a different page than the byte
 * after the branch); indexed reads keep their +1 as the max, since the index
 * value is runtime state.
 *
 * @param instruction A record from {@link parseReportFile}.
 * @returns The inclusive min–max cycle cost.
 * @example
 * const { min, max } = cycleRange(instruction); // e.g. { min: 4, max: 5 } for LDA abs,X
 */
export function cycleRange(instruction: ReportInstruction): { min: number; max: number } {
  const timing = getTiming(instruction.opcode, instruction.mode);
  if (instruction.mode === "Relative") {
    const fallThrough = (instruction.address + timing.bytes) & 0xffff;
    const crosses =
      instruction.operand !== null &&
      (instruction.operand & 0xff00) !== (fallThrough & 0xff00);
    return {
      min: timing.baseCycles,
      max: timing.baseCycles + timing.branchTakenPenalty + (crosses ? timing.pageCrossPenalty : 0),
    };
  }
  return { min: timing.baseCycles, max: timing.baseCycles + timing.pageCrossPenalty };
}

/**
 * ASM-IL Type Definitions
 *
 * Provides structured representation of 6502 assembly code.
 * Used as intermediate representation between IL code generation
 * and text serialization to ACME assembler.
 *
 * @module asm-il/types
 */

import type { SourceLocation } from '../ast/base.js';

// ============================================================================
// ADDRESSING MODES
// ============================================================================

/**
 * 6502 Addressing Modes
 *
 * All addressing modes supported by the MOS 6502 processor.
 * Each mode affects instruction encoding and cycle counts.
 */
export enum AddressingMode {
  /** No operand: RTS, SEI, CLI, etc. (1 byte) */
  Implied = 'implied',

  /** Accumulator operand: ASL A, ROL A, etc. (1 byte) */
  Accumulator = 'accumulator',

  /** 8-bit constant: LDA #$05 (2 bytes) */
  Immediate = 'immediate',

  /** Zero-page address: LDA $05 (2 bytes, faster) */
  ZeroPage = 'zeroPage',

  /** Zero-page with X offset: LDA $05,X (2 bytes) */
  ZeroPageX = 'zeroPageX',

  /** Zero-page with Y offset: LDX $05,Y (2 bytes) */
  ZeroPageY = 'zeroPageY',

  /** 16-bit address: LDA $1234 (3 bytes) */
  Absolute = 'absolute',

  /** Absolute with X offset: LDA $1234,X (3 bytes) */
  AbsoluteX = 'absoluteX',

  /** Absolute with Y offset: LDA $1234,Y (3 bytes) */
  AbsoluteY = 'absoluteY',

  /** Indexed indirect: LDA ($05,X) (2 bytes) */
  IndirectX = 'indirectX',

  /** Indirect indexed: LDA ($05),Y (2 bytes) */
  IndirectY = 'indirectY',

  /** Relative branch: BEQ label (-128 to +127) (2 bytes) */
  Relative = 'relative',

  /** Indirect jump: JMP ($1234) (3 bytes) */
  Indirect = 'indirect',
}

// ============================================================================
// INSTRUCTION TYPES
// ============================================================================

/**
 * 6502 CPU Instruction Mnemonics
 *
 * All official 6502 opcodes. Illegal/undocumented opcodes
 * are intentionally excluded for portability.
 */
export type Mnemonic =
  // Load/Store
  | 'LDA'
  | 'LDX'
  | 'LDY'
  | 'STA'
  | 'STX'
  | 'STY'
  // Transfer
  | 'TAX'
  | 'TAY'
  | 'TXA'
  | 'TYA'
  | 'TSX'
  | 'TXS'
  // Stack
  | 'PHA'
  | 'PHP'
  | 'PLA'
  | 'PLP'
  // Arithmetic
  | 'ADC'
  | 'SBC'
  | 'INC'
  | 'INX'
  | 'INY'
  | 'DEC'
  | 'DEX'
  | 'DEY'
  // Logical
  | 'AND'
  | 'ORA'
  | 'EOR'
  | 'BIT'
  // Shift/Rotate
  | 'ASL'
  | 'LSR'
  | 'ROL'
  | 'ROR'
  // Compare
  | 'CMP'
  | 'CPX'
  | 'CPY'
  // Branch
  | 'BCC'
  | 'BCS'
  | 'BEQ'
  | 'BMI'
  | 'BNE'
  | 'BPL'
  | 'BVC'
  | 'BVS'
  // Jump/Call
  | 'JMP'
  | 'JSR'
  | 'RTS'
  | 'RTI'
  | 'BRK'
  // Flag
  | 'CLC'
  | 'CLD'
  | 'CLI'
  | 'CLV'
  | 'SEC'
  | 'SED'
  | 'SEI'
  // Other
  | 'NOP';

/**
 * ASM-IL Instruction
 *
 * Represents a single 6502 CPU instruction with all metadata
 * needed for optimization and serialization.
 */
export interface AsmInstruction {
  /** Instruction type discriminator */
  readonly kind: 'instruction';

  /** CPU instruction mnemonic (e.g., 'LDA', 'STA') */
  readonly mnemonic: Mnemonic;

  /** Addressing mode determines operand encoding */
  readonly mode: AddressingMode;

  /**
   * Operand value
   * - number: Direct value or address
   * - string: Label reference
   * - undefined: Implied/Accumulator mode
   */
  readonly operand?: number | string;

  /** Pre-calculated CPU cycle count */
  readonly cycles: number;

  /** Pre-calculated instruction size in bytes */
  readonly bytes: number;

  /** Optional inline comment for debug output */
  readonly comment?: string;

  /** Original source location for debugging */
  readonly sourceLocation?: SourceLocation;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

/**
 * Label type categories
 */
export enum LabelType {
  /** Function entry point: _main, _update */
  Function = 'function',

  /** Global variable: _counter, _score */
  Global = 'global',

  /** Control flow block: .loop, .endif */
  Block = 'block',

  /** Data section: .data_str1 */
  Data = 'data',

  /** Temporary/internal: .L0001 */
  Temp = 'temp',
}

/**
 * ASM-IL Label
 *
 * Represents a named location in the assembly output.
 * Labels can reference code or data.
 */
export interface AsmLabel {
  /** Item type discriminator */
  readonly kind: 'label';

  /** Label name (without colon) */
  readonly name: string;

  /** Label category for formatting */
  readonly type: LabelType;

  /** Whether the label is exported (visible outside module) */
  readonly exported?: boolean;

  /** Resolved address (set by assembler) */
  address?: number;

  /** Optional description comment */
  readonly comment?: string;

  /** Original source location */
  readonly sourceLocation?: SourceLocation;
}

// ============================================================================
// DATA TYPES
// ============================================================================

/**
 * Data directive types
 */
export enum DataType {
  /** Single bytes: !byte $00, $01 */
  Byte = 'byte',

  /** 16-bit words (little-endian): !word $1234 */
  Word = 'word',

  /** Text string: !text "hello" */
  Text = 'text',

  /** Fill memory: !fill 10, $00 */
  Fill = 'fill',
}

/**
 * ASM-IL Data Directive
 *
 * Represents data bytes, words, strings, or fill directives.
 */
export interface AsmData {
  /** Item type discriminator */
  readonly kind: 'data';

  /** Data directive type */
  readonly type: DataType;

  /**
   * Data values
   * - number[]: Byte or word values
   * - string: Text content (for Text type)
   * - { count: number, value: number }: Fill directive
   */
  readonly values: number[] | string | { count: number; value: number };

  /** Optional inline comment */
  readonly comment?: string;

  /** Original source location */
  readonly sourceLocation?: SourceLocation;
}

// ============================================================================
// DIRECTIVE TYPES
// ============================================================================

/**
 * ASM-IL Origin Directive
 *
 * Sets the current assembly address (* = $xxxx).
 */
export interface AsmOrigin {
  /** Item type discriminator */
  readonly kind: 'origin';

  /** Target address */
  readonly address: number;

  /** Optional comment */
  readonly comment?: string;
}

/**
 * ASM-IL Comment
 *
 * Standalone comment line in output.
 */
export interface AsmComment {
  /** Item type discriminator */
  readonly kind: 'comment';

  /** Comment text (without semicolon prefix) */
  readonly text: string;

  /** Comment style */
  readonly style: 'line' | 'section' | 'inline';
}

/**
 * ASM-IL Blank Line
 *
 * Empty line for formatting.
 */
export interface AsmBlankLine {
  /** Item type discriminator */
  readonly kind: 'blank';
}

/**
 * ASM-IL Raw Text
 *
 * Raw assembly text (escape hatch for unsupported features).
 */
export interface AsmRaw {
  /** Item type discriminator */
  readonly kind: 'raw';

  /** Raw text to emit verbatim */
  readonly text: string;
}

// ============================================================================
// UNION TYPES
// ============================================================================

/**
 * Any ASM-IL item that can appear in a module
 */
export type AsmItem =
  | AsmInstruction
  | AsmLabel
  | AsmData
  | AsmOrigin
  | AsmComment
  | AsmBlankLine
  | AsmRaw;

// ============================================================================
// MODULE TYPE
// ============================================================================

/**
 * ASM-IL Module
 *
 * Complete assembly module containing all code and data.
 * This is the top-level structure produced by the builder
 * and consumed by the optimizer and emitter.
 */
export interface AsmModule {
  /** Module name (usually source file name) */
  readonly name: string;

  /** Initial origin address (load address) */
  readonly origin: number;

  /** Target architecture identifier */
  readonly target: string;

  /** Optional output file path */
  readonly outputFile?: string;

  /** All items in order */
  readonly items: AsmItem[];

  /** Label lookup table for fast access */
  readonly labels: Map<string, AsmLabel>;

  /** Module metadata */
  readonly metadata: AsmModuleMetadata;
}

/**
 * Module metadata for debugging and statistics
 */
export interface AsmModuleMetadata {
  /** Generation timestamp */
  readonly generatedAt: string;

  /** Compiler version */
  readonly compilerVersion: string;

  /** Optimization level used */
  readonly optimizationLevel: string;

  /** Total estimated code size (bytes) */
  readonly estimatedCodeSize: number;

  /** Total estimated data size (bytes) */
  readonly estimatedDataSize: number;

  /** Number of functions */
  readonly functionCount: number;

  /** Number of global variables */
  readonly globalCount: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard: Check if item is an instruction
 */
export function isAsmInstruction(item: AsmItem): item is AsmInstruction {
  return item.kind === 'instruction';
}

/**
 * Type guard: Check if item is a label
 */
export function isAsmLabel(item: AsmItem): item is AsmLabel {
  return item.kind === 'label';
}

/**
 * Type guard: Check if item is data
 */
export function isAsmData(item: AsmItem): item is AsmData {
  return item.kind === 'data';
}

/**
 * Type guard: Check if item is an origin directive
 */
export function isAsmOrigin(item: AsmItem): item is AsmOrigin {
  return item.kind === 'origin';
}

/**
 * Type guard: Check if item is a comment
 */
export function isAsmComment(item: AsmItem): item is AsmComment {
  return item.kind === 'comment';
}

/**
 * Type guard: Check if item is a blank line
 */
export function isAsmBlankLine(item: AsmItem): item is AsmBlankLine {
  return item.kind === 'blank';
}

/**
 * Type guard: Check if item is raw text
 */
export function isAsmRaw(item: AsmItem): item is AsmRaw {
  return item.kind === 'raw';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an empty ASM module
 *
 * @param name - Module name (usually source file name)
 * @param origin - Initial origin address (default: $0801 for C64 BASIC)
 * @param target - Target architecture (default: 'c64')
 * @returns New empty AsmModule
 */
export function createAsmModule(
  name: string,
  origin: number = 0x0801,
  target: string = 'c64',
): AsmModule {
  return {
    name,
    origin,
    target,
    items: [],
    labels: new Map(),
    metadata: {
      generatedAt: new Date().toISOString(),
      compilerVersion: '0.1.0',
      optimizationLevel: 'O0',
      estimatedCodeSize: 0,
      estimatedDataSize: 0,
      functionCount: 0,
      globalCount: 0,
    },
  };
}

// ============================================================================
// CYCLE/BYTE TABLES
// ============================================================================

/**
 * Instruction size in bytes by addressing mode
 */
export const INSTRUCTION_BYTES: Record<AddressingMode, number> = {
  [AddressingMode.Implied]: 1,
  [AddressingMode.Accumulator]: 1,
  [AddressingMode.Immediate]: 2,
  [AddressingMode.ZeroPage]: 2,
  [AddressingMode.ZeroPageX]: 2,
  [AddressingMode.ZeroPageY]: 2,
  [AddressingMode.Absolute]: 3,
  [AddressingMode.AbsoluteX]: 3,
  [AddressingMode.AbsoluteY]: 3,
  [AddressingMode.IndirectX]: 2,
  [AddressingMode.IndirectY]: 2,
  [AddressingMode.Relative]: 2,
  [AddressingMode.Indirect]: 3,
};

/**
 * Base cycle count by mnemonic and mode
 *
 * Note: Some modes add +1 for page crossing, +1 for branch taken.
 * These are the base (minimum) cycles.
 */
export const INSTRUCTION_CYCLES: Partial<
  Record<Mnemonic, Partial<Record<AddressingMode, number>>>
> = {
  // Load instructions
  LDA: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  LDX: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageY]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteY]: 4,
  },
  LDY: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
  },
  // Store instructions
  STA: {
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 5,
    [AddressingMode.AbsoluteY]: 5,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 6,
  },
  STX: {
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageY]: 4,
    [AddressingMode.Absolute]: 4,
  },
  STY: {
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
  },
  // Transfer instructions
  TAX: { [AddressingMode.Implied]: 2 },
  TAY: { [AddressingMode.Implied]: 2 },
  TXA: { [AddressingMode.Implied]: 2 },
  TYA: { [AddressingMode.Implied]: 2 },
  TSX: { [AddressingMode.Implied]: 2 },
  TXS: { [AddressingMode.Implied]: 2 },
  // Stack instructions
  PHA: { [AddressingMode.Implied]: 3 },
  PHP: { [AddressingMode.Implied]: 3 },
  PLA: { [AddressingMode.Implied]: 4 },
  PLP: { [AddressingMode.Implied]: 4 },
  // Arithmetic instructions
  ADC: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  SBC: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  INC: {
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  INX: { [AddressingMode.Implied]: 2 },
  INY: { [AddressingMode.Implied]: 2 },
  DEC: {
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  DEX: { [AddressingMode.Implied]: 2 },
  DEY: { [AddressingMode.Implied]: 2 },
  // Logical instructions
  AND: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  ORA: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  EOR: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  BIT: {
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.Absolute]: 4,
  },
  // Shift/Rotate instructions
  ASL: {
    [AddressingMode.Accumulator]: 2,
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  LSR: {
    [AddressingMode.Accumulator]: 2,
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  ROL: {
    [AddressingMode.Accumulator]: 2,
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  ROR: {
    [AddressingMode.Accumulator]: 2,
    [AddressingMode.ZeroPage]: 5,
    [AddressingMode.ZeroPageX]: 6,
    [AddressingMode.Absolute]: 6,
    [AddressingMode.AbsoluteX]: 7,
  },
  // Compare instructions
  CMP: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.ZeroPageX]: 4,
    [AddressingMode.Absolute]: 4,
    [AddressingMode.AbsoluteX]: 4,
    [AddressingMode.AbsoluteY]: 4,
    [AddressingMode.IndirectX]: 6,
    [AddressingMode.IndirectY]: 5,
  },
  CPX: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.Absolute]: 4,
  },
  CPY: {
    [AddressingMode.Immediate]: 2,
    [AddressingMode.ZeroPage]: 3,
    [AddressingMode.Absolute]: 4,
  },
  // Branch instructions (base cycles, +1 if taken, +1 if page crossing)
  BCC: { [AddressingMode.Relative]: 2 },
  BCS: { [AddressingMode.Relative]: 2 },
  BEQ: { [AddressingMode.Relative]: 2 },
  BMI: { [AddressingMode.Relative]: 2 },
  BNE: { [AddressingMode.Relative]: 2 },
  BPL: { [AddressingMode.Relative]: 2 },
  BVC: { [AddressingMode.Relative]: 2 },
  BVS: { [AddressingMode.Relative]: 2 },
  // Jump/Call instructions
  JMP: {
    [AddressingMode.Absolute]: 3,
    [AddressingMode.Indirect]: 5,
  },
  JSR: { [AddressingMode.Absolute]: 6 },
  RTS: { [AddressingMode.Implied]: 6 },
  RTI: { [AddressingMode.Implied]: 6 },
  BRK: { [AddressingMode.Implied]: 7 },
  // Flag instructions
  CLC: { [AddressingMode.Implied]: 2 },
  CLD: { [AddressingMode.Implied]: 2 },
  CLI: { [AddressingMode.Implied]: 2 },
  CLV: { [AddressingMode.Implied]: 2 },
  SEC: { [AddressingMode.Implied]: 2 },
  SED: { [AddressingMode.Implied]: 2 },
  SEI: { [AddressingMode.Implied]: 2 },
  // Other
  NOP: { [AddressingMode.Implied]: 2 },
};

/**
 * Get instruction cycle count
 *
 * @param mnemonic - Instruction mnemonic
 * @param mode - Addressing mode
 * @returns Cycle count, or 0 if unknown
 */
export function getInstructionCycles(
  mnemonic: Mnemonic,
  mode: AddressingMode,
): number {
  return INSTRUCTION_CYCLES[mnemonic]?.[mode] ?? 0;
}

/**
 * Get instruction byte count
 *
 * @param mode - Addressing mode
 * @returns Byte count
 */
export function getInstructionBytes(mode: AddressingMode): number {
  return INSTRUCTION_BYTES[mode];
}
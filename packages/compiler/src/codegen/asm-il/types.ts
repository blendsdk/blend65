/**
 * ASM-IL (Assembly Intermediate Language) Types
 *
 * Defines the output format for the code generator.
 * ASM-IL is a structured representation of 6502 assembly
 * that can be easily emitted to ACME assembler format.
 *
 * @module codegen/asm-il/types
 */

// ============================================================================
// Instruction Types
// ============================================================================

/**
 * 6502 addressing modes.
 *
 * Used to specify how an instruction accesses its operand.
 */
export enum AsmAddressingMode {
  /** No operand (e.g., RTS, NOP) */
  Implied = 'Implied',

  /** Accumulator (e.g., ASL A) */
  Accumulator = 'Accumulator',

  /** Immediate value (e.g., LDA #$FF) */
  Immediate = 'Immediate',

  /** Zero page (e.g., LDA $00) */
  ZeroPage = 'ZeroPage',

  /** Zero page,X (e.g., LDA $00,X) */
  ZeroPageX = 'ZeroPageX',

  /** Zero page,Y (e.g., LDX $00,Y) */
  ZeroPageY = 'ZeroPageY',

  /** Absolute (e.g., LDA $1000) */
  Absolute = 'Absolute',

  /** Absolute,X (e.g., LDA $1000,X) */
  AbsoluteX = 'AbsoluteX',

  /** Absolute,Y (e.g., LDA $1000,Y) */
  AbsoluteY = 'AbsoluteY',

  /** Indirect (e.g., JMP ($1000)) */
  Indirect = 'Indirect',

  /** Indexed indirect (e.g., LDA ($00,X)) */
  IndexedIndirect = 'IndexedIndirect',

  /** Indirect indexed (e.g., LDA ($00),Y) */
  IndirectIndexed = 'IndirectIndexed',

  /** Relative (for branch instructions) */
  Relative = 'Relative',
}

/**
 * A single 6502 assembly instruction.
 *
 * @example
 * ```typescript
 * // LDA #$FF
 * const lda: AsmInstruction = {
 *   mnemonic: 'LDA',
 *   mode: AsmAddressingMode.Immediate,
 *   operand: 0xFF,
 * };
 *
 * // STA $D020
 * const sta: AsmInstruction = {
 *   mnemonic: 'STA',
 *   mode: AsmAddressingMode.Absolute,
 *   operand: 0xD020,
 * };
 * ```
 */
export interface AsmInstruction {
  /** 6502 mnemonic (e.g., LDA, STA, JMP) */
  mnemonic: string;

  /** Addressing mode */
  mode: AsmAddressingMode;

  /** Operand value (address or immediate) */
  operand?: number;

  /** Label operand (for branches/jumps) */
  labelOperand?: string;

  /** Comment for this instruction */
  comment?: string;
}

/**
 * A label definition in the assembly output.
 */
export interface AsmLabel {
  /** Label name */
  name: string;

  /** Whether this is a local label (starts with .) */
  isLocal: boolean;

  /** Comment for this label */
  comment?: string;
}

/**
 * An assembler directive.
 *
 * @example
 * ```typescript
 * // *=$0801
 * const origin: AsmDirective = {
 *   directive: '*=',
 *   value: 0x0801,
 * };
 *
 * // !byte $0C, $08
 * const bytes: AsmDirective = {
 *   directive: '!byte',
 *   values: [0x0C, 0x08],
 * };
 * ```
 */
export interface AsmDirective {
  /** Directive name (e.g., '*=', '!byte', '!word') */
  directive: string;

  /** Single value */
  value?: number | string;

  /** Multiple values (for !byte, !word) */
  values?: number[];

  /** Comment */
  comment?: string;
}

/**
 * A comment line in the assembly output.
 */
export interface AsmComment {
  /** Comment text (without the ; prefix) */
  text: string;
}

/**
 * A blank line in the assembly output.
 */
export interface AsmBlank {
  /** Marker for blank lines */
  blank: true;
}

/**
 * Raw data bytes.
 */
export interface AsmData {
  /** Byte values */
  bytes: number[];

  /** Comment */
  comment?: string;
}

// ============================================================================
// ASM-IL Element Union
// ============================================================================

/**
 * Discriminator for ASM-IL element types.
 */
export type AsmILElementKind =
  | 'instruction'
  | 'label'
  | 'directive'
  | 'comment'
  | 'blank'
  | 'data';

/**
 * An element in the ASM-IL output stream.
 *
 * Uses discriminated union for type-safe handling.
 */
export type AsmILElement =
  | { kind: 'instruction'; instruction: AsmInstruction }
  | { kind: 'label'; label: AsmLabel }
  | { kind: 'directive'; directive: AsmDirective }
  | { kind: 'comment'; comment: AsmComment }
  | { kind: 'blank' }
  | { kind: 'data'; data: AsmData };

// ============================================================================
// Program Structures
// ============================================================================

/**
 * A section of the ASM-IL output.
 *
 * Sections help organize the output into logical parts.
 */
export interface AsmILSection {
  /** Section name (e.g., 'header', 'globals', 'main', 'runtime') */
  name: string;

  /** Elements in this section */
  elements: AsmILElement[];
}

/**
 * Complete ASM-IL program output.
 *
 * Contains all sections ready for emission to ACME format.
 */
export interface AsmILProgram {
  /** Module name */
  moduleName: string;

  /** All sections in order */
  sections: AsmILSection[];

  /** Statistics */
  stats: AsmILStats;
}

/**
 * Statistics about the generated ASM-IL.
 */
export interface AsmILStats {
  /** Total instruction count */
  instructionCount: number;

  /** Total label count */
  labelCount: number;

  /** Estimated byte size */
  estimatedBytes: number;

  /** Estimated cycle count */
  estimatedCycles: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an instruction element.
 */
export function createInstructionElement(
  mnemonic: string,
  mode: AsmAddressingMode,
  operand?: number,
  labelOperand?: string,
  comment?: string
): AsmILElement {
  return {
    kind: 'instruction',
    instruction: { mnemonic, mode, operand, labelOperand, comment },
  };
}

/**
 * Creates a label element.
 */
export function createLabelElement(
  name: string,
  isLocal: boolean = false,
  comment?: string
): AsmILElement {
  return {
    kind: 'label',
    label: { name, isLocal, comment },
  };
}

/**
 * Creates a directive element.
 */
export function createDirectiveElement(
  directive: string,
  value?: number | string,
  values?: number[],
  comment?: string
): AsmILElement {
  return {
    kind: 'directive',
    directive: { directive, value, values, comment },
  };
}

/**
 * Creates a comment element.
 */
export function createCommentElement(text: string): AsmILElement {
  return {
    kind: 'comment',
    comment: { text },
  };
}

/**
 * Creates a blank line element.
 */
export function createBlankElement(): AsmILElement {
  return { kind: 'blank' };
}

/**
 * Creates a data element.
 */
export function createDataElement(bytes: number[], comment?: string): AsmILElement {
  return {
    kind: 'data',
    data: { bytes, comment },
  };
}

/**
 * Creates an empty section.
 */
export function createSection(name: string): AsmILSection {
  return { name, elements: [] };
}

/**
 * Creates an empty ASM-IL program.
 */
export function createAsmILProgram(moduleName: string): AsmILProgram {
  return {
    moduleName,
    sections: [],
    stats: {
      instructionCount: 0,
      labelCount: 0,
      estimatedBytes: 0,
      estimatedCycles: 0,
    },
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if element is an instruction.
 */
export function isInstructionElement(
  element: AsmILElement
): element is { kind: 'instruction'; instruction: AsmInstruction } {
  return element.kind === 'instruction';
}

/**
 * Checks if element is a label.
 */
export function isLabelElement(
  element: AsmILElement
): element is { kind: 'label'; label: AsmLabel } {
  return element.kind === 'label';
}

/**
 * Checks if element is a directive.
 */
export function isDirectiveElement(
  element: AsmILElement
): element is { kind: 'directive'; directive: AsmDirective } {
  return element.kind === 'directive';
}

/**
 * Checks if element is a comment.
 */
export function isCommentElement(
  element: AsmILElement
): element is { kind: 'comment'; comment: AsmComment } {
  return element.kind === 'comment';
}

/**
 * Checks if element is a blank line.
 */
export function isBlankElement(element: AsmILElement): element is { kind: 'blank' } {
  return element.kind === 'blank';
}

/**
 * Checks if element is data.
 */
export function isDataElement(
  element: AsmILElement
): element is { kind: 'data'; data: AsmData } {
  return element.kind === 'data';
}
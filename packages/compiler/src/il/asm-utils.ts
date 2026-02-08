/**
 * ASM Function Name Parser Utilities
 *
 * Parses asm_* function names into 6502 mnemonic and addressing mode pairs.
 * These utilities are used by the IL generator to convert asm_*() calls
 * into ASM_RAW IL instructions.
 *
 * **Naming Convention:**
 * - `asm_<mnemonic>` → implied mode (e.g., `asm_sei` → SEI)
 * - `asm_<mnemonic>_<suffix>` → addressed mode (e.g., `asm_lda_imm` → LDA #imm)
 *
 * @module il/asm-utils
 */

/**
 * Result of parsing an asm_* function name
 */
export interface AsmParseResult {
  /** 6502 mnemonic in uppercase (e.g., 'LDA', 'SEI', 'JMP') */
  mnemonic: string;

  /** Addressing mode string (e.g., 'implied', 'immediate', 'absolute') */
  addressingMode: string;
}

/**
 * Map of addressing mode suffixes to their full names.
 *
 * Used to convert the short suffix in asm_* function names
 * to the full addressing mode string used in IL operands.
 */
const ADDRESSING_MODE_MAP: ReadonlyMap<string, string> = new Map([
  ['imm', 'immediate'],
  ['zp', 'zeroPage'],
  ['zpx', 'zeroPageX'],
  ['zpy', 'zeroPageY'],
  ['abs', 'absolute'],
  ['abx', 'absoluteX'],
  ['aby', 'absoluteY'],
  ['ind', 'indirect'],
  ['inx', 'indirectX'],
  ['iny', 'indirectY'],
  ['rel', 'relative'],
]);

/**
 * Set of valid 6502 mnemonics (all 56 official opcodes).
 * Used to validate parsed results.
 */
const VALID_MNEMONICS: ReadonlySet<string> = new Set([
  // Load/Store
  'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
  // Transfer
  'TAX', 'TAY', 'TXA', 'TYA', 'TSX', 'TXS',
  // Stack
  'PHA', 'PLA', 'PHP', 'PLP',
  // Arithmetic
  'ADC', 'SBC',
  // Increment/Decrement
  'INC', 'INX', 'INY', 'DEC', 'DEX', 'DEY',
  // Logic
  'AND', 'ORA', 'EOR',
  // Shift/Rotate
  'ASL', 'LSR', 'ROL', 'ROR',
  // Compare/Test
  'CMP', 'CPX', 'CPY', 'BIT',
  // Branch
  'BCC', 'BCS', 'BEQ', 'BMI', 'BNE', 'BPL', 'BVC', 'BVS',
  // Jump
  'JMP', 'JSR', 'RTS', 'RTI',
  // Flag
  'CLC', 'CLD', 'CLI', 'CLV', 'SEC', 'SED', 'SEI',
  // System
  'BRK', 'NOP',
]);

/**
 * Check if a function name is an asm_* function.
 *
 * @param name - Function name to check
 * @returns True if the name starts with 'asm_'
 */
export function isAsmFunction(name: string): boolean {
  return name.startsWith('asm_');
}

/**
 * Parse an asm_* function name into mnemonic and addressing mode.
 *
 * Handles two patterns:
 * - `asm_<mnemonic>` → implied mode (e.g., 'asm_sei' → SEI, implied)
 * - `asm_<mnemonic>_<suffix>` → addressed mode (e.g., 'asm_lda_imm' → LDA, immediate)
 *
 * The mnemonic is always returned in uppercase.
 * The addressing mode suffix is mapped to a full addressing mode name.
 *
 * @param name - Function name starting with 'asm_' (e.g., 'asm_lda_imm')
 * @returns Parsed mnemonic and addressing mode, or null if invalid
 *
 * @example
 * ```typescript
 * parseAsmFunctionName('asm_sei');       // { mnemonic: 'SEI', addressingMode: 'implied' }
 * parseAsmFunctionName('asm_lda_imm');   // { mnemonic: 'LDA', addressingMode: 'immediate' }
 * parseAsmFunctionName('asm_sta_abs');   // { mnemonic: 'STA', addressingMode: 'absolute' }
 * parseAsmFunctionName('asm_jmp_ind');   // { mnemonic: 'JMP', addressingMode: 'indirect' }
 * parseAsmFunctionName('not_asm');       // null
 * ```
 */
export function parseAsmFunctionName(name: string): AsmParseResult | null {
  // Must start with 'asm_'
  if (!name.startsWith('asm_')) {
    return null;
  }

  // Remove the 'asm_' prefix
  const rest = name.substring(4);

  if (rest.length === 0) {
    return null;
  }

  // Try to split into mnemonic and addressing mode suffix.
  // The mnemonic is always 3 characters (6502 convention).
  // Pattern: <mnemonic>_<suffix> or just <mnemonic> (implied)
  const mnemonic3 = rest.substring(0, 3).toUpperCase();
  const afterMnemonic = rest.substring(3);

  // Check if the 3-char mnemonic is valid
  if (VALID_MNEMONICS.has(mnemonic3)) {
    if (afterMnemonic === '') {
      // Implied mode: asm_sei, asm_nop, etc.
      return { mnemonic: mnemonic3, addressingMode: 'implied' };
    }

    if (afterMnemonic.startsWith('_')) {
      // Addressed mode: asm_lda_imm, asm_sta_abs, etc.
      const suffix = afterMnemonic.substring(1);
      const addressingMode = ADDRESSING_MODE_MAP.get(suffix);

      if (addressingMode) {
        return { mnemonic: mnemonic3, addressingMode };
      }
    }
  }

  // Invalid asm function name
  return null;
}

/**
 * Check if an addressing mode requires an operand (argument).
 *
 * Implied mode has no operand. All other modes require at least one argument.
 *
 * @param addressingMode - Addressing mode string
 * @returns True if the mode requires an operand
 */
export function addressingModeRequiresOperand(addressingMode: string): boolean {
  return addressingMode !== 'implied';
}

/**
 * Get the number of arguments expected for an addressing mode.
 *
 * @param addressingMode - Addressing mode string
 * @returns Number of arguments expected (0 for implied, 1 for everything else)
 */
export function getExpectedArgCount(addressingMode: string): number {
  return addressingMode === 'implied' ? 0 : 1;
}

/**
 * Get all valid addressing mode suffixes.
 *
 * @returns Array of valid suffix strings (e.g., ['imm', 'zp', 'abs', ...])
 */
export function getValidAddressingModeSuffixes(): string[] {
  return Array.from(ADDRESSING_MODE_MAP.keys());
}

/**
 * Get all valid 6502 mnemonics.
 *
 * @returns Array of valid mnemonic strings in uppercase
 */
export function getValidMnemonics(): string[] {
  return Array.from(VALID_MNEMONICS);
}

/**
 * Address Analyzer
 *
 * Analyzes memory address aliasing for safe store-load optimization on the
 * 6502. Used by optimization passes to determine whether two memory
 * references could point to the same location, which is critical for
 * correctness when eliminating redundant loads or reordering stores.
 *
 * **Why aliasing matters:**
 * If `STA $1000` is followed by `LDA $1000`, the LDA is redundant because
 * A still holds the value. But if there's an intervening `STA $1000,X`
 * where X is unknown, we can't prove the addresses differ — they might
 * alias — so the LDA must be preserved.
 *
 * The analyzer uses conservative analysis: when in doubt, it assumes
 * addresses COULD alias (returns `true`), preventing incorrect optimizations.
 *
 * @module codegen/asm-il/optimizer/analysis/address-analyzer
 */

import { AsmAddressingMode } from '../../types.js';
import type { AsmInstruction } from '../../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A memory address reference: either a concrete numeric address or
 * a symbolic label name.
 *
 * - `number` → concrete address (e.g., 0xD020 for VIC border color)
 * - `string` → symbolic label (e.g., "counter" or "player_x")
 */
export type AddressRef = number | string;

// ============================================================================
// Constants — Store/Modify mnemonics
// ============================================================================

/**
 * Instructions that write to a memory address.
 * Used to detect potential address modifications.
 */
const MEMORY_WRITE_MNEMONICS = new Set([
  'STA', 'STX', 'STY',
  'INC', 'DEC',
  'ASL', 'LSR', 'ROL', 'ROR',
]);

/**
 * Addressing modes that use an index register (X or Y) to compute
 * the effective address. These modes make aliasing analysis harder
 * because the effective address depends on the runtime index value.
 */
const INDEXED_MODES = new Set<AsmAddressingMode>([
  AsmAddressingMode.ZeroPageX,
  AsmAddressingMode.ZeroPageY,
  AsmAddressingMode.AbsoluteX,
  AsmAddressingMode.AbsoluteY,
  AsmAddressingMode.IndexedIndirect,
  AsmAddressingMode.IndirectIndexed,
]);

// ============================================================================
// AddressAnalyzer
// ============================================================================

/**
 * Analyzes memory address aliasing for the 6502.
 *
 * This analyzer determines whether two memory references could refer
 * to the same location. It uses conservative analysis: unknown or
 * symbolic addresses are assumed to potentially alias unless we can
 * prove otherwise.
 *
 * **Key principles:**
 * 1. Same concrete address → definite alias
 * 2. Different concrete addresses → no alias
 * 3. Same symbolic label → definite alias
 * 4. Different symbolic labels → might alias (conservative)
 * 5. Symbolic vs concrete → might alias (conservative)
 *
 * **Usage by optimization passes:**
 * - **StoreLoadPass**: Uses `couldAlias()` to determine if a store-load
 *   pair can be eliminated (only if no intervening aliasing store).
 * - **StoreLoadPass**: Uses `couldModify()` to check if an instruction
 *   between a store and load might write to the same address.
 *
 * @example
 * ```typescript
 * const analyzer = new AddressAnalyzer();
 *
 * // Same concrete address → definite alias
 * analyzer.couldAlias(0xD020, 0xD020); // true
 *
 * // Different concrete addresses → no alias
 * analyzer.couldAlias(0xD020, 0xD021); // false
 *
 * // Symbolic addresses → conservative (might alias)
 * analyzer.couldAlias('counter', 'player_x'); // true (conservative)
 * ```
 */
export class AddressAnalyzer {
  /**
   * Determine if two addresses could refer to the same memory location.
   *
   * Uses conservative analysis: returns `true` when aliasing cannot
   * be ruled out, ensuring optimization correctness.
   *
   * **Alias rules:**
   * - Two equal concrete numbers → true (same address)
   * - Two different concrete numbers → false (provably different)
   * - Two equal strings → true (same label)
   * - Two different strings → true (conservative: labels might resolve to same address)
   * - Mixed number/string → true (conservative: label might resolve to the number)
   *
   * @param addr1 - First address reference
   * @param addr2 - Second address reference
   * @returns true if the addresses could potentially alias
   */
  couldAlias(addr1: AddressRef, addr2: AddressRef): boolean {
    // Both concrete numbers — only alias if equal
    if (typeof addr1 === 'number' && typeof addr2 === 'number') {
      return addr1 === addr2;
    }

    // Both strings — same label is definite alias, different labels are
    // conservatively assumed to potentially alias because we don't know
    // what addresses the linker will assign
    if (typeof addr1 === 'string' && typeof addr2 === 'string') {
      // Always true: same label is alias, different labels might alias
      return true;
    }

    // Mixed types (number + string) — conservative: the label could
    // resolve to any address, including the numeric one
    return true;
  }

  /**
   * Check if an instruction could modify a given memory address.
   *
   * An instruction modifies memory if:
   * 1. It is a memory-writing instruction (STA, STX, STY, INC, DEC, shifts)
   * 2. Its target operand could alias with the given address
   *
   * @param instruction - The instruction to check
   * @param addr - The memory address to check for modification
   * @returns true if the instruction could write to the given address
   */
  couldModify(instruction: AsmInstruction, addr: AddressRef): boolean {
    // Only memory-writing instructions can modify addresses
    if (!MEMORY_WRITE_MNEMONICS.has(instruction.mnemonic)) {
      return false;
    }

    // Get the instruction's target address
    const instrAddr = this.getInstructionAddress(instruction);

    // If we can't determine the instruction's target, be conservative
    if (instrAddr === undefined) {
      return true;
    }

    // Check if the instruction's target could alias with our address
    return this.couldAlias(instrAddr, addr);
  }

  /**
   * Check if an instruction reads from a given memory address.
   *
   * An instruction reads from memory if:
   * 1. It is a memory-reading instruction (LDA, LDX, LDY, CMP, etc.)
   * 2. Its source operand could alias with the given address
   *
   * Note: Immediate mode instructions don't read from memory addresses.
   *
   * @param instruction - The instruction to check
   * @param addr - The memory address to check for reads
   * @returns true if the instruction could read from the given address
   */
  couldRead(instruction: AsmInstruction, addr: AddressRef): boolean {
    // Only memory-reading instructions can read addresses
    const memReadMnemonics = new Set([
      'LDA', 'LDX', 'LDY',
      'CMP', 'CPX', 'CPY',
      'ADC', 'SBC',
      'AND', 'ORA', 'EOR',
      'BIT',
    ]);

    if (!memReadMnemonics.has(instruction.mnemonic)) {
      return false;
    }

    // Immediate mode doesn't read from memory — the operand IS the value
    if (instruction.mode === AsmAddressingMode.Immediate) {
      return false;
    }

    // Get the instruction's source address
    const instrAddr = this.getInstructionAddress(instruction);

    // No address means no memory read
    if (instrAddr === undefined) {
      return false;
    }

    return this.couldAlias(instrAddr, addr);
  }

  /**
   * Extract the memory address referenced by an instruction.
   *
   * Returns undefined for implied, accumulator, and immediate modes
   * since they don't reference a memory address.
   *
   * For indexed modes (ZeroPageX, AbsoluteY, etc.), returns the base
   * address — aliasing for indexed modes is inherently uncertain because
   * the index register's value is often unknown.
   *
   * @param instruction - The instruction to extract the address from
   * @returns The address reference, or undefined if no memory address
   */
  getInstructionAddress(instruction: AsmInstruction): AddressRef | undefined {
    // Label operand takes priority (symbolic reference)
    if (instruction.labelOperand !== undefined) {
      return instruction.labelOperand;
    }

    // Numeric operand (for non-immediate, non-implied modes)
    if (instruction.operand !== undefined) {
      return instruction.operand;
    }

    return undefined;
  }

  /**
   * Check if an instruction accesses memory through an index register.
   *
   * Indexed addressing makes aliasing analysis harder because the
   * effective address depends on the runtime value of X or Y.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction uses indexed addressing
   */
  isIndexedAccess(instruction: AsmInstruction): boolean {
    return INDEXED_MODES.has(instruction.mode);
  }
}

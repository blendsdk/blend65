/**
 * Transfer/Stack Instruction Builder
 *
 * Extends LoadStoreBuilder with transfer and stack CPU instructions.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/transfer-stack-builder
 */

import { LoadStoreBuilder } from './load-store-builder.js';
import { AddressingMode } from '../types.js';

/**
 * Transfer/Stack Instruction Builder
 *
 * Adds transfer and stack CPU instruction methods:
 * - TAX, TAY, TXA, TYA, TSX, TXS (register transfers)
 * - PHA, PHP, PLA, PLP (stack operations)
 */
export abstract class TransferStackBuilder extends LoadStoreBuilder {
  // ========================================
  // TRANSFER INSTRUCTIONS (Implied mode)
  // ========================================

  /**
   * TAX: Transfer Accumulator to X
   *
   * Copies the value from the accumulator to the X register.
   * Affects N and Z flags.
   */
  tax(comment?: string): this {
    return this.emitInstruction('TAX', AddressingMode.Implied, undefined, comment);
  }

  /**
   * TAY: Transfer Accumulator to Y
   *
   * Copies the value from the accumulator to the Y register.
   * Affects N and Z flags.
   */
  tay(comment?: string): this {
    return this.emitInstruction('TAY', AddressingMode.Implied, undefined, comment);
  }

  /**
   * TXA: Transfer X to Accumulator
   *
   * Copies the value from the X register to the accumulator.
   * Affects N and Z flags.
   */
  txa(comment?: string): this {
    return this.emitInstruction('TXA', AddressingMode.Implied, undefined, comment);
  }

  /**
   * TYA: Transfer Y to Accumulator
   *
   * Copies the value from the Y register to the accumulator.
   * Affects N and Z flags.
   */
  tya(comment?: string): this {
    return this.emitInstruction('TYA', AddressingMode.Implied, undefined, comment);
  }

  /**
   * TSX: Transfer Stack Pointer to X
   *
   * Copies the value from the stack pointer to the X register.
   * Affects N and Z flags.
   */
  tsx(comment?: string): this {
    return this.emitInstruction('TSX', AddressingMode.Implied, undefined, comment);
  }

  /**
   * TXS: Transfer X to Stack Pointer
   *
   * Copies the value from the X register to the stack pointer.
   * Does not affect any flags.
   */
  txs(comment?: string): this {
    return this.emitInstruction('TXS', AddressingMode.Implied, undefined, comment);
  }

  // ========================================
  // STACK INSTRUCTIONS (Implied mode)
  // ========================================

  /**
   * PHA: Push Accumulator to Stack
   *
   * Pushes the accumulator value onto the stack.
   * Stack pointer is decremented after the push.
   */
  pha(comment?: string): this {
    return this.emitInstruction('PHA', AddressingMode.Implied, undefined, comment);
  }

  /**
   * PHP: Push Processor Status to Stack
   *
   * Pushes the processor status register onto the stack.
   * Includes the B (break) flag set.
   */
  php(comment?: string): this {
    return this.emitInstruction('PHP', AddressingMode.Implied, undefined, comment);
  }

  /**
   * PLA: Pull Accumulator from Stack
   *
   * Pulls the top value from the stack into the accumulator.
   * Stack pointer is incremented before the pull.
   * Affects N and Z flags.
   */
  pla(comment?: string): this {
    return this.emitInstruction('PLA', AddressingMode.Implied, undefined, comment);
  }

  /**
   * PLP: Pull Processor Status from Stack
   *
   * Pulls the top value from the stack into the processor status register.
   * All flags are affected (except B which is ignored).
   */
  plp(comment?: string): this {
    return this.emitInstruction('PLP', AddressingMode.Implied, undefined, comment);
  }
}
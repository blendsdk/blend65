/**
 * Arithmetic Instruction Builder
 *
 * Extends TransferStackBuilder with arithmetic CPU instructions.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/arithmetic-builder
 */

import { TransferStackBuilder } from './transfer-stack-builder.js';
import { AddressingMode } from '../types.js';

/**
 * Arithmetic Instruction Builder
 *
 * Adds arithmetic CPU instruction methods:
 * - ADC (add with carry)
 * - SBC (subtract with borrow)
 * - INC, DEC (memory increment/decrement)
 * - INX, INY, DEX, DEY (register increment/decrement)
 */
export abstract class ArithmeticBuilder extends TransferStackBuilder {
  // ========================================
  // ADC - ADD WITH CARRY
  // ========================================

  /** ADC immediate: ADC #$xx */
  adcImm(value: number, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.Immediate, value, comment);
  }

  /** ADC zero page: ADC $xx */
  adcZp(address: number, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.ZeroPage, address, comment);
  }

  /** ADC zero page,X: ADC $xx,X */
  adcZpX(address: number, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.ZeroPageX, address, comment);
  }

  /** ADC absolute: ADC $xxxx or ADC label */
  adcAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.Absolute, address, comment);
  }

  /** ADC absolute,X: ADC $xxxx,X */
  adcAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.AbsoluteX, address, comment);
  }

  /** ADC absolute,Y: ADC $xxxx,Y */
  adcAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.AbsoluteY, address, comment);
  }

  /** ADC indirect,X: ADC ($xx,X) */
  adcIndX(address: number, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.IndirectX, address, comment);
  }

  /** ADC indirect,Y: ADC ($xx),Y */
  adcIndY(address: number, comment?: string): this {
    return this.emitInstruction('ADC', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // SBC - SUBTRACT WITH BORROW
  // ========================================

  /** SBC immediate: SBC #$xx */
  sbcImm(value: number, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.Immediate, value, comment);
  }

  /** SBC zero page: SBC $xx */
  sbcZp(address: number, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.ZeroPage, address, comment);
  }

  /** SBC zero page,X: SBC $xx,X */
  sbcZpX(address: number, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.ZeroPageX, address, comment);
  }

  /** SBC absolute: SBC $xxxx or SBC label */
  sbcAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.Absolute, address, comment);
  }

  /** SBC absolute,X: SBC $xxxx,X */
  sbcAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.AbsoluteX, address, comment);
  }

  /** SBC absolute,Y: SBC $xxxx,Y */
  sbcAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.AbsoluteY, address, comment);
  }

  /** SBC indirect,X: SBC ($xx,X) */
  sbcIndX(address: number, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.IndirectX, address, comment);
  }

  /** SBC indirect,Y: SBC ($xx),Y */
  sbcIndY(address: number, comment?: string): this {
    return this.emitInstruction('SBC', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // INC - INCREMENT MEMORY
  // ========================================

  /** INC zero page: INC $xx */
  incZp(address: number, comment?: string): this {
    return this.emitInstruction('INC', AddressingMode.ZeroPage, address, comment);
  }

  /** INC zero page,X: INC $xx,X */
  incZpX(address: number, comment?: string): this {
    return this.emitInstruction('INC', AddressingMode.ZeroPageX, address, comment);
  }

  /** INC absolute: INC $xxxx or INC label */
  incAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('INC', AddressingMode.Absolute, address, comment);
  }

  /** INC absolute,X: INC $xxxx,X */
  incAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('INC', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // DEC - DECREMENT MEMORY
  // ========================================

  /** DEC zero page: DEC $xx */
  decZp(address: number, comment?: string): this {
    return this.emitInstruction('DEC', AddressingMode.ZeroPage, address, comment);
  }

  /** DEC zero page,X: DEC $xx,X */
  decZpX(address: number, comment?: string): this {
    return this.emitInstruction('DEC', AddressingMode.ZeroPageX, address, comment);
  }

  /** DEC absolute: DEC $xxxx or DEC label */
  decAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('DEC', AddressingMode.Absolute, address, comment);
  }

  /** DEC absolute,X: DEC $xxxx,X */
  decAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('DEC', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // REGISTER INCREMENT/DECREMENT (Implied mode)
  // ========================================

  /**
   * INX: Increment X Register
   *
   * Adds 1 to the X register.
   * Affects N and Z flags.
   */
  inx(comment?: string): this {
    return this.emitInstruction('INX', AddressingMode.Implied, undefined, comment);
  }

  /**
   * INY: Increment Y Register
   *
   * Adds 1 to the Y register.
   * Affects N and Z flags.
   */
  iny(comment?: string): this {
    return this.emitInstruction('INY', AddressingMode.Implied, undefined, comment);
  }

  /**
   * DEX: Decrement X Register
   *
   * Subtracts 1 from the X register.
   * Affects N and Z flags.
   */
  dex(comment?: string): this {
    return this.emitInstruction('DEX', AddressingMode.Implied, undefined, comment);
  }

  /**
   * DEY: Decrement Y Register
   *
   * Subtracts 1 from the Y register.
   * Affects N and Z flags.
   */
  dey(comment?: string): this {
    return this.emitInstruction('DEY', AddressingMode.Implied, undefined, comment);
  }
}
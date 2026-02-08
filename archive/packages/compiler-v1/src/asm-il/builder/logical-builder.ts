/**
 * Logical Instruction Builder
 *
 * Extends ArithmeticBuilder with logical and shift CPU instructions.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/logical-builder
 */

import { ArithmeticBuilder } from './arithmetic-builder.js';
import { AddressingMode } from '../types.js';

/**
 * Logical Instruction Builder
 *
 * Adds logical and shift/rotate CPU instruction methods:
 * - AND, ORA, EOR (bitwise operations)
 * - BIT (bit test)
 * - ASL, LSR (shift operations)
 * - ROL, ROR (rotate operations)
 */
export abstract class LogicalBuilder extends ArithmeticBuilder {
  // ========================================
  // AND - BITWISE AND
  // ========================================

  /** AND immediate: AND #$xx */
  andImm(value: number, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.Immediate, value, comment);
  }

  /** AND zero page: AND $xx */
  andZp(address: number, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.ZeroPage, address, comment);
  }

  /** AND zero page,X: AND $xx,X */
  andZpX(address: number, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.ZeroPageX, address, comment);
  }

  /** AND absolute: AND $xxxx or AND label */
  andAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.Absolute, address, comment);
  }

  /** AND absolute,X: AND $xxxx,X */
  andAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.AbsoluteX, address, comment);
  }

  /** AND absolute,Y: AND $xxxx,Y */
  andAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.AbsoluteY, address, comment);
  }

  /** AND indirect,X: AND ($xx,X) */
  andIndX(address: number, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.IndirectX, address, comment);
  }

  /** AND indirect,Y: AND ($xx),Y */
  andIndY(address: number, comment?: string): this {
    return this.emitInstruction('AND', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // ORA - BITWISE OR
  // ========================================

  /** ORA immediate: ORA #$xx */
  oraImm(value: number, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.Immediate, value, comment);
  }

  /** ORA zero page: ORA $xx */
  oraZp(address: number, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.ZeroPage, address, comment);
  }

  /** ORA zero page,X: ORA $xx,X */
  oraZpX(address: number, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.ZeroPageX, address, comment);
  }

  /** ORA absolute: ORA $xxxx or ORA label */
  oraAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.Absolute, address, comment);
  }

  /** ORA absolute,X: ORA $xxxx,X */
  oraAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.AbsoluteX, address, comment);
  }

  /** ORA absolute,Y: ORA $xxxx,Y */
  oraAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.AbsoluteY, address, comment);
  }

  /** ORA indirect,X: ORA ($xx,X) */
  oraIndX(address: number, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.IndirectX, address, comment);
  }

  /** ORA indirect,Y: ORA ($xx),Y */
  oraIndY(address: number, comment?: string): this {
    return this.emitInstruction('ORA', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // EOR - BITWISE EXCLUSIVE OR
  // ========================================

  /** EOR immediate: EOR #$xx */
  eorImm(value: number, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.Immediate, value, comment);
  }

  /** EOR zero page: EOR $xx */
  eorZp(address: number, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.ZeroPage, address, comment);
  }

  /** EOR zero page,X: EOR $xx,X */
  eorZpX(address: number, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.ZeroPageX, address, comment);
  }

  /** EOR absolute: EOR $xxxx or EOR label */
  eorAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.Absolute, address, comment);
  }

  /** EOR absolute,X: EOR $xxxx,X */
  eorAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.AbsoluteX, address, comment);
  }

  /** EOR absolute,Y: EOR $xxxx,Y */
  eorAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.AbsoluteY, address, comment);
  }

  /** EOR indirect,X: EOR ($xx,X) */
  eorIndX(address: number, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.IndirectX, address, comment);
  }

  /** EOR indirect,Y: EOR ($xx),Y */
  eorIndY(address: number, comment?: string): this {
    return this.emitInstruction('EOR', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // BIT - BIT TEST
  // ========================================

  /** BIT zero page: BIT $xx */
  bitZp(address: number, comment?: string): this {
    return this.emitInstruction('BIT', AddressingMode.ZeroPage, address, comment);
  }

  /** BIT absolute: BIT $xxxx or BIT label */
  bitAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('BIT', AddressingMode.Absolute, address, comment);
  }

  // ========================================
  // ASL - ARITHMETIC SHIFT LEFT
  // ========================================

  /** ASL accumulator: ASL A */
  aslAcc(comment?: string): this {
    return this.emitInstruction('ASL', AddressingMode.Accumulator, undefined, comment);
  }

  /** ASL zero page: ASL $xx */
  aslZp(address: number, comment?: string): this {
    return this.emitInstruction('ASL', AddressingMode.ZeroPage, address, comment);
  }

  /** ASL zero page,X: ASL $xx,X */
  aslZpX(address: number, comment?: string): this {
    return this.emitInstruction('ASL', AddressingMode.ZeroPageX, address, comment);
  }

  /** ASL absolute: ASL $xxxx or ASL label */
  aslAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('ASL', AddressingMode.Absolute, address, comment);
  }

  /** ASL absolute,X: ASL $xxxx,X */
  aslAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('ASL', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // LSR - LOGICAL SHIFT RIGHT
  // ========================================

  /** LSR accumulator: LSR A */
  lsrAcc(comment?: string): this {
    return this.emitInstruction('LSR', AddressingMode.Accumulator, undefined, comment);
  }

  /** LSR zero page: LSR $xx */
  lsrZp(address: number, comment?: string): this {
    return this.emitInstruction('LSR', AddressingMode.ZeroPage, address, comment);
  }

  /** LSR zero page,X: LSR $xx,X */
  lsrZpX(address: number, comment?: string): this {
    return this.emitInstruction('LSR', AddressingMode.ZeroPageX, address, comment);
  }

  /** LSR absolute: LSR $xxxx or LSR label */
  lsrAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('LSR', AddressingMode.Absolute, address, comment);
  }

  /** LSR absolute,X: LSR $xxxx,X */
  lsrAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('LSR', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // ROL - ROTATE LEFT
  // ========================================

  /** ROL accumulator: ROL A */
  rolAcc(comment?: string): this {
    return this.emitInstruction('ROL', AddressingMode.Accumulator, undefined, comment);
  }

  /** ROL zero page: ROL $xx */
  rolZp(address: number, comment?: string): this {
    return this.emitInstruction('ROL', AddressingMode.ZeroPage, address, comment);
  }

  /** ROL zero page,X: ROL $xx,X */
  rolZpX(address: number, comment?: string): this {
    return this.emitInstruction('ROL', AddressingMode.ZeroPageX, address, comment);
  }

  /** ROL absolute: ROL $xxxx or ROL label */
  rolAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('ROL', AddressingMode.Absolute, address, comment);
  }

  /** ROL absolute,X: ROL $xxxx,X */
  rolAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('ROL', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // ROR - ROTATE RIGHT
  // ========================================

  /** ROR accumulator: ROR A */
  rorAcc(comment?: string): this {
    return this.emitInstruction('ROR', AddressingMode.Accumulator, undefined, comment);
  }

  /** ROR zero page: ROR $xx */
  rorZp(address: number, comment?: string): this {
    return this.emitInstruction('ROR', AddressingMode.ZeroPage, address, comment);
  }

  /** ROR zero page,X: ROR $xx,X */
  rorZpX(address: number, comment?: string): this {
    return this.emitInstruction('ROR', AddressingMode.ZeroPageX, address, comment);
  }

  /** ROR absolute: ROR $xxxx or ROR label */
  rorAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('ROR', AddressingMode.Absolute, address, comment);
  }

  /** ROR absolute,X: ROR $xxxx,X */
  rorAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('ROR', AddressingMode.AbsoluteX, address, comment);
  }
}
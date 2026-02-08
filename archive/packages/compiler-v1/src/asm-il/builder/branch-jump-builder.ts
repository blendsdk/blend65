/**
 * Branch/Jump Instruction Builder
 *
 * Extends LogicalBuilder with compare, branch, jump, and flag CPU instructions.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/branch-jump-builder
 */

import { LogicalBuilder } from './logical-builder.js';
import { AddressingMode } from '../types.js';

/**
 * Branch/Jump Instruction Builder
 *
 * Adds compare, branch, jump, and flag CPU instruction methods:
 * - CMP, CPX, CPY (compare operations)
 * - BCC, BCS, BEQ, BMI, BNE, BPL, BVC, BVS (conditional branches)
 * - JMP, JSR, RTS, RTI, BRK (jump/return operations)
 * - CLC, CLD, CLI, CLV, SEC, SED, SEI (flag operations)
 * - NOP (no operation)
 */
export abstract class BranchJumpBuilder extends LogicalBuilder {
  // ========================================
  // CMP - COMPARE ACCUMULATOR
  // ========================================

  /** CMP immediate: CMP #$xx */
  cmpImm(value: number, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.Immediate, value, comment);
  }

  /** CMP zero page: CMP $xx */
  cmpZp(address: number, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.ZeroPage, address, comment);
  }

  /** CMP zero page,X: CMP $xx,X */
  cmpZpX(address: number, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.ZeroPageX, address, comment);
  }

  /** CMP absolute: CMP $xxxx or CMP label */
  cmpAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.Absolute, address, comment);
  }

  /** CMP absolute,X: CMP $xxxx,X */
  cmpAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.AbsoluteX, address, comment);
  }

  /** CMP absolute,Y: CMP $xxxx,Y */
  cmpAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.AbsoluteY, address, comment);
  }

  /** CMP indirect,X: CMP ($xx,X) */
  cmpIndX(address: number, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.IndirectX, address, comment);
  }

  /** CMP indirect,Y: CMP ($xx),Y */
  cmpIndY(address: number, comment?: string): this {
    return this.emitInstruction('CMP', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // CPX - COMPARE X REGISTER
  // ========================================

  /** CPX immediate: CPX #$xx */
  cpxImm(value: number, comment?: string): this {
    return this.emitInstruction('CPX', AddressingMode.Immediate, value, comment);
  }

  /** CPX zero page: CPX $xx */
  cpxZp(address: number, comment?: string): this {
    return this.emitInstruction('CPX', AddressingMode.ZeroPage, address, comment);
  }

  /** CPX absolute: CPX $xxxx or CPX label */
  cpxAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('CPX', AddressingMode.Absolute, address, comment);
  }

  // ========================================
  // CPY - COMPARE Y REGISTER
  // ========================================

  /** CPY immediate: CPY #$xx */
  cpyImm(value: number, comment?: string): this {
    return this.emitInstruction('CPY', AddressingMode.Immediate, value, comment);
  }

  /** CPY zero page: CPY $xx */
  cpyZp(address: number, comment?: string): this {
    return this.emitInstruction('CPY', AddressingMode.ZeroPage, address, comment);
  }

  /** CPY absolute: CPY $xxxx or CPY label */
  cpyAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('CPY', AddressingMode.Absolute, address, comment);
  }

  // ========================================
  // BRANCH INSTRUCTIONS (Relative mode)
  // ========================================

  /**
   * BCC: Branch if Carry Clear (C=0)
   *
   * Branches if the carry flag is clear.
   * Used after CMP for "less than" comparison.
   */
  bcc(label: string, comment?: string): this {
    return this.emitInstruction('BCC', AddressingMode.Relative, label, comment);
  }

  /**
   * BCS: Branch if Carry Set (C=1)
   *
   * Branches if the carry flag is set.
   * Used after CMP for "greater than or equal" comparison.
   */
  bcs(label: string, comment?: string): this {
    return this.emitInstruction('BCS', AddressingMode.Relative, label, comment);
  }

  /**
   * BEQ: Branch if Equal (Z=1)
   *
   * Branches if the zero flag is set.
   * Used after CMP for "equal" comparison.
   */
  beq(label: string, comment?: string): this {
    return this.emitInstruction('BEQ', AddressingMode.Relative, label, comment);
  }

  /**
   * BMI: Branch if Minus (N=1)
   *
   * Branches if the negative flag is set.
   * Used to test if result is negative.
   */
  bmi(label: string, comment?: string): this {
    return this.emitInstruction('BMI', AddressingMode.Relative, label, comment);
  }

  /**
   * BNE: Branch if Not Equal (Z=0)
   *
   * Branches if the zero flag is clear.
   * Used after CMP for "not equal" comparison.
   */
  bne(label: string, comment?: string): this {
    return this.emitInstruction('BNE', AddressingMode.Relative, label, comment);
  }

  /**
   * BPL: Branch if Plus (N=0)
   *
   * Branches if the negative flag is clear.
   * Used to test if result is positive.
   */
  bpl(label: string, comment?: string): this {
    return this.emitInstruction('BPL', AddressingMode.Relative, label, comment);
  }

  /**
   * BVC: Branch if Overflow Clear (V=0)
   *
   * Branches if the overflow flag is clear.
   */
  bvc(label: string, comment?: string): this {
    return this.emitInstruction('BVC', AddressingMode.Relative, label, comment);
  }

  /**
   * BVS: Branch if Overflow Set (V=1)
   *
   * Branches if the overflow flag is set.
   */
  bvs(label: string, comment?: string): this {
    return this.emitInstruction('BVS', AddressingMode.Relative, label, comment);
  }

  // ========================================
  // JUMP INSTRUCTIONS
  // ========================================

  /**
   * JMP absolute: JMP $xxxx or JMP label
   *
   * Unconditional jump to specified address.
   */
  jmp(target: number | string, comment?: string): this {
    return this.emitInstruction('JMP', AddressingMode.Absolute, target, comment);
  }

  /**
   * JMP indirect: JMP ($xxxx)
   *
   * Unconditional jump to address stored at specified location.
   * Note: 6502 has a bug where JMP ($xxFF) reads the wrong address.
   */
  jmpInd(address: number | string, comment?: string): this {
    return this.emitInstruction('JMP', AddressingMode.Indirect, address, comment);
  }

  /**
   * JSR: Jump to Subroutine
   *
   * Pushes return address onto stack and jumps to subroutine.
   */
  jsr(target: number | string, comment?: string): this {
    return this.emitInstruction('JSR', AddressingMode.Absolute, target, comment);
  }

  /**
   * RTS: Return from Subroutine
   *
   * Pulls return address from stack and returns to caller.
   */
  rts(comment?: string): this {
    return this.emitInstruction('RTS', AddressingMode.Implied, undefined, comment);
  }

  /**
   * RTI: Return from Interrupt
   *
   * Pulls processor status and return address from stack.
   */
  rti(comment?: string): this {
    return this.emitInstruction('RTI', AddressingMode.Implied, undefined, comment);
  }

  /**
   * BRK: Break (Software Interrupt)
   *
   * Forces an interrupt. Used for debugging or system calls.
   */
  brk(comment?: string): this {
    return this.emitInstruction('BRK', AddressingMode.Implied, undefined, comment);
  }

  // ========================================
  // FLAG INSTRUCTIONS (Implied mode)
  // ========================================

  /**
   * CLC: Clear Carry Flag
   *
   * Sets the carry flag to 0.
   * Must be called before ADC for addition.
   */
  clc(comment?: string): this {
    return this.emitInstruction('CLC', AddressingMode.Implied, undefined, comment);
  }

  /**
   * CLD: Clear Decimal Mode
   *
   * Clears the decimal flag. Binary mode is enabled.
   * Always call at program start for safety.
   */
  cld(comment?: string): this {
    return this.emitInstruction('CLD', AddressingMode.Implied, undefined, comment);
  }

  /**
   * CLI: Clear Interrupt Disable
   *
   * Clears the interrupt disable flag.
   * Enables IRQ interrupts.
   */
  cli(comment?: string): this {
    return this.emitInstruction('CLI', AddressingMode.Implied, undefined, comment);
  }

  /**
   * CLV: Clear Overflow Flag
   *
   * Clears the overflow flag.
   */
  clv(comment?: string): this {
    return this.emitInstruction('CLV', AddressingMode.Implied, undefined, comment);
  }

  /**
   * SEC: Set Carry Flag
   *
   * Sets the carry flag to 1.
   * Must be called before SBC for subtraction.
   */
  sec(comment?: string): this {
    return this.emitInstruction('SEC', AddressingMode.Implied, undefined, comment);
  }

  /**
   * SED: Set Decimal Mode
   *
   * Sets the decimal flag. BCD mode is enabled.
   * Use with caution on C64 (interrupts expect binary mode).
   */
  sed(comment?: string): this {
    return this.emitInstruction('SED', AddressingMode.Implied, undefined, comment);
  }

  /**
   * SEI: Set Interrupt Disable
   *
   * Sets the interrupt disable flag.
   * Disables IRQ interrupts.
   */
  sei(comment?: string): this {
    return this.emitInstruction('SEI', AddressingMode.Implied, undefined, comment);
  }

  // ========================================
  // OTHER INSTRUCTIONS
  // ========================================

  /**
   * NOP: No Operation
   *
   * Does nothing. Uses 2 cycles.
   * Useful for timing or placeholder code.
   */
  nop(comment?: string): this {
    return this.emitInstruction('NOP', AddressingMode.Implied, undefined, comment);
  }
}
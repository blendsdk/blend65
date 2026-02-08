/**
 * Load/Store Instruction Builder
 *
 * Extends BaseAsmBuilder with load and store CPU instructions.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/load-store-builder
 */

import { BaseAsmBuilder } from './base-builder.js';
import type { AsmInstruction, Mnemonic } from '../types.js';
import { AddressingMode, getInstructionBytes, getInstructionCycles } from '../types.js';

/**
 * Load/Store Instruction Builder
 *
 * Adds load/store CPU instruction methods:
 * - LDA, LDX, LDY (load accumulator, X, Y)
 * - STA, STX, STY (store accumulator, X, Y)
 *
 * Each instruction has methods for different addressing modes.
 */
export abstract class LoadStoreBuilder extends BaseAsmBuilder {
  // ========================================
  // CORE INSTRUCTION EMITTER
  // ========================================

  /**
   * Emit a CPU instruction
   *
   * Core method used by all instruction methods. Creates an AsmInstruction
   * with pre-calculated byte and cycle counts.
   *
   * @param mnemonic - CPU instruction mnemonic
   * @param mode - Addressing mode
   * @param operand - Optional operand (number or label)
   * @param comment - Optional inline comment
   * @returns this for chaining
   */
  protected emitInstruction(
    mnemonic: Mnemonic,
    mode: AddressingMode,
    operand?: number | string,
    comment?: string,
  ): this {
    const bytes = getInstructionBytes(mode);
    const cycles = getInstructionCycles(mnemonic, mode);

    const instruction: AsmInstruction = {
      kind: 'instruction',
      mnemonic,
      mode,
      operand,
      cycles,
      bytes,
      comment,
      sourceLocation: this.currentLocation,
    };

    this.addItem(instruction);
    this.addCodeBytes(bytes);

    return this;
  }

  // ========================================
  // LDA - LOAD ACCUMULATOR
  // ========================================

  /** LDA immediate: LDA #$xx */
  ldaImm(value: number, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.Immediate, value, comment);
  }

  /** LDA zero page: LDA $xx */
  ldaZp(address: number, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.ZeroPage, address, comment);
  }

  /** LDA zero page,X: LDA $xx,X */
  ldaZpX(address: number, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.ZeroPageX, address, comment);
  }

  /** LDA absolute: LDA $xxxx or LDA label */
  ldaAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.Absolute, address, comment);
  }

  /** LDA absolute,X: LDA $xxxx,X */
  ldaAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.AbsoluteX, address, comment);
  }

  /** LDA absolute,Y: LDA $xxxx,Y */
  ldaAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.AbsoluteY, address, comment);
  }

  /** LDA indirect,X: LDA ($xx,X) */
  ldaIndX(address: number, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.IndirectX, address, comment);
  }

  /** LDA indirect,Y: LDA ($xx),Y */
  ldaIndY(address: number, comment?: string): this {
    return this.emitInstruction('LDA', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // LDX - LOAD X REGISTER
  // ========================================

  /** LDX immediate: LDX #$xx */
  ldxImm(value: number, comment?: string): this {
    return this.emitInstruction('LDX', AddressingMode.Immediate, value, comment);
  }

  /** LDX zero page: LDX $xx */
  ldxZp(address: number, comment?: string): this {
    return this.emitInstruction('LDX', AddressingMode.ZeroPage, address, comment);
  }

  /** LDX zero page,Y: LDX $xx,Y */
  ldxZpY(address: number, comment?: string): this {
    return this.emitInstruction('LDX', AddressingMode.ZeroPageY, address, comment);
  }

  /** LDX absolute: LDX $xxxx or LDX label */
  ldxAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('LDX', AddressingMode.Absolute, address, comment);
  }

  /** LDX absolute,Y: LDX $xxxx,Y */
  ldxAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('LDX', AddressingMode.AbsoluteY, address, comment);
  }

  // ========================================
  // LDY - LOAD Y REGISTER
  // ========================================

  /** LDY immediate: LDY #$xx */
  ldyImm(value: number, comment?: string): this {
    return this.emitInstruction('LDY', AddressingMode.Immediate, value, comment);
  }

  /** LDY zero page: LDY $xx */
  ldyZp(address: number, comment?: string): this {
    return this.emitInstruction('LDY', AddressingMode.ZeroPage, address, comment);
  }

  /** LDY zero page,X: LDY $xx,X */
  ldyZpX(address: number, comment?: string): this {
    return this.emitInstruction('LDY', AddressingMode.ZeroPageX, address, comment);
  }

  /** LDY absolute: LDY $xxxx or LDY label */
  ldyAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('LDY', AddressingMode.Absolute, address, comment);
  }

  /** LDY absolute,X: LDY $xxxx,X */
  ldyAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('LDY', AddressingMode.AbsoluteX, address, comment);
  }

  // ========================================
  // STA - STORE ACCUMULATOR
  // ========================================

  /** STA zero page: STA $xx */
  staZp(address: number, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.ZeroPage, address, comment);
  }

  /** STA zero page,X: STA $xx,X */
  staZpX(address: number, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.ZeroPageX, address, comment);
  }

  /** STA absolute: STA $xxxx or STA label */
  staAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.Absolute, address, comment);
  }

  /** STA absolute,X: STA $xxxx,X */
  staAbsX(address: number | string, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.AbsoluteX, address, comment);
  }

  /** STA absolute,Y: STA $xxxx,Y */
  staAbsY(address: number | string, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.AbsoluteY, address, comment);
  }

  /** STA indirect,X: STA ($xx,X) */
  staIndX(address: number, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.IndirectX, address, comment);
  }

  /** STA indirect,Y: STA ($xx),Y */
  staIndY(address: number, comment?: string): this {
    return this.emitInstruction('STA', AddressingMode.IndirectY, address, comment);
  }

  // ========================================
  // STX - STORE X REGISTER
  // ========================================

  /** STX zero page: STX $xx */
  stxZp(address: number, comment?: string): this {
    return this.emitInstruction('STX', AddressingMode.ZeroPage, address, comment);
  }

  /** STX zero page,Y: STX $xx,Y */
  stxZpY(address: number, comment?: string): this {
    return this.emitInstruction('STX', AddressingMode.ZeroPageY, address, comment);
  }

  /** STX absolute: STX $xxxx or STX label */
  stxAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('STX', AddressingMode.Absolute, address, comment);
  }

  // ========================================
  // STY - STORE Y REGISTER
  // ========================================

  /** STY zero page: STY $xx */
  styZp(address: number, comment?: string): this {
    return this.emitInstruction('STY', AddressingMode.ZeroPage, address, comment);
  }

  /** STY zero page,X: STY $xx,X */
  styZpX(address: number, comment?: string): this {
    return this.emitInstruction('STY', AddressingMode.ZeroPageX, address, comment);
  }

  /** STY absolute: STY $xxxx or STY label */
  styAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('STY', AddressingMode.Absolute, address, comment);
  }
}
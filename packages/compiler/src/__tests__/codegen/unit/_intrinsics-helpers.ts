/**
 * Shared Test Helpers for Intrinsics Operations Tests
 *
 * Common utilities used across all intrinsic operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_intrinsics-helpers
 */

import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { ILOperand, AddressOperand } from '../../../il/operands.js';
import { IntrinsicsOpsGenerator } from '../../../codegen/generator/intrinsics.js';
import { AsmILElement, AsmILProgram } from '../../../codegen/asm-il/types.js';
import { ILProgram } from '../../../il/index.js';

// Re-export common helpers
export {
  createZpSlot,
  createAbsSlot,
  createSlotOp,
  createImmediateOp,
  getInstructions,
  getComments,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
  assertInstruction,
} from './_test-helpers.js';

// Re-export label helpers
export { findLabel, countLabels } from './_control-flow-helpers.js';

// ============================================================================
// Testable Class for Intrinsics Operations
// ============================================================================

/**
 * Test subclass to expose protected intrinsic operation methods.
 *
 * Extends IntrinsicsOpsGenerator to allow testing of:
 * - Individual intrinsic operation handlers
 * - Generated ASM-IL output
 */
export class TestableIntrinsicsOpsGenerator extends IntrinsicsOpsGenerator {
  /**
   * Exposes genPeek for direct testing.
   */
  public testGenPeek(instr: ILInstruction): void {
    this.genPeek(instr);
  }

  /**
   * Exposes genPoke for direct testing.
   */
  public testGenPoke(instr: ILInstruction): void {
    this.genPoke(instr);
  }

  /**
   * Exposes genPeekw for direct testing.
   */
  public testGenPeekw(instr: ILInstruction): void {
    this.genPeekw(instr);
  }

  /**
   * Exposes genPokew for direct testing.
   */
  public testGenPokew(instr: ILInstruction): void {
    this.genPokew(instr);
  }

  /**
   * Exposes genHi for direct testing.
   */
  public testGenHi(instr: ILInstruction): void {
    this.genHi(instr);
  }

  /**
   * Exposes genLo for direct testing.
   */
  public testGenLo(instr: ILInstruction): void {
    this.genLo(instr);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /**
   * Manually sets the accumulator state from slot for testing.
   */
  public testSetAFromSlot(address: number): void {
    this.setAFromSlot(address);
  }

  /**
   * Manually sets the accumulator state from immediate for testing.
   */
  public testSetAFromImmediate(value: number): void {
    this.setAFromImmediate(value);
  }

  /**
   * Manually invalidates accumulator state for testing.
   */
  public testInvalidateA(): void {
    this.invalidateA();
  }

  /**
   * Checks if A has the specified slot address.
   */
  public testAHasSlot(address: number): boolean {
    return this.aHasSlot(address);
  }

  /**
   * Checks if A has the specified immediate value.
   */
  public testAHasImmediate(value: number): boolean {
    return this.aHasImmediate(value);
  }

  /**
   * Override to not throw on unhandled opcodes during testing.
   */
  public generate(_program: ILProgram): AsmILProgram {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Address Operand Factory
// ============================================================================

/**
 * Creates an address operand for testing.
 *
 * @param address - Memory address
 * @param isZeroPage - Whether address is in zero page (auto-detected if not provided)
 * @returns AddressOperand
 */
export function createAddressOp(
  address: number,
  isZeroPage?: boolean
): AddressOperand {
  return {
    kind: 'address',
    address,
    isZeroPage: isZeroPage ?? address <= 0xff,
  };
}

/**
 * Creates a zero page address operand for testing.
 *
 * @param address - Zero page address (0x00-0xFF)
 * @returns AddressOperand
 */
export function createZpAddressOp(address: number): AddressOperand {
  return createAddressOp(address, true);
}

/**
 * Creates an absolute address operand for testing.
 *
 * @param address - Absolute address (typically > 0xFF)
 * @returns AddressOperand
 */
export function createAbsAddressOp(address: number): AddressOperand {
  return createAddressOp(address, false);
}

// ============================================================================
// Intrinsics IL Instruction Factories
// ============================================================================

/**
 * Creates a PEEK instruction.
 *
 * @param address - Memory address to read from
 * @param isZeroPage - Whether address is in zero page
 * @returns IL instruction
 */
export function createPeekInstr(
  address: number,
  isZeroPage?: boolean
): ILInstruction {
  return {
    opcode: ILOpcode.PEEK,
    operands: [createAddressOp(address, isZeroPage)] as ILOperand[],
    comment: `peek($${address.toString(16).toUpperCase()})`,
  };
}

/**
 * Creates a POKE instruction.
 *
 * @param address - Memory address to write to
 * @param isZeroPage - Whether address is in zero page
 * @returns IL instruction
 */
export function createPokeInstr(
  address: number,
  isZeroPage?: boolean
): ILInstruction {
  return {
    opcode: ILOpcode.POKE,
    operands: [createAddressOp(address, isZeroPage)] as ILOperand[],
    comment: `poke($${address.toString(16).toUpperCase()})`,
  };
}

/**
 * Creates a PEEKW instruction (read word).
 *
 * @param address - Memory address to read word from
 * @param isZeroPage - Whether address is in zero page
 * @returns IL instruction
 */
export function createPeekwInstr(
  address: number,
  isZeroPage?: boolean
): ILInstruction {
  return {
    opcode: ILOpcode.PEEKW,
    operands: [createAddressOp(address, isZeroPage)] as ILOperand[],
    comment: `peekw($${address.toString(16).toUpperCase()})`,
  };
}

/**
 * Creates a POKEW instruction (write word).
 *
 * @param address - Memory address to write word to
 * @param isZeroPage - Whether address is in zero page
 * @returns IL instruction
 */
export function createPokewInstr(
  address: number,
  isZeroPage?: boolean
): ILInstruction {
  return {
    opcode: ILOpcode.POKEW,
    operands: [createAddressOp(address, isZeroPage)] as ILOperand[],
    comment: `pokew($${address.toString(16).toUpperCase()})`,
  };
}

/**
 * Creates a HI instruction (get high byte of word).
 *
 * @returns IL instruction
 */
export function createHiInstr(): ILInstruction {
  return {
    opcode: ILOpcode.HI,
    operands: [] as ILOperand[],
    comment: 'hi(word) - get high byte',
  };
}

/**
 * Creates a LO instruction (get low byte of word).
 *
 * @returns IL instruction
 */
export function createLoInstr(): ILInstruction {
  return {
    opcode: ILOpcode.LO,
    operands: [] as ILOperand[],
    comment: 'lo(word) - get low byte',
  };
}

// ============================================================================
// Common C64 Hardware Addresses
// ============================================================================

/**
 * Common C64 hardware register addresses for testing.
 */
export const C64_HARDWARE = {
  /** Border color register */
  BORDER: 0xd020,
  /** Background color register */
  BACKGROUND: 0xd021,
  /** Screen memory start */
  SCREEN: 0x0400,
  /** Color memory start */
  COLOR: 0xd800,
  /** Sprite 0 X position */
  SPRITE0_X: 0xd000,
  /** Sprite 0 Y position */
  SPRITE0_Y: 0xd001,
  /** Sprite X MSB register */
  SPRITE_MSB: 0xd010,
  /** Sprite enable register */
  SPRITE_ENABLE: 0xd015,
  /** VIC control register 1 */
  VIC_CTRL1: 0xd011,
  /** VIC control register 2 */
  VIC_CTRL2: 0xd016,
  /** Raster line register */
  RASTER: 0xd012,
  /** SID voice 1 frequency low */
  SID_VOICE1_FREQ_LO: 0xd400,
  /** SID voice 1 frequency high */
  SID_VOICE1_FREQ_HI: 0xd401,
  /** SID volume */
  SID_VOLUME: 0xd418,
  /** CIA1 data port A */
  CIA1_PORTA: 0xdc00,
  /** CIA1 data port B */
  CIA1_PORTB: 0xdc01,
  /** Zero page temp storage */
  ZP_TEMP: 0x02,
  /** Zero page pointer low */
  ZP_PTR_LO: 0xfb,
  /** Zero page pointer high */
  ZP_PTR_HI: 0xfc,
} as const;
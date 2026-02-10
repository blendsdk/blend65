/**
 * Register Tracker
 *
 * Tracks the known contents of 6502 registers (A, X, Y) through
 * instruction sequences. Used by optimization passes to detect when
 * register values are already known, enabling:
 * - Redundant load elimination (LDA when A already has the value)
 * - Transfer optimization (TAX when X already equals A)
 * - Store-load forwarding (STA $xx / LDA $xx → value already in A)
 *
 * Register values use three-valued tracking:
 * - `number`    → register holds a known immediate value (0–255)
 * - `string`    → register holds value loaded from a label/address (symbolic)
 * - `undefined` → register contents are unknown
 *
 * @module codegen/asm-il/optimizer/analysis/register-tracker
 */

import { AsmAddressingMode } from '../../types.js';
import type { AsmInstruction } from '../../types.js';

// ============================================================================
// Register State Types
// ============================================================================

/**
 * Known value in a register: either a concrete immediate (0–255),
 * a symbolic reference (label string), or unknown (undefined).
 */
export type RegisterValue = number | string | undefined;

/**
 * Describes how a specific register (X or Y) is used within a code range.
 *
 * Used by the register promotion pass to determine whether a register
 * is "free" for promotion — meaning it is neither read nor written
 * anywhere in the range. If both `isRead` and `isWritten` are false,
 * the register is available for use as a loop counter or index variable.
 */
export interface RegisterUsageInfo {
  /** Whether the register is read (used as a source operand) */
  isRead: boolean;

  /** Whether the register is written (used as a destination) */
  isWritten: boolean;

  /** Instruction indices where the register is read */
  readIndices: number[];

  /** Instruction indices where the register is written */
  writeIndices: number[];
}

/**
 * Represents the known state of the three 6502 general-purpose registers.
 *
 * Each register can hold:
 * - A concrete value (number) when loaded with an immediate
 * - A symbolic reference (string) representing a memory address
 * - undefined when the register's contents cannot be determined
 */
export interface RegisterState {
  /** Accumulator register value */
  a: RegisterValue;

  /** X index register value */
  x: RegisterValue;

  /** Y index register value */
  y: RegisterValue;
}

// ============================================================================
// RegisterTracker
// ============================================================================

/**
 * Tracks the known contents of 6502 A, X, Y registers through
 * instruction sequences.
 *
 * The tracker uses conservative analysis: if there's any uncertainty
 * about a register's value, it's marked as `undefined`. This ensures
 * optimization passes only rely on provably correct register information.
 *
 * **Usage by optimization passes:**
 * - **StoreLoadPass**: Detects STA $addr / LDA $addr where A still holds
 *   the stored value, making the LDA redundant.
 * - **TransferOptPass**: Detects TAX / TXA where X already equals A.
 * - **FlagPatternsPass**: Detects CMP #0 when Z/N flags are already set.
 *
 * @example
 * ```typescript
 * const tracker = new RegisterTracker();
 * let state = tracker.createInitialState();
 *
 * // LDA #$42 → A = 0x42
 * state = tracker.update(
 *   { mnemonic: 'LDA', mode: AsmAddressingMode.Immediate, operand: 0x42 },
 *   state
 * );
 * // state.a === 0x42
 *
 * // TAX → X = A = 0x42
 * state = tracker.update(
 *   { mnemonic: 'TAX', mode: AsmAddressingMode.Implied },
 *   state
 * );
 * // state.x === 0x42
 * ```
 */
export class RegisterTracker {
  /**
   * Update register state after executing an instruction.
   *
   * Takes the current register state and an instruction, returns the
   * new state. The input state is not mutated.
   *
   * @param instruction - The 6502 instruction to analyze
   * @param state - Register state before the instruction
   * @returns Register state after the instruction
   */
  update(instruction: AsmInstruction, state: RegisterState): RegisterState {
    const newState: RegisterState = { ...state };
    const { mnemonic, mode, operand } = instruction;

    switch (mnemonic) {
      // ── Load instructions ──────────────────────────────────────────
      // Immediate loads → known concrete value
      // Non-immediate loads → unknown (value comes from memory)
      case 'LDA':
        newState.a = mode === AsmAddressingMode.Immediate ? operand : undefined;
        break;
      case 'LDX':
        newState.x = mode === AsmAddressingMode.Immediate ? operand : undefined;
        break;
      case 'LDY':
        newState.y = mode === AsmAddressingMode.Immediate ? operand : undefined;
        break;

      // ── Transfer instructions ──────────────────────────────────────
      // Copy value from one register to another
      case 'TAX':
        newState.x = state.a;
        break;
      case 'TAY':
        newState.y = state.a;
        break;
      case 'TXA':
        newState.a = state.x;
        break;
      case 'TYA':
        newState.a = state.y;
        break;

      // ── Stack operations ───────────────────────────────────────────
      // PLA pulls unknown value from stack into A
      case 'PLA':
        newState.a = undefined;
        break;
      // TSX copies stack pointer to X — value unknown
      case 'TSX':
        newState.x = undefined;
        break;
      // TXS copies X to stack pointer — doesn't change registers
      // PHA/PHP push but don't change registers
      case 'TXS':
      case 'PHA':
      case 'PHP':
        break;

      // ── Arithmetic (always targets A) ──────────────────────────────
      // These produce a result dependent on runtime state, so A becomes unknown
      case 'ADC':
      case 'SBC':
      case 'AND':
      case 'ORA':
      case 'EOR':
        newState.a = undefined;
        break;

      // ── Shift/Rotate ───────────────────────────────────────────────
      // In accumulator mode, destroys A's known value
      // In memory mode, doesn't change any register
      case 'ASL':
      case 'LSR':
      case 'ROL':
      case 'ROR':
        if (mode === AsmAddressingMode.Accumulator) {
          newState.a = undefined;
        }
        break;

      // ── Increment/Decrement (register) ─────────────────────────────
      // These modify the register in a way that depends on its current value
      case 'INX':
      case 'DEX':
        newState.x = undefined;
        break;
      case 'INY':
      case 'DEY':
        newState.y = undefined;
        break;

      // ── JSR/RTS/JMP ────────────────────────────────────────────────
      // JSR may clobber registers (callee convention) — conservatively unknown
      case 'JSR':
        newState.a = undefined;
        newState.x = undefined;
        newState.y = undefined;
        break;

      // All other instructions (STA, STX, STY, CMP, CPX, CPY, branches,
      // NOP, CLC, SEC, etc.) don't modify register values
      default:
        break;
    }

    return newState;
  }

  /**
   * Check if two register values are equal.
   *
   * Handles the three cases:
   * - Both undefined → false (cannot prove equality)
   * - Both same concrete number → true
   * - Both same string → true
   * - Otherwise → false
   *
   * @param a - First register value
   * @param b - Second register value
   * @returns true only if both values are known and equal
   */
  areEqual(a: RegisterValue, b: RegisterValue): boolean {
    // If either is unknown, we cannot prove equality
    if (a === undefined || b === undefined) {
      return false;
    }
    return a === b;
  }

  /**
   * Create an initial register state with all registers unknown.
   *
   * This is the correct starting state at the entry of any code block
   * because we cannot assume anything about register contents on entry.
   *
   * @returns RegisterState with all registers set to undefined
   */
  createInitialState(): RegisterState {
    return {
      a: undefined,
      x: undefined,
      y: undefined,
    };
  }

  /**
   * Scan a range of instructions and determine how a specific register
   * (X or Y) is used.
   *
   * This is used by the register promotion pass to check whether X or Y
   * is "free" in a loop body. A register is free for promotion when it
   * is neither read nor written anywhere in the instruction range.
   *
   * **What counts as "reading" X:**
   * - TXA, TXS (X is the source register)
   * - STX (stores X to memory)
   * - CPX (compares X with a value)
   * - Any instruction using AbsoluteX, ZeroPageX, IndexedIndirect mode
   *
   * **What counts as "writing" X:**
   * - LDX (loads a new value into X)
   * - TAX, TSX (transfers into X)
   * - INX, DEX (modifies X)
   *
   * The same logic applies to Y with the corresponding mnemonics and modes.
   *
   * @param instructions - Array of instructions to scan
   * @param register - Which register to check ('x' or 'y')
   * @returns Usage information describing reads and writes
   */
  scanRegisterUsage(
    instructions: AsmInstruction[],
    register: 'x' | 'y'
  ): RegisterUsageInfo {
    const info: RegisterUsageInfo = {
      isRead: false,
      isWritten: false,
      readIndices: [],
      writeIndices: [],
    };

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      const reads = register === 'x'
        ? this.readsX(instr)
        : this.readsY(instr);
      const writes = register === 'x'
        ? this.writesX(instr)
        : this.writesY(instr);

      if (reads) {
        info.isRead = true;
        info.readIndices.push(i);
      }
      if (writes) {
        info.isWritten = true;
        info.writeIndices.push(i);
      }
    }

    return info;
  }

  /**
   * Check whether an instruction reads the X register.
   *
   * An instruction "reads" X when X's current value affects the
   * instruction's behavior — either as a direct source (TXA, STX, CPX)
   * or as an index modifier (AbsoluteX, ZeroPageX, IndexedIndirect).
   *
   * @param instr - The instruction to check
   * @returns true if the instruction reads X
   */
  protected readsX(instr: AsmInstruction): boolean {
    // Direct reads from X register
    const xReadMnemonics = ['TXA', 'TXS', 'STX', 'CPX'];
    if (xReadMnemonics.includes(instr.mnemonic)) return true;

    // Indexed addressing modes that use X as index
    const xIndexedModes = [
      AsmAddressingMode.ZeroPageX,
      AsmAddressingMode.AbsoluteX,
      AsmAddressingMode.IndexedIndirect, // (addr,X)
    ];
    if (xIndexedModes.includes(instr.mode)) return true;

    return false;
  }

  /**
   * Check whether an instruction writes to the X register.
   *
   * An instruction "writes" X when it modifies X's value — either
   * by loading a new value (LDX), transferring from another register
   * (TAX, TSX), or incrementing/decrementing (INX, DEX).
   *
   * @param instr - The instruction to check
   * @returns true if the instruction writes X
   */
  protected writesX(instr: AsmInstruction): boolean {
    const xWriteMnemonics = ['LDX', 'TAX', 'TSX', 'INX', 'DEX'];
    return xWriteMnemonics.includes(instr.mnemonic);
  }

  /**
   * Check whether an instruction reads the Y register.
   *
   * An instruction "reads" Y when Y's current value affects the
   * instruction's behavior — either as a direct source (TYA, STY, CPY)
   * or as an index modifier (AbsoluteY, ZeroPageY, IndirectIndexed).
   *
   * @param instr - The instruction to check
   * @returns true if the instruction reads Y
   */
  protected readsY(instr: AsmInstruction): boolean {
    // Direct reads from Y register
    const yReadMnemonics = ['TYA', 'STY', 'CPY'];
    if (yReadMnemonics.includes(instr.mnemonic)) return true;

    // Indexed addressing modes that use Y as index
    const yIndexedModes = [
      AsmAddressingMode.ZeroPageY,
      AsmAddressingMode.AbsoluteY,
      AsmAddressingMode.IndirectIndexed, // (addr),Y
    ];
    if (yIndexedModes.includes(instr.mode)) return true;

    return false;
  }

  /**
   * Check whether an instruction writes to the Y register.
   *
   * An instruction "writes" Y when it modifies Y's value — either
   * by loading a new value (LDY), transferring from another register
   * (TAY), or incrementing/decrementing (INY, DEY).
   *
   * @param instr - The instruction to check
   * @returns true if the instruction writes Y
   */
  protected writesY(instr: AsmInstruction): boolean {
    const yWriteMnemonics = ['LDY', 'TAY', 'INY', 'DEY'];
    return yWriteMnemonics.includes(instr.mnemonic);
  }

  /**
   * Check if a register is completely free (not used at all) in a
   * range of instructions.
   *
   * Convenience method that calls `scanRegisterUsage` and returns
   * true only if the register is neither read nor written.
   *
   * @param instructions - Array of instructions to check
   * @param register - Which register to check ('x' or 'y')
   * @returns true if the register is not used at all
   */
  isRegisterFree(
    instructions: AsmInstruction[],
    register: 'x' | 'y'
  ): boolean {
    const usage = this.scanRegisterUsage(instructions, register);
    return !usage.isRead && !usage.isWritten;
  }
}

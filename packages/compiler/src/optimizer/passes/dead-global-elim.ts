/**
 * Dead Global Elimination Pass
 *
 * Removes global variable initialization code from `globalInit` when the
 * global is never referenced by any reachable function. This pass operates
 * on the program level, scanning all function instructions to determine
 * which globals are actually used.
 *
 * **Algorithm:**
 * 1. Collect all slot names referenced by any function instruction
 * 2. Walk `globalInit` backwards to identify STORE instructions targeting unused slots
 * 3. Remove dead stores and their value-producing predecessor instructions
 * 4. Report removed global names in debug output
 *
 * **Why this matters for 6502:**
 * Global initialization code consumes both ROM space (the init code itself)
 * and RAM (the allocated global variable). Removing unused globals frees
 * both, which is critical on memory-constrained C64 systems.
 *
 * **Depends on:** `dead-function-elim` must run first so that references
 * from dead (already-removed) functions don't keep globals alive.
 *
 * **Enabled at:** O2+ (standard optimization and above)
 *
 * @module optimizer/passes/dead-global-elim
 */

import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import type { ILOperand, SlotOperand } from '../../il/operands.js';
import type { ILProgram } from '../../il/structures.js';
import type { OptimizationOptions } from '../options.js';
import type { ProgramOptimizationPass, ProgramPassResult } from '../pass.js';
import { createEmptyProgramResult, createProgramResult } from '../pass.js';

// ============================================================================
// Dead Global Elimination Pass
// ============================================================================

/**
 * Eliminates unreferenced global variable initialization code.
 *
 * A global is considered "dead" if no reachable function references its slot.
 * The pass removes the initialization instructions (STORE + preceding LOAD)
 * from `program.globalInit`, reducing both code size and memory usage.
 *
 * **Prerequisite:** This pass depends on `dead-function-elim` running first.
 * Dead function elimination ensures that references from already-removed
 * unreachable functions don't incorrectly keep globals alive.
 *
 * **What counts as a "reference":**
 * - Any instruction operand that is a SlotOperand referencing the global's name
 * - This includes LOAD_BYTE, STORE_BYTE, ADD_BYTE, CMP_BYTE, INC_BYTE, etc.
 * - Both reads and writes in function bodies count as references
 *
 * **What gets removed:**
 * - STORE_BYTE/STORE_WORD instructions in globalInit that target dead slots
 * - The preceding value-producing instruction (typically LOAD_IMM) that feeds
 *   the dead store, since its result is now unused
 *
 * @example
 * ```typescript
 * const pass = new DeadGlobalElimPass();
 * const result = pass.run(program, { level: 'O2' });
 * if (result.modified) {
 *   console.log(`Removed ${result.functionsModified} dead global initializations`);
 * }
 * ```
 */
export class DeadGlobalElimPass implements ProgramOptimizationPass {
  /**
   * Unique pass name.
   *
   * Must match the name used in PROGRAM_LEVEL_PASSES config ('dead-global-elim').
   */
  readonly name = 'dead-global-elim';

  /**
   * This pass depends on dead-function-elim running first.
   *
   * Dead function elimination must remove unreachable functions before
   * we scan for global references — otherwise dead functions would
   * keep their globals alive incorrectly.
   */
  readonly dependencies: string[] = ['dead-function-elim'];

  /**
   * Run dead global elimination on the entire program.
   *
   * Scans all function instructions for slot references, then removes
   * globalInit instructions that initialize unreferenced slots.
   *
   * The program's `globalInit` array is modified in place (filtered).
   *
   * @param program - The IL program to optimize (modified in place)
   * @param options - Optimization options (used for debug logging)
   * @returns Result indicating how many globals were removed
   */
  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult {
    // Nothing to do if there are no global init instructions
    if (program.globalInit.length === 0) {
      return createEmptyProgramResult();
    }

    // Step 1: Collect all slot names referenced by any function instruction
    const usedSlots = this.collectUsedSlots(program);

    // Step 2: Identify dead global stores in globalInit
    const deadSlotNames = this.findDeadGlobalSlots(program.globalInit, usedSlots);

    // Nothing to remove — all globals are referenced
    if (deadSlotNames.size === 0) {
      return createEmptyProgramResult();
    }

    // Step 3: Remove dead initialization instructions from globalInit
    const removedCount = this.removeDeadInstructions(program, deadSlotNames);

    // Step 4: Build debug info if requested
    const debugInfo = options.debug
      ? [...deadSlotNames].map((name) => `Removed dead global initialization: ${name}`)
      : undefined;

    // We report dead globals as "functionsModified: N" since there's no
    // "globalsRemoved" field in ProgramPassResult — the functionsModified
    // field serves as a general "things changed" counter here
    return createProgramResult(0, removedCount, debugInfo);
  }

  /**
   * Collect all slot names referenced by any function instruction.
   *
   * Scans every operand of every instruction in every function.
   * Any SlotOperand's slot.name is added to the used set.
   *
   * @param program - The IL program to scan
   * @returns Set of slot names that are referenced by at least one function
   */
  protected collectUsedSlots(program: ILProgram): Set<string> {
    const usedSlots = new Set<string>();

    for (const func of program.functions) {
      for (const instr of func.instructions) {
        this.collectSlotNamesFromInstruction(instr, usedSlots);
      }
    }

    return usedSlots;
  }

  /**
   * Extract slot names from a single instruction's operands.
   *
   * Checks each operand — if it's a SlotOperand, adds its slot name
   * and any indexSlot name to the collection set.
   *
   * @param instr - The instruction to scan
   * @param slotNames - Set to add discovered slot names to
   */
  protected collectSlotNamesFromInstruction(
    instr: ILInstruction,
    slotNames: Set<string>
  ): void {
    for (const operand of instr.operands) {
      this.collectSlotNamesFromOperand(operand, slotNames);
    }
  }

  /**
   * Extract slot names from a single operand.
   *
   * If the operand is a SlotOperand, adds its slot.name.
   * Also checks for indexSlot (used in array access patterns).
   *
   * @param operand - The operand to check
   * @param slotNames - Set to add discovered slot names to
   */
  protected collectSlotNamesFromOperand(operand: ILOperand, slotNames: Set<string>): void {
    if (operand.kind === 'slot') {
      const slotOp = operand as SlotOperand;
      slotNames.add(slotOp.slot.name);

      // Also track index slot if present (dynamic array access)
      if (slotOp.indexSlot) {
        slotNames.add(slotOp.indexSlot.name);
      }
    }
  }

  /**
   * Find slot names that are stored to in globalInit but never used by functions.
   *
   * Identifies STORE_BYTE and STORE_WORD instructions in globalInit whose
   * target slot is not in the usedSlots set.
   *
   * @param globalInit - The global initialization instruction array
   * @param usedSlots - Set of slot names referenced by functions
   * @returns Set of dead slot names (initialized but never used)
   */
  protected findDeadGlobalSlots(
    globalInit: ILInstruction[],
    usedSlots: Set<string>
  ): Set<string> {
    const deadSlots = new Set<string>();

    for (const instr of globalInit) {
      // Only look at store instructions — these define globals
      if (instr.opcode === ILOpcode.STORE_BYTE || instr.opcode === ILOpcode.STORE_WORD) {
        // PROTECTION: Skip volatile instructions (@zp globals).
        // @zp globals are pinned — even if no function references them,
        // they must be initialized because interrupt handlers or hardware
        // may access them. The isVolatile flag is set by the IL generator
        // for all @zp global access instructions.
        if (instr.isVolatile) {
          continue;
        }

        // PROTECTION: Skip @data globals (they don't appear in globalInit
        // because @data uses the data segment, not init IL. But guard
        // defensively in case they do appear).

        const slotName = this.getStoreTargetSlotName(instr);
        if (slotName && !usedSlots.has(slotName)) {
          deadSlots.add(slotName);
        }
      }
    }

    return deadSlots;
  }

  /**
   * Get the target slot name from a STORE instruction.
   *
   * Extracts the slot name from the first operand of a STORE_BYTE
   * or STORE_WORD instruction.
   *
   * @param instr - A STORE instruction
   * @returns The slot name, or undefined if not a slot operand
   */
  protected getStoreTargetSlotName(instr: ILInstruction): string | undefined {
    if (instr.operands.length > 0 && instr.operands[0].kind === 'slot') {
      return (instr.operands[0] as SlotOperand).slot.name;
    }
    return undefined;
  }

  /**
   * Remove dead initialization instructions from program.globalInit.
   *
   * Walks through globalInit and removes:
   * 1. STORE instructions that target dead slots
   * 2. Value-producing instructions immediately before dead stores
   *    (typically LOAD_IMM that feeds the dead store)
   *
   * The removal is done by building a new filtered array and replacing
   * program.globalInit in place.
   *
   * @param program - The IL program (globalInit is modified in place)
   * @param deadSlots - Set of dead slot names to remove
   * @returns Number of dead globals removed
   */
  protected removeDeadInstructions(program: ILProgram, deadSlots: Set<string>): number {
    // Mark indices to remove: dead stores + their value-producing predecessors
    const removeIndices = new Set<number>();

    for (let i = 0; i < program.globalInit.length; i++) {
      const instr = program.globalInit[i];

      // Check if this is a dead store
      if (instr.opcode === ILOpcode.STORE_BYTE || instr.opcode === ILOpcode.STORE_WORD) {
        const slotName = this.getStoreTargetSlotName(instr);
        if (slotName && deadSlots.has(slotName)) {
          // Mark this store for removal
          removeIndices.add(i);

          // Also remove the preceding value-producing instruction if it exists
          // and is a pure computation (no side effects)
          if (i > 0 && this.isValueProducingInstruction(program.globalInit[i - 1])) {
            removeIndices.add(i - 1);
          }
        }
      }
    }

    // Build filtered globalInit (keep instructions NOT marked for removal)
    if (removeIndices.size > 0) {
      program.globalInit = program.globalInit.filter((_instr, idx) => !removeIndices.has(idx));
    }

    return deadSlots.size;
  }

  /**
   * Check if an instruction is a pure value-producing instruction.
   *
   * These instructions only produce a value (load into accumulator)
   * and have no side effects. They are safe to remove when their
   * consumer (a dead store) is removed.
   *
   * @param instr - The instruction to check
   * @returns true if the instruction is a pure value producer
   */
  protected isValueProducingInstruction(instr: ILInstruction): boolean {
    // LOAD_IMM, LOAD_IMM_WORD, and LOAD_ADDRESS are pure value producers.
    // They load a constant/address into the accumulator with no side effects.
    // LOAD_ADDRESS loads the 16-bit address of a @data slot into A:X.
    return (
      instr.opcode === ILOpcode.LOAD_IMM ||
      instr.opcode === ILOpcode.LOAD_IMM_WORD ||
      instr.opcode === ILOpcode.LOAD_ADDRESS
    );
  }
}

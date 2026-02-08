/**
 * Copy Propagation Optimization Pass
 *
 * Tracks when one variable equals another (`y = x`) and replaces
 * uses of the copy with the original.
 *
 * **Example:**
 * ```
 * // Before:
 * LOAD_BYTE x
 * STORE_BYTE y   // y is copy of x
 * LOAD_BYTE y    // use copy
 *
 * // After:
 * LOAD_BYTE x
 * STORE_BYTE y
 * LOAD_BYTE x    // use original
 * ```
 *
 * **Invalidation Rules:**
 * - Writing to source invalidates all copies of that source
 * - Writing to target invalidates that copy relationship
 * - Control flow clears all copies
 *
 * @module optimizer/passes/copy-prop
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isSlotOperand } from '../../il/guards.js';
import { createInstruction } from '../../il/factories.js';
import type { ILOperand, SlotOperand } from '../../il/operands.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { createResult } from '../pass.js';

// ============================================================================
// Copy Propagation Pass
// ============================================================================

/**
 * Copy Propagation optimization pass.
 *
 * When `y = x` is seen, subsequent uses of `y` can be replaced with `x`.
 * This enables further optimizations and may eliminate the need for `y`.
 *
 * **Works Best After:**
 * - Constant Propagation: Some copies may become constant loads
 *
 * @example
 * ```typescript
 * const copyProp = new CopyPropPass();
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(copyProp);
 * ```
 */
export class CopyPropPass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'copy-prop';

  /** No dependencies - but runs after constant-prop typically */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run copy propagation on a function.
   *
   * Tracks copy relationships and replaces uses of copies with originals.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Track copies: target → source (y = x means copies['y'] = { source: 'x', operand })
    const copies = new Map<string, CopyInfo>();
    const instructions = func.instructions;
    const debugInfo: string[] = [];
    let replaced = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Check for control flow that clears all copies
      if (this.clearsAllCopies(instr)) {
        if (options.debug && copies.size > 0) {
          debugInfo.push(
            `Control flow at ${i} (${ILOpcode[instr.opcode]}) clears ${copies.size} copy relationship(s)`
          );
        }
        copies.clear();
        continue;
      }

      // LOAD_BYTE: replace with source if copy exists
      if (instr.opcode === ILOpcode.LOAD_BYTE) {
        const slot = this.getSlotName(instr);
        if (slot && copies.has(slot)) {
          const copyInfo = copies.get(slot)!;
          // Replace with load from source
          instructions[i] = this.createLoadFromSource(copyInfo, instr);
          replaced++;

          if (options.debug) {
            debugInfo.push(
              `Replaced load of '${slot}' with source '${copyInfo.source}' at index ${i}`
            );
          }
        }
        continue;
      }

      // Check for STORE_BYTE to track/invalidate copies
      if (instr.opcode === ILOpcode.STORE_BYTE) {
        const target = this.getSlotName(instr);
        if (target) {
          // Check if previous instruction is LOAD_BYTE (this is a copy)
          if (i > 0) {
            const prev = instructions[i - 1];
            if (prev.opcode === ILOpcode.LOAD_BYTE) {
              const source = this.getSlotName(prev);
              if (source && source !== target) {
                // Track this copy relationship
                const sourceOperand = prev.operands[0] as SlotOperand;
                copies.set(target, { source, operand: sourceOperand });
                if (options.debug) {
                  debugInfo.push(`Tracking copy: '${target}' = '${source}'`);
                }
                continue;
              }
            }
          }

          // Not a copy - invalidate this target
          this.invalidateCopiesForWrite(copies, target, debugInfo, options.debug);
        }
        continue;
      }

      // Check for other invalidating writes (INC, DEC, etc.)
      if (this.invalidatesSlot(instr)) {
        const slot = this.getSlotName(instr);
        if (slot) {
          this.invalidateCopiesForWrite(copies, slot, debugInfo, options.debug);
        }
      }
    }

    return createResult(0, replaced, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Extract slot name from instruction operand.
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  /**
   * Check if instruction writes to a slot (invalidates copies).
   */
  protected invalidatesSlot(instr: ILInstruction): boolean {
    return (
      instr.opcode === ILOpcode.STORE_BYTE ||
      instr.opcode === ILOpcode.STORE_WORD ||
      instr.opcode === ILOpcode.INC_BYTE ||
      instr.opcode === ILOpcode.DEC_BYTE
    );
  }

  /**
   * Check if instruction clears all copy relationships.
   */
  protected clearsAllCopies(instr: ILInstruction): boolean {
    const opcode = instr.opcode;
    if (opcode === ILOpcode.LABEL) return true;
    if (
      opcode === ILOpcode.JUMP ||
      opcode === ILOpcode.JUMP_EQ ||
      opcode === ILOpcode.JUMP_NE ||
      opcode === ILOpcode.JUMP_LT ||
      opcode === ILOpcode.JUMP_LE ||
      opcode === ILOpcode.JUMP_GE ||
      opcode === ILOpcode.JUMP_GT
    ) {
      return true;
    }
    if (opcode === ILOpcode.CALL) return true;
    return false;
  }

  /**
   * Invalidate copy relationships when a slot is written.
   *
   * Must invalidate:
   * - Direct: If `slot` is a copy target, remove it
   * - Indirect: If `slot` is a copy source, remove all copies that use it
   */
  protected invalidateCopiesForWrite(
    copies: Map<string, CopyInfo>,
    slot: string,
    debugInfo: string[],
    debug?: boolean
  ): void {
    // Remove direct copy if this slot was a copy target
    if (copies.has(slot)) {
      if (debug) {
        debugInfo.push(`Invalidated copy target '${slot}'`);
      }
      copies.delete(slot);
    }

    // Remove any copies that used this slot as source
    for (const [target, info] of copies) {
      if (info.source === slot) {
        if (debug) {
          debugInfo.push(`Invalidated copy '${target}' (source '${slot}' modified)`);
        }
        copies.delete(target);
      }
    }
  }

  /**
   * Create a LOAD_BYTE instruction from the copy source.
   */
  protected createLoadFromSource(copyInfo: CopyInfo, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.LOAD_BYTE, [copyInfo.operand], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (copy propagated from ${copyInfo.source})`
        : `Copy propagated from ${copyInfo.source}`,
    });
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a copy relationship.
 */
interface CopyInfo {
  /** Source slot name (the original) */
  source: string;
  /** Source slot operand (for instruction creation) */
  operand: ILOperand;
}
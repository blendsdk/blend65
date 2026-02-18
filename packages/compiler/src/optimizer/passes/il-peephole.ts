/**
 * IL Peephole Optimization Pass
 *
 * Applies local pattern-based optimizations on instruction sequences.
 * This is the final IL optimization pass before code generation.
 *
 * **Patterns Handled:**
 * - Identity elimination: Remove operations that have no effect
 * - Strength reduction: Replace expensive operations with cheaper ones
 * - Load-store elimination: Remove redundant load/store pairs
 * - Redundant jump elimination: Remove JUMP to immediately following LABEL
 * - PUSH_A/POP_A pair elimination: Remove consecutive push/pop with no stack use
 * - Redundant immediate load elimination: Remove duplicate LOAD_IMM when A unchanged
 * - Modulo-to-bitmask: Replace counter-wrap-at-power-of-2 with AND
 * - Address expression folding: Fold LOAD_ADDRESS+SHR_WORD+LO into LOAD_ADDRESS_EXPR
 * - SHR_WORD+LO narrowing: Replace 16-bit shift+narrow with SHR_WORD_LO for N=3-7, HI+SHR_BYTE for N≥8
 *
 * @module optimizer/passes/il-peephole
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isImmediateOperand, isSlotOperand, isLabelOperand, isInlineContinuationLabel } from '../../il/guards.js';
import { createInstruction, createImmediateOperand } from '../../il/factories.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { mergeResults, createResult } from '../pass.js';

// ============================================================================
// IL Peephole Pass
// ============================================================================

/**
 * IL Peephole optimization pass.
 *
 * Applies local pattern-based optimizations that look at one or more
 * adjacent instructions and transform them into more efficient forms.
 *
 * **Why Run Last:**
 * This pass runs after other optimizations to clean up any remaining
 * patterns that emerged from earlier transformations.
 *
 * @example
 * ```typescript
 * const peephole = new ILPeepholePass();
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(peephole);
 * ```
 */
export class ILPeepholePass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'il-peephole';

  /** Dependencies - runs after other passes have simplified code */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run peephole optimization on a function.
   *
   * Applies multiple pattern transformations in order:
   * 1. Identity elimination (removes no-op instructions)
   * 2. Strength reduction (replaces expensive ops with cheaper)
   * 3. Load-store elimination (removes redundant pairs)
   * 4. Redundant jump elimination (removes JUMP to next instruction)
   * 5. PUSH_A/POP_A pair elimination (removes redundant push/pop)
   * 6. Redundant immediate load elimination (removes duplicate LOAD_IMM)
   * 7. Modulo-to-bitmask (replaces counter-wrap with AND)
   * 8. Address expression folding (folds LOAD_ADDRESS+SHR_WORD+LO)
   * 9. SHR_WORD+LO narrowing (replaces 16-bit shift+narrow with HI+SHR_BYTE)
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const results: PassResult[] = [];

    // Run each pattern transformation
    results.push(this.identityElimination(func, options));
    results.push(this.strengthReduction(func, options));
    results.push(this.loadStoreElimination(func, options));
    results.push(this.redundantJumpElimination(func, options));
    results.push(this.pushPopElimination(func, options));
    results.push(this.redundantImmLoadElimination(func, options));
    results.push(this.moduloToBitmask(func, options));
    // Address expr folding runs BEFORE shrWordLo narrowing so that
    // LOAD_ADDRESS+SHR_WORD+LO patterns are folded into LOAD_ADDRESS_EXPR first.
    // Only remaining standalone SHR_WORD+LO patterns are then narrowed.
    results.push(this.addressExprFolding(func, options));
    results.push(this.shrWordLoNarrowing(func, options));
    // Delay loop canonicalization runs last — it rewrites entire loops
    results.push(this.delayLoopCanonicalization(func, options));

    return mergeResults(results);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 1: Identity Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove identity operations that have no effect.
   *
   * Patterns removed:
   * - ADD_IMM 0 (x + 0 = x)
   * - SUB_IMM 0 (x - 0 = x)
   * - OR_IMM 0 (x | 0 = x)
   * - XOR_IMM 0 (x ^ 0 = x)
   * - AND_IMM 0xFF (x & 0xFF = x for bytes)
   * - SHL_BYTE 0 (x << 0 = x)
   * - SHR_BYTE 0 (x >> 0 = x)
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected identityElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove: number[] = [];
    const debugInfo: string[] = [];

    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      const identityReason = this.getIdentityReason(instr);

      if (identityReason) {
        toRemove.push(i);
        if (options.debug) {
          debugInfo.push(
            `Identity elimination at ${i}: ${ILOpcode[instr.opcode]} (${identityReason})`
          );
        }
      }
    }

    // Remove in reverse order to preserve indices
    if (toRemove.length > 0) {
      func.instructions = func.instructions.filter((_, i) => !toRemove.includes(i));
    }

    return createResult(toRemove.length, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  /**
   * Check if instruction is an identity operation and return reason.
   *
   * @param instr - Instruction to check
   * @returns Reason string if identity, null otherwise
   */
  protected getIdentityReason(instr: ILInstruction): string | null {
    const value = this.getImmediateValue(instr);
    if (value === null) return null;

    switch (instr.opcode) {
      case ILOpcode.ADD_IMM:
        return value === 0 ? 'x + 0 = x' : null;
      case ILOpcode.SUB_IMM:
        return value === 0 ? 'x - 0 = x' : null;
      case ILOpcode.OR_IMM:
        return value === 0 ? 'x | 0 = x' : null;
      case ILOpcode.XOR_IMM:
        return value === 0 ? 'x ^ 0 = x' : null;
      case ILOpcode.AND_IMM:
        return value === 0xff ? 'x & 0xFF = x (byte)' : null;
      case ILOpcode.SHL_BYTE:
        return value === 0 ? 'x << 0 = x' : null;
      case ILOpcode.SHR_BYTE:
        return value === 0 ? 'x >> 0 = x' : null;
      default:
        return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 2: Strength Reduction
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace expensive operations with cheaper equivalents.
   *
   * Patterns:
   * - MUL_IMM by power of 2 → SHL_BYTE log2(n)
   * - MUL_BYTE slot (known power-of-2) → SHL_BYTE log2(n)
   * - DIV_BYTE slot (known power-of-2) → SHR_BYTE log2(n)
   * - MUL_IMM/MUL_BYTE 0 → LOAD_IMM 0 (x * 0 = 0)
   * - MUL_IMM/MUL_BYTE 1 → remove (x * 1 = x)
   * - DIV_BYTE 1 → remove (x / 1 = x)
   * - AND_IMM 0 → LOAD_IMM 0 (x & 0 = 0)
   * - OR_IMM 0xFF → LOAD_IMM 0xFF (x | 0xFF = 0xFF for byte)
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected strengthReduction(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    const toRemove: number[] = [];
    let replaced = 0;

    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      const result = this.tryStrengthReduce(instr, i, func.instructions, options);

      if (result) {
        if (result.remove) {
          // Mark for removal (e.g., multiply by 1 is a no-op)
          toRemove.push(i);
          if (options.debug) {
            debugInfo.push(
              `Strength reduction (removed) at ${i}: ${ILOpcode[instr.opcode]} (${result.reason})`
            );
          }
        } else {
          func.instructions[i] = result.instruction;
          replaced++;
          if (options.debug) {
            debugInfo.push(
              `Strength reduction at ${i}: ${ILOpcode[instr.opcode]} → ${ILOpcode[result.instruction.opcode]} (${result.reason})`
            );
          }
        }
      }
    }

    // Remove marked instructions (reverse order to preserve indices)
    if (toRemove.length > 0) {
      const removeSet = new Set(toRemove);
      func.instructions = func.instructions.filter((_, i) => !removeSet.has(i));
    }

    return createResult(
      toRemove.length,
      replaced,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  /**
   * Attempt to strength-reduce an instruction.
   *
   * Uses instruction context (index + surrounding instructions) to detect
   * known constant values in slots for MUL_BYTE/DIV_BYTE patterns.
   *
   * @param instr - Instruction to check
   * @param index - Index of instruction in the instruction array
   * @param instructions - Full instruction array for backward scanning
   * @param _options - Optimization options (unused, reserved for future)
   * @returns Replacement instruction and reason, or null
   */
  protected tryStrengthReduce(
    instr: ILInstruction,
    index: number,
    instructions: ILInstruction[],
    _options: OptimizationOptions
  ): StrengthReductionResult | null {
    switch (instr.opcode) {
      // MUL_IMM has an immediate operand — direct value check
      case ILOpcode.MUL_IMM:
        return this.tryReduceMultiply(instr, this.getImmediateValue(instr));

      // MUL_BYTE has a slot operand — backward scan for known constant
      case ILOpcode.MUL_BYTE: {
        const slotName = this.getSlotName(instr);
        const knownValue = slotName !== null
          ? this.findSlotConstant(slotName, index, instructions)
          : null;
        return this.tryReduceMultiply(instr, knownValue);
      }

      // DIV_BYTE has a slot operand — backward scan for known constant
      case ILOpcode.DIV_BYTE: {
        const slotName = this.getSlotName(instr);
        const knownValue = slotName !== null
          ? this.findSlotConstant(slotName, index, instructions)
          : null;
        return this.tryReduceDivide(instr, knownValue);
      }

      case ILOpcode.AND_IMM: {
        const value = this.getImmediateValue(instr);
        if (value === 0) {
          return {
            instruction: this.createLoadImm(0, instr),
            reason: 'x & 0 = 0',
          };
        }
        return null;
      }

      case ILOpcode.OR_IMM: {
        const value = this.getImmediateValue(instr);
        if (value === 0xff) {
          return {
            instruction: this.createLoadImm(0xff, instr),
            reason: 'x | 0xFF = 0xFF (byte)',
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Try to reduce multiply to shift or constant.
   *
   * Handles both MUL_IMM (direct immediate) and MUL_BYTE (slot with
   * known constant from backward scan).
   *
   * **Reductions:**
   * - ×0 → LOAD_IMM 0 (result is always 0)
   * - ×1 → remove (identity, no-op)
   * - ×(power-of-2) → SHL_BYTE log2(n)
   *
   * @param instr - MUL_BYTE or MUL_IMM instruction
   * @param value - Known constant value (from immediate or backward scan), null if unknown
   * @returns Reduction result or null if no reduction possible
   */
  protected tryReduceMultiply(
    instr: ILInstruction,
    value: number | null
  ): StrengthReductionResult | null {
    if (value === null) return null;

    // x * 0 = 0 — replace with LOAD_IMM 0
    if (value === 0) {
      return {
        instruction: this.createLoadImm(0, instr),
        reason: 'x * 0 = 0',
      };
    }

    // x * 1 = x — remove the multiply (identity operation)
    if (value === 1) {
      return {
        instruction: instr, // unused when remove=true
        reason: 'x * 1 = x',
        remove: true,
      };
    }

    // x * (power-of-2) → x << log2(n)
    if (this.isPowerOfTwo(value)) {
      const shift = this.log2(value);
      return {
        instruction: this.createShiftLeft(shift, instr),
        reason: `x * ${value} = x << ${shift}`,
      };
    }

    return null;
  }

  /**
   * Try to reduce divide to shift.
   *
   * Handles DIV_BYTE with slot operand when the slot contains a known
   * constant from backward scan.
   *
   * **Reductions:**
   * - ÷1 → remove (identity, no-op)
   * - ÷(power-of-2) → SHR_BYTE log2(n)
   *
   * Note: ÷0 is undefined behavior — we do NOT optimize it.
   *
   * @param instr - DIV_BYTE instruction
   * @param value - Known constant value from backward scan, null if unknown
   * @returns Reduction result or null if no reduction possible
   */
  protected tryReduceDivide(
    instr: ILInstruction,
    value: number | null
  ): StrengthReductionResult | null {
    if (value === null) return null;

    // x / 1 = x — remove the divide (identity operation)
    if (value === 1) {
      return {
        instruction: instr, // unused when remove=true
        reason: 'x / 1 = x',
        remove: true,
      };
    }

    // x / (power-of-2) → x >> log2(n) (unsigned division only)
    if (this.isPowerOfTwo(value)) {
      const shift = this.log2(value);
      return {
        instruction: this.createShiftRight(shift, instr),
        reason: `x / ${value} = x >> ${shift}`,
      };
    }

    return null;
  }

  /**
   * Scan backward from an instruction to find a known constant value
   * stored in a slot.
   *
   * Looks for the pattern: `LOAD_IMM n; STORE_BYTE slot` preceding the
   * current instruction, where the slot has not been overwritten between
   * the store and the current instruction.
   *
   * Stops scanning at:
   * - A write to the target slot (STORE_BYTE with same name)
   * - A label (control flow boundary — value may differ)
   * - A CALL (callee may modify memory)
   * - Start of instruction array
   * - Maximum scan distance (16 instructions) to bound complexity
   *
   * @param slotName - Name of the slot to find a constant for
   * @param currentIndex - Index of the instruction that uses the slot
   * @param instructions - Full instruction array
   * @returns The constant value stored in the slot, or null if unknown
   */
  protected findSlotConstant(
    slotName: string,
    currentIndex: number,
    instructions: ILInstruction[]
  ): number | null {
    // Maximum backward scan distance to bound peephole complexity
    const MAX_SCAN_DISTANCE = 16;
    const minIndex = Math.max(0, currentIndex - MAX_SCAN_DISTANCE);

    for (let i = currentIndex - 1; i >= minIndex; i--) {
      const prev = instructions[i];

      // Stop at control flow boundaries — value may differ on different paths
      if (prev.opcode === ILOpcode.LABEL || prev.opcode === ILOpcode.CALL) {
        return null;
      }

      // Stop at jumps — execution may not flow linearly
      if (
        prev.opcode === ILOpcode.JUMP ||
        prev.opcode === ILOpcode.JUMP_EQ ||
        prev.opcode === ILOpcode.JUMP_NE ||
        prev.opcode === ILOpcode.JUMP_LT ||
        prev.opcode === ILOpcode.JUMP_LE ||
        prev.opcode === ILOpcode.JUMP_GE ||
        prev.opcode === ILOpcode.JUMP_GT
      ) {
        return null;
      }

      // Found a STORE_BYTE to our target slot — check preceding LOAD_IMM
      if (prev.opcode === ILOpcode.STORE_BYTE) {
        const storeSlot = this.getSlotName(prev);
        if (storeSlot === slotName) {
          // Look at the instruction before the STORE for a LOAD_IMM
          if (i > 0) {
            const beforeStore = instructions[i - 1];
            if (beforeStore.opcode === ILOpcode.LOAD_IMM) {
              return this.getImmediateValue(beforeStore);
            }
          }
          // Slot was written but not from a LOAD_IMM — value unknown
          return null;
        }
      }

      // If another instruction writes to the same slot, value is unknown
      // (byte and word INC/DEC variants both modify their slot in place)
      if (
        prev.opcode === ILOpcode.INC_BYTE || prev.opcode === ILOpcode.DEC_BYTE ||
        prev.opcode === ILOpcode.INC_WORD || prev.opcode === ILOpcode.DEC_WORD
      ) {
        const modSlot = this.getSlotName(prev);
        if (modSlot === slotName) {
          return null;
        }
      }

      // STORE_WORD also writes to a slot — value becomes unknown
      if (prev.opcode === ILOpcode.STORE_WORD) {
        const storeSlot = this.getSlotName(prev);
        if (storeSlot === slotName) {
          return null;
        }
      }
    }

    // Reached scan limit without finding slot definition — value unknown
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 3: Load-Store Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove redundant load-store pairs.
   *
   * Patterns:
   * - LOAD_BYTE x; STORE_BYTE x → remove both (no-op)
   * - LOAD_IMM n; STORE_BYTE x; LOAD_BYTE x → remove last load
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected loadStoreElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove = new Set<number>();
    const debugInfo: string[] = [];

    for (let i = 0; i < func.instructions.length - 1; i++) {
      if (toRemove.has(i)) continue;

      const instr = func.instructions[i];
      const next = func.instructions[i + 1];

      // Pattern: LOAD_BYTE x; STORE_BYTE x → remove both
      if (
        instr.opcode === ILOpcode.LOAD_BYTE &&
        next.opcode === ILOpcode.STORE_BYTE
      ) {
        const loadSlot = this.getSlotName(instr);
        const storeSlot = this.getSlotName(next);

        if (loadSlot && storeSlot && loadSlot === storeSlot) {
          toRemove.add(i);
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Load-store elimination at ${i}-${i + 1}: LOAD_BYTE ${loadSlot}; STORE_BYTE ${storeSlot}`
            );
          }
        }
      }

      // Pattern: STORE_BYTE x; LOAD_BYTE x (consecutive) → keep just STORE
      // The value is already in accumulator after store
      if (
        instr.opcode === ILOpcode.STORE_BYTE &&
        next.opcode === ILOpcode.LOAD_BYTE
      ) {
        const storeSlot = this.getSlotName(instr);
        const loadSlot = this.getSlotName(next);

        if (storeSlot && loadSlot && storeSlot === loadSlot) {
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Redundant load after store at ${i + 1}: LOAD_BYTE ${loadSlot} (value already in A)`
            );
          }
        }
      }

      // Pattern: LOAD_WORD x; STORE_WORD x → remove both (no-op)
      // Loading a word from a slot and storing it right back does nothing.
      if (
        instr.opcode === ILOpcode.LOAD_WORD &&
        next.opcode === ILOpcode.STORE_WORD
      ) {
        const loadSlot = this.getSlotName(instr);
        const storeSlot = this.getSlotName(next);

        if (loadSlot && storeSlot && loadSlot === storeSlot) {
          toRemove.add(i);
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Load-store elimination at ${i}-${i + 1}: LOAD_WORD ${loadSlot}; STORE_WORD ${storeSlot}`
            );
          }
        }
      }

      // Pattern: STORE_WORD x; LOAD_WORD x (consecutive) → keep just STORE
      // After STORE_WORD, the A:X word is still in registers, so the
      // subsequent LOAD_WORD from the same slot is redundant. This pattern
      // commonly emerges from function inlining where arguments are stored
      // to parameter slots and the inlined body immediately reloads them.
      if (
        instr.opcode === ILOpcode.STORE_WORD &&
        next.opcode === ILOpcode.LOAD_WORD
      ) {
        const storeSlot = this.getSlotName(instr);
        const loadSlot = this.getSlotName(next);

        if (storeSlot && loadSlot && storeSlot === loadSlot) {
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Redundant load after store at ${i + 1}: LOAD_WORD ${loadSlot} (value already in A:X)`
            );
          }
        }
      }

      // Pattern: STORE_WORD x; LABEL _inline_*_cont; LOAD_WORD x → remove LOAD_WORD
      // After inlining, inline continuation labels sit between a STORE and its
      // immediately-following LOAD. The STORE value is still in A:X after the
      // LABEL (which is a sequencing-only marker), so the LOAD is redundant.
      if (
        i + 2 < func.instructions.length &&
        instr.opcode === ILOpcode.STORE_WORD
      ) {
        const mid = func.instructions[i + 1];
        const afterLabel = func.instructions[i + 2];

        if (
          mid.opcode === ILOpcode.LABEL &&
          isInlineContinuationLabel(mid) &&
          afterLabel.opcode === ILOpcode.LOAD_WORD
        ) {
          const storeSlot = this.getSlotName(instr);
          const loadSlot = this.getSlotName(afterLabel);
          if (storeSlot && loadSlot && storeSlot === loadSlot) {
            toRemove.add(i + 2);

            if (options.debug) {
              debugInfo.push(
                `Redundant load after store (inline label gap) at ${i + 2}: LOAD_WORD ${loadSlot} (value still in A:X across inline label)`
              );
            }
          }
        }
      }

      // Pattern: STORE_BYTE x; LABEL _inline_*_cont; LOAD_BYTE x → remove LOAD_BYTE
      // Same as above but for byte-width operations. The accumulator still holds
      // the stored value across the inline continuation label.
      if (
        i + 2 < func.instructions.length &&
        instr.opcode === ILOpcode.STORE_BYTE
      ) {
        const mid = func.instructions[i + 1];
        const afterLabel = func.instructions[i + 2];

        if (
          mid.opcode === ILOpcode.LABEL &&
          isInlineContinuationLabel(mid) &&
          afterLabel.opcode === ILOpcode.LOAD_BYTE
        ) {
          const storeSlot = this.getSlotName(instr);
          const loadSlot = this.getSlotName(afterLabel);
          if (storeSlot && loadSlot && storeSlot === loadSlot) {
            toRemove.add(i + 2);

            if (options.debug) {
              debugInfo.push(
                `Redundant load after store (inline label gap) at ${i + 2}: LOAD_BYTE ${loadSlot} (value still in A across inline label)`
              );
            }
          }
        }
      }
    }

    // Remove marked instructions
    if (toRemove.size > 0) {
      func.instructions = func.instructions.filter((_, i) => !toRemove.has(i));
    }

    return createResult(
      toRemove.size,
      0,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 4: Redundant Jump Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove JUMP instructions that target the immediately following LABEL.
   *
   * This pattern commonly emerges after function inlining, where RETURN
   * is replaced with `JUMP contLabel` followed by `LABEL contLabel`.
   * When the RETURN was the last instruction in the inlined body, the
   * JUMP targets the very next instruction — a no-op that wastes cycles.
   *
   * **Pattern:**
   * ```
   * JUMP label_X    ← removed (redundant)
   * LABEL label_X   ← kept
   * ```
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected redundantJumpElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove: number[] = [];
    const debugInfo: string[] = [];

    for (let i = 0; i < func.instructions.length - 1; i++) {
      const instr = func.instructions[i];
      const next = func.instructions[i + 1];

      // Pattern: JUMP label followed by LABEL with the same name
      if (
        instr.opcode === ILOpcode.JUMP &&
        next.opcode === ILOpcode.LABEL
      ) {
        // Extract label names from both instructions' operands
        const jumpTarget = instr.operands.length > 0 && isLabelOperand(instr.operands[0])
          ? instr.operands[0].name
          : null;
        const labelName = next.operands.length > 0 && isLabelOperand(next.operands[0])
          ? next.operands[0].name
          : null;

        // If the JUMP targets the immediately following LABEL, it's redundant
        if (jumpTarget !== null && jumpTarget === labelName) {
          toRemove.push(i);

          if (options.debug) {
            debugInfo.push(
              `Redundant jump elimination at ${i}: JUMP ${jumpTarget} → next is LABEL ${labelName}`
            );
          }
        }
      }
    }

    // Remove marked instructions
    if (toRemove.length > 0) {
      const removeSet = new Set(toRemove);
      func.instructions = func.instructions.filter((_, idx) => !removeSet.has(idx));
    }

    return createResult(toRemove.length, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 5: PUSH_A / POP_A Pair Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove PUSH_A / POP_A pairs where A is not modified between them.
   *
   * When the accumulator is pushed to the stack and then popped back
   * without any intervening instruction that modifies A or uses the stack,
   * both instructions are redundant — A already holds the value that
   * POP_A would restore.
   *
   * **Pattern:**
   * ```
   * PUSH_A              ; save A to stack
   * STORE_BYTE slot     ; (example: A-preserving instruction)
   * CMP_IMM 5           ; (example: A-preserving instruction)
   * POP_A               ; restore A — but A wasn't modified, so redundant
   * ```
   *
   * **Safety conditions:**
   * - No instruction between PUSH_A and POP_A modifies A
   * - No instruction between PUSH_A and POP_A uses the stack
   *   (PUSH_A, POP_A, CALL, RETURN)
   * - Maximum scan distance of 8 instructions to bound complexity
   *
   * **Savings:** 2 bytes + 7 cycles (PHA=3 + PLA=4) on 6502.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected pushPopElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove = new Set<number>();
    const debugInfo: string[] = [];

    // Maximum forward scan distance from PUSH_A to POP_A
    const MAX_SCAN = 8;

    for (let i = 0; i < func.instructions.length; i++) {
      if (toRemove.has(i)) continue;

      const instr = func.instructions[i];
      if (instr.opcode !== ILOpcode.PUSH_A) continue;

      // Scan forward for matching POP_A
      let safe = true;
      let popIndex = -1;

      for (let j = i + 1; j < func.instructions.length && j <= i + MAX_SCAN; j++) {
        const between = func.instructions[j];

        // Found the matching POP_A
        if (between.opcode === ILOpcode.POP_A) {
          popIndex = j;
          break;
        }

        // Stack operations invalidate the match — nested push/pop or calls
        if (
          between.opcode === ILOpcode.PUSH_A ||
          between.opcode === ILOpcode.CALL ||
          between.opcode === ILOpcode.RETURN
        ) {
          safe = false;
          break;
        }

        // If any instruction between PUSH_A and POP_A modifies A,
        // the POP_A is needed to restore the original value
        if (this.modifiesAccumulator(between.opcode)) {
          safe = false;
          break;
        }

        // Control flow boundaries make the analysis unsound
        if (between.opcode === ILOpcode.LABEL) {
          safe = false;
          break;
        }
      }

      // If we found a safe PUSH_A/POP_A pair, remove both
      if (safe && popIndex !== -1 && !toRemove.has(popIndex)) {
        toRemove.add(i);
        toRemove.add(popIndex);

        if (options.debug) {
          debugInfo.push(
            `PUSH_A/POP_A pair elimination at ${i}-${popIndex}: A not modified between push/pop`
          );
        }
      }
    }

    // Remove marked instructions
    if (toRemove.size > 0) {
      func.instructions = func.instructions.filter((_, idx) => !toRemove.has(idx));
    }

    return createResult(
      toRemove.size,
      0,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 6: Redundant Immediate Load Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove redundant LOAD_IMM instructions when the accumulator already
   * holds the same value.
   *
   * When a LOAD_IMM is followed by instructions that don't modify A
   * (e.g., STORE_BYTE, CMP_IMM), and then another LOAD_IMM with the
   * same value appears, the second load is redundant.
   *
   * **Pattern:**
   * ```
   * LOAD_IMM 0           ; A = 0
   * STORE_BYTE slot      ; (doesn't modify A)
   * LOAD_IMM 0           ; A already = 0 — redundant!
   * ```
   *
   * **Safety conditions:**
   * - Both LOAD_IMM instructions load the exact same immediate value
   * - No instruction between them modifies A
   * - No control flow boundary (LABEL, JUMP) between them
   * - Maximum scan distance of 8 instructions
   *
   * **Savings:** 2 bytes + 2 cycles per eliminated LDA #imm on 6502.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected redundantImmLoadElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove = new Set<number>();
    const debugInfo: string[] = [];

    // Maximum forward scan distance to look for duplicate LOAD_IMM
    const MAX_SCAN = 8;

    for (let i = 0; i < func.instructions.length; i++) {
      if (toRemove.has(i)) continue;

      const instr = func.instructions[i];
      if (instr.opcode !== ILOpcode.LOAD_IMM) continue;

      const value = this.getImmediateValue(instr);
      if (value === null) continue;

      // Scan forward to find another LOAD_IMM with the same value
      for (let j = i + 1; j < func.instructions.length && j <= i + MAX_SCAN; j++) {
        if (toRemove.has(j)) continue;

        const next = func.instructions[j];

        // Found another LOAD_IMM — check if it's the same value
        if (next.opcode === ILOpcode.LOAD_IMM) {
          const nextValue = this.getImmediateValue(next);
          if (nextValue === value) {
            // Same value — A already holds this, so this LOAD_IMM is redundant.
            // Mark for removal and CONTINUE scanning, because further LOAD_IMMs
            // of the same value may also be redundant (the removed instruction
            // won't act as a "source" in the main loop since toRemove skips it).
            toRemove.add(j);

            if (options.debug) {
              debugInfo.push(
                `Redundant LOAD_IMM elimination at ${j}: LOAD_IMM ${value} (value already in A from ${i})`
              );
            }
            // Continue scanning — more same-value loads may follow
            continue;
          }
          // Different value — A now has a new known value.
          // Stop scanning from index i — the new LOAD_IMM at j becomes
          // the new "source of truth" for forward scanning.
          break;
        }

        // If instruction modifies A, we can't eliminate future LOAD_IMMs
        if (this.modifiesAccumulator(next.opcode)) {
          break;
        }

        // Control flow boundaries make the analysis unsound
        if (
          next.opcode === ILOpcode.LABEL ||
          next.opcode === ILOpcode.JUMP ||
          next.opcode === ILOpcode.JUMP_EQ ||
          next.opcode === ILOpcode.JUMP_NE ||
          next.opcode === ILOpcode.JUMP_LT ||
          next.opcode === ILOpcode.JUMP_LE ||
          next.opcode === ILOpcode.JUMP_GE ||
          next.opcode === ILOpcode.JUMP_GT
        ) {
          break;
        }
      }
    }

    // Remove marked instructions
    if (toRemove.size > 0) {
      func.instructions = func.instructions.filter((_, idx) => !toRemove.has(idx));
    }

    return createResult(
      toRemove.size,
      0,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  /**
   * Check if an IL opcode modifies the accumulator (A register).
   *
   * Used by pushPopElimination and redundantImmLoadElimination to
   * determine if the A register value is preserved between instructions.
   *
   * Opcodes that do NOT modify A:
   * - STORE_BYTE, STORE_WORD (stores A but doesn't change it)
   * - POKE, POKEW, POKE_INDIRECT, POKEW_INDIRECT (writes value, doesn't change A)
   * - STORE_ZP_PTR (stores A:X to ZP pointer, A unchanged)
   * - INC_BYTE, DEC_BYTE, INC_WORD, DEC_WORD (in-place modify, doesn't use A)
   * - CMP_BYTE, CMP_IMM, CMP_WORD_IMM, CMP_WORD_SLOT (flags only)
   * - TRANSFER_AX, TRANSFER_AY (reads A, doesn't modify it)
   * - PUSH_A (saves A, doesn't modify it)
   * - PROMOTE_BYTE_WORD (only sets X=0, A unchanged)
   * - LABEL, NOP, BARRIER, JUMP variants (no register effect)
   *
   * @param opcode - IL opcode to check
   * @returns true if the opcode may modify the accumulator
   */
  protected modifiesAccumulator(opcode: ILOpcode): boolean {
    switch (opcode) {
      // ── A-preserving opcodes ──
      case ILOpcode.STORE_BYTE:
      case ILOpcode.STORE_WORD:
      case ILOpcode.STORE_ZP_PTR:
      case ILOpcode.POKE:
      case ILOpcode.POKEW:
      case ILOpcode.POKE_INDIRECT:
      case ILOpcode.POKEW_INDIRECT:
      case ILOpcode.INC_BYTE:
      case ILOpcode.DEC_BYTE:
      case ILOpcode.INC_WORD:
      case ILOpcode.DEC_WORD:
      case ILOpcode.CMP_BYTE:
      case ILOpcode.CMP_IMM:
      case ILOpcode.CMP_WORD_IMM:
      case ILOpcode.CMP_WORD_SLOT:
      case ILOpcode.TRANSFER_AX:
      case ILOpcode.TRANSFER_AY:
      case ILOpcode.PUSH_A:
      case ILOpcode.PROMOTE_BYTE_WORD:
      case ILOpcode.LABEL:
      case ILOpcode.NOP:
      case ILOpcode.BARRIER:
      case ILOpcode.DELAY_LOOP:
      case ILOpcode.JUMP:
      case ILOpcode.JUMP_EQ:
      case ILOpcode.JUMP_NE:
      case ILOpcode.JUMP_LT:
      case ILOpcode.JUMP_LE:
      case ILOpcode.JUMP_GE:
      case ILOpcode.JUMP_GT:
        return false;

      // ── Everything else modifies A ──
      // LOAD_IMM, LOAD_BYTE, LOAD_WORD, LOAD_ADDRESS, LOAD_ADDRESS_EXPR,
      // ADD_*, SUB_*, MUL_*, DIV_*, MOD_*, AND_*, OR_*, XOR_*, NOT_BYTE,
      // SHL_BYTE, SHR_BYTE, SHR_WORD, SHR_WORD_LO, HI, LO,
      // PEEK, PEEK_INDIRECT, PEEKW, PEEKW_INDIRECT,
      // TRANSFER_XA, TRANSFER_YA, POP_A, CALL, RETURN, ASM_RAW
      default:
        return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 7: Modulo-to-Bitmask (Counter Wrap Optimization)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace counter-wrap-at-power-of-2 patterns with AND bitmask.
   *
   * Detects the 7-instruction "counter wrap" pattern commonly generated
   * for circular buffer indices and animation frame counters:
   *
   * ```
   * ADD_IMM 1            ; increment counter
   * STORE_BYTE slot      ; store result
   * CMP_IMM N            ; compare with limit N
   * JUMP_NE skip_label   ; if counter != N, skip reset
   * LOAD_IMM 0           ; load zero
   * STORE_BYTE slot      ; reset counter to zero
   * LABEL skip_label     ; continuation
   * ```
   *
   * When N is a power of 2 (2, 4, 8, 16, 32, 64, 128), this is equivalent
   * to a modulo operation: `counter = (counter + 1) % N`. The AND bitmask
   * `(counter + 1) & (N - 1)` produces the same result because:
   * - Values 0..N-2: `(x + 1) & (N-1) = x + 1` (no wrapping needed)
   * - Value N-1: `(N-1 + 1) & (N-1) = N & (N-1) = 0` (wraps to 0)
   *
   * Replacement (3 instructions instead of 7):
   * ```
   * ADD_IMM 1            ; increment counter
   * AND_IMM (N-1)        ; bitmask wraps value to 0..N-1
   * STORE_BYTE slot      ; store wrapped result
   * ```
   *
   * **Savings:** 4 instructions removed, eliminates branch and comparison.
   * On 6502: saves ~8-12 bytes and ~10-15 cycles per iteration.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected moduloToBitmask(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    let removed = 0;
    let replaced = 0;

    // We need at least 7 instructions to match the pattern
    // Scan from end to start so index manipulation doesn't shift future matches
    for (let i = func.instructions.length - 7; i >= 0; i--) {
      const match = this.matchCounterWrapPattern(func.instructions, i);
      if (!match) continue;

      // Safety: N must be a power of 2
      if (!this.isPowerOfTwo(match.limit)) continue;

      const bitmask = match.limit - 1;

      // Build replacement: ADD_IMM 1, AND_IMM (N-1), STORE_BYTE slot
      const addInstr = func.instructions[i]; // keep ADD_IMM 1 as-is
      const andInstr = this.createAndImm(bitmask, func.instructions[i + 2]);
      const storeInstr = func.instructions[i + 1]; // reuse original STORE_BYTE

      // Replace the 7-instruction sequence with 3 instructions
      func.instructions.splice(i, 7, addInstr, andInstr, storeInstr);

      // 7 original - 3 replacement = 4 removed
      removed += 4;
      replaced += 1; // the AND_IMM is a new instruction

      if (options.debug) {
        debugInfo.push(
          `Modulo-to-bitmask at ${i}: counter wrap mod ${match.limit} → AND #$${bitmask.toString(16).toUpperCase().padStart(2, '0')} (${match.slotName})`
        );
      }
    }

    return createResult(
      removed,
      replaced,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  /**
   * Match a 7-instruction counter-wrap pattern starting at the given index.
   *
   * Verifies the exact sequence:
   * - [i+0]: ADD_IMM 1
   * - [i+1]: STORE_BYTE slot
   * - [i+2]: CMP_IMM N (where N > 1)
   * - [i+3]: JUMP_NE label
   * - [i+4]: LOAD_IMM 0
   * - [i+5]: STORE_BYTE slot (same slot as i+1)
   * - [i+6]: LABEL label (same label as i+3)
   *
   * @param instrs - Instruction array to scan
   * @param i - Starting index
   * @returns Match details (slot name, limit N) or null if no match
   */
  protected matchCounterWrapPattern(
    instrs: ILInstruction[],
    i: number
  ): CounterWrapMatch | null {
    // Ensure enough instructions remain
    if (i + 6 >= instrs.length) return null;

    const i0 = instrs[i];     // ADD_IMM 1
    const i1 = instrs[i + 1]; // STORE_BYTE slot
    const i2 = instrs[i + 2]; // CMP_IMM N
    const i3 = instrs[i + 3]; // JUMP_NE label
    const i4 = instrs[i + 4]; // LOAD_IMM 0
    const i5 = instrs[i + 5]; // STORE_BYTE slot
    const i6 = instrs[i + 6]; // LABEL label

    // Check opcode sequence
    if (i0.opcode !== ILOpcode.ADD_IMM) return null;
    if (i1.opcode !== ILOpcode.STORE_BYTE) return null;
    if (i2.opcode !== ILOpcode.CMP_IMM) return null;
    if (i3.opcode !== ILOpcode.JUMP_NE) return null;
    if (i4.opcode !== ILOpcode.LOAD_IMM) return null;
    if (i5.opcode !== ILOpcode.STORE_BYTE) return null;
    if (i6.opcode !== ILOpcode.LABEL) return null;

    // Verify ADD_IMM adds exactly 1
    const addValue = this.getImmediateValue(i0);
    if (addValue !== 1) return null;

    // Verify LOAD_IMM loads exactly 0 (reset value)
    const resetValue = this.getImmediateValue(i4);
    if (resetValue !== 0) return null;

    // Verify both STORE_BYTE target the same slot
    const storeSlot1 = this.getSlotName(i1);
    const storeSlot2 = this.getSlotName(i5);
    if (!storeSlot1 || !storeSlot2 || storeSlot1 !== storeSlot2) return null;

    // Verify CMP_IMM has a valid limit (> 1, since mod 1 is always 0)
    const limit = this.getImmediateValue(i2);
    if (limit === null || limit <= 1) return null;

    // Verify JUMP_NE targets the LABEL at i+6
    const jumpLabel = this.getLabelName(i3);
    const labelName = this.getLabelName(i6);
    if (!jumpLabel || !labelName || jumpLabel !== labelName) return null;

    return { slotName: storeSlot1, limit };
  }

  /**
   * Extract label name from a JUMP or LABEL instruction's operand.
   *
   * @param instr - Instruction with a label operand
   * @returns Label name or null if no label operand
   */
  protected getLabelName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isLabelOperand(op) ? op.name : null;
  }

  /**
   * Create an AND_IMM instruction preserving source metadata.
   *
   * Used by moduloToBitmask to replace CMP/JUMP/LOAD/STORE with a
   * single AND bitmask instruction.
   *
   * @param value - Bitmask value (N-1 for modulo N)
   * @param original - Original instruction for location metadata
   * @returns New AND_IMM instruction
   */
  protected createAndImm(value: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.AND_IMM, [createImmediateOperand(value, false)], {
      location: original.location,
      comment: `Modulo bitmask (counter wrap)`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 6: Address Expression Folding
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fold LOAD_ADDRESS + SHR_WORD + LO into a single LOAD_ADDRESS_EXPR.
   *
   * After function inlining, patterns like `getSpriteFrame(@lineFrames, frame)`
   * produce this IL sequence:
   *
   * **Direct pattern (3 → 1):**
   * ```
   * LOAD_ADDRESS slot    ; load 16-bit label address into A:X
   * SHR_WORD N           ; 16-bit shift right by N
   * LO                   ; narrow to low byte
   * ```
   *
   * **Gap pattern (5 → 1):** (when store/reload elimination hasn't run)
   * ```
   * LOAD_ADDRESS slot    ; load 16-bit label address into A:X
   * STORE_WORD slotX     ; store to param slot
   * LOAD_WORD slotX      ; reload from param slot (redundant)
   * SHR_WORD N           ; 16-bit shift right by N
   * LO                   ; narrow to low byte
   * ```
   *
   * Both patterns are replaced with a single instruction:
   * ```
   * LOAD_ADDRESS_EXPR slot, N  ; emits LDA #(label >> N) — 2 bytes, 2 cycles
   * ```
   *
   * **Preconditions:**
   * - Slot must have a dataLabel (ACME label for @data/@sprite variables)
   * - SHR_WORD must have a constant immediate operand
   * - LO must immediately follow SHR_WORD (result is narrowed to byte)
   * - For gap pattern: STORE_WORD/LOAD_WORD must reference the same slot
   *
   * **Savings:** Eliminates the entire 16-bit shift sequence.
   * For SHR_WORD 6: replaces ~36 bytes / ~30 cycles with 2 bytes / 2 cycles.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected addressExprFolding(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    let removed = 0;
    let replaced = 0;

    // Scan from end to start so splice doesn't invalidate future indices
    for (let i = func.instructions.length - 3; i >= 0; i--) {
      const match = this.matchAddressExprPattern(func.instructions, i);
      if (!match) continue;

      // Create the replacement LOAD_ADDRESS_EXPR instruction.
      // Operands: [SlotOperand (from LOAD_ADDRESS), ImmediateOperand (shift count)]
      // The ImmediateOperand's isWord=true flag signals >> (right-shift) to codegen.
      const loadAddrInstr = func.instructions[i];
      const slotOp = loadAddrInstr.operands[0]; // reuse original SlotOperand
      const shiftImm = createImmediateOperand(match.shiftCount, true); // isWord=true → >>

      const replacement = createInstruction(
        ILOpcode.LOAD_ADDRESS_EXPR,
        [slotOp, shiftImm],
        {
          location: loadAddrInstr.location,
          comment: `${match.slotName} >> ${match.shiftCount} (address expr folded from inlined code)`,
        }
      );

      // Replace the matched sequence with the single instruction
      const seqLength = match.patternLength;
      func.instructions.splice(i, seqLength, replacement);

      // seqLength original - 1 replacement = (seqLength-1) removed
      removed += seqLength - 1;
      replaced += 1;

      if (options.debug) {
        debugInfo.push(
          `Address expr folding at ${i}: LOAD_ADDRESS ${match.slotName} + SHR_WORD ${match.shiftCount} + LO → LOAD_ADDRESS_EXPR (${match.patternType})`
        );
      }
    }

    return createResult(
      removed,
      replaced,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  /**
   * Match a LOAD_ADDRESS + SHR_WORD + LO sequence at the given index.
   *
   * Supports two variants:
   *
   * **Direct (3 instructions):**
   *   [i]: LOAD_ADDRESS slot (with dataLabel)
   *   [i+1]: SHR_WORD N
   *   [i+2]: LO
   *
   * **With store/reload gap (5 instructions):**
   *   [i]: LOAD_ADDRESS slot (with dataLabel)
   *   [i+1]: STORE_WORD slotX
   *   [i+2]: LOAD_WORD slotX (same slot)
   *   [i+3]: SHR_WORD N
   *   [i+4]: LO
   *
   * @param instrs - Instruction array
   * @param i - Starting index (must be LOAD_ADDRESS)
   * @returns Match details or null
   */
  protected matchAddressExprPattern(
    instrs: ILInstruction[],
    i: number
  ): AddressExprMatch | null {
    // First instruction must be LOAD_ADDRESS
    if (instrs[i].opcode !== ILOpcode.LOAD_ADDRESS) return null;

    // The slot must have a dataLabel (ACME label).
    // Numeric addresses could be constant-folded at compile time, but
    // LOAD_ADDRESS_EXPR codegen already handles that case, so we allow both.
    // However, the primary benefit is for label-based slots where the
    // assembler resolves the expression at assembly time.
    const loadAddrOp = instrs[i].operands[0];
    if (!isSlotOperand(loadAddrOp)) return null;
    const slotName = loadAddrOp.slot.name;

    // Try direct pattern first: LOAD_ADDRESS, SHR_WORD, LO
    if (i + 2 < instrs.length) {
      const directMatch = this.matchShrWordLo(instrs, i + 1);
      if (directMatch !== null) {
        return {
          slotName,
          shiftCount: directMatch,
          patternLength: 3,
          patternType: 'direct',
        };
      }
    }

    // Try store-gap pattern: LOAD_ADDRESS, STORE_WORD(dead), SHR_WORD, LO
    // This pattern emerges when loadStoreElimination removes LOAD_WORD but
    // leaves behind a dead STORE_WORD between LOAD_ADDRESS and SHR_WORD.
    if (i + 3 < instrs.length) {
      const storeInstr = instrs[i + 1];
      if (storeInstr.opcode === ILOpcode.STORE_WORD) {
        const storeSlot = this.getSlotName(storeInstr);
        const shrLoMatch = this.matchShrWordLo(instrs, i + 2);
        if (storeSlot && shrLoMatch !== null) {
          // Verify the STORE_WORD target is dead (no subsequent LOAD_WORD)
          if (this.isWordSlotDeadAfter(storeSlot, i + 4, instrs)) {
            return {
              slotName,
              shiftCount: shrLoMatch,
              patternLength: 4,
              patternType: 'with-dead-store-gap',
            };
          }
        }
      }
    }

    // Try gap pattern: LOAD_ADDRESS, STORE_WORD, LOAD_WORD, SHR_WORD, LO
    if (i + 4 < instrs.length) {
      const storeInstr = instrs[i + 1];
      const loadInstr = instrs[i + 2];

      // Check STORE_WORD followed by LOAD_WORD with same slot
      if (
        storeInstr.opcode === ILOpcode.STORE_WORD &&
        loadInstr.opcode === ILOpcode.LOAD_WORD
      ) {
        const storeSlot = this.getSlotName(storeInstr);
        const loadSlot = this.getSlotName(loadInstr);

        if (storeSlot && loadSlot && storeSlot === loadSlot) {
          const gapMatch = this.matchShrWordLo(instrs, i + 3);
          if (gapMatch !== null) {
            return {
              slotName,
              shiftCount: gapMatch,
              patternLength: 5,
              patternType: 'with-store-reload-gap',
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if instructions at position j are SHR_WORD N followed by LO.
   *
   * @param instrs - Instruction array
   * @param j - Index where SHR_WORD should be
   * @returns The shift count N, or null if pattern doesn't match
   */
  protected matchShrWordLo(instrs: ILInstruction[], j: number): number | null {
    if (j + 1 >= instrs.length) return null;

    const shrInstr = instrs[j];
    const loInstr = instrs[j + 1];

    // Must be SHR_WORD with immediate operand
    if (shrInstr.opcode !== ILOpcode.SHR_WORD) return null;
    const shiftCount = this.getImmediateValue(shrInstr);
    if (shiftCount === null || shiftCount < 1) return null;

    // Must be followed by LO (narrow to byte)
    if (loInstr.opcode !== ILOpcode.LO) return null;

    return shiftCount;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 7: SHR_WORD + LO Narrowing
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace SHR_WORD N + LO with more efficient forms based on shift count.
   *
   * When a 16-bit right shift is immediately followed by LO (take low byte),
   * the full 16-bit shift is often wasteful. This method applies two
   * optimizations depending on the shift count:
   *
   * **For N ≥ 8:** Replace with HI + SHR_BYTE(N-8).
   * The result's low byte comes entirely from the original high byte,
   * so we just take the high byte and shift it further if needed.
   *
   * **For N = 3-7:** Replace with SHR_WORD_LO(N).
   * Uses the shift-left identity: `lo(word >> N) = hi(word << (8-N))`.
   * Codegen emits: STA tmp / TXA / [ASL tmp / ROL A] × (8-N).
   * This is much cheaper than the generic SHR_WORD loop (6N bytes).
   *
   * **For N = 1-2:** No optimization (not profitable).
   * The shift-left technique for N=1 requires 7 rounds (8-1=7), which
   * is more expensive than the generic 1-2 shift approach.
   *
   * **Pattern detected:**
   * ```
   * SHR_WORD N    ; 16-bit shift right (expensive for N≥3)
   * LO            ; narrow to low byte
   * ```
   *
   * **Replacement for N ≥ 8:**
   * ```
   * HI            ; TXA — move high byte to A
   * SHR_BYTE N-8  ; LSR × (N-8) times (only if N > 8)
   * ```
   *
   * **Replacement for N = 3-7:**
   * ```
   * SHR_WORD_LO N ; fused shift-right + low-byte using shift-left technique
   * ```
   *
   * **Why this runs AFTER addressExprFolding:**
   * The addressExprFolding pass already handles LOAD_ADDRESS + SHR_WORD + LO
   * by folding into LOAD_ADDRESS_EXPR. This pass catches remaining standalone
   * SHR_WORD + LO patterns that weren't part of an address expression.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected shrWordLoNarrowing(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    let removed = 0;
    let replaced = 0;

    // Minimum shift count for the shift-left technique to be profitable.
    // N=3 uses 5 rounds (8-3), N=2 would use 6 rounds — not better than generic.
    const MIN_SHIFT_LEFT_COUNT = 3;

    // Scan from end to start so splice doesn't invalidate future indices
    for (let i = func.instructions.length - 2; i >= 0; i--) {
      const shrInstr = func.instructions[i];
      const loInstr = func.instructions[i + 1];

      // Must be SHR_WORD followed by LO
      if (shrInstr.opcode !== ILOpcode.SHR_WORD) continue;
      if (loInstr.opcode !== ILOpcode.LO) continue;

      // Get the shift count — must be a valid immediate value
      const shiftCount = this.getImmediateValue(shrInstr);
      if (shiftCount === null || shiftCount < MIN_SHIFT_LEFT_COUNT) continue;

      if (shiftCount >= 8) {
        // ── N ≥ 8: HI + SHR_BYTE(N-8) ──
        // The result's low byte comes entirely from the original high byte.
        const hiInstr = createInstruction(ILOpcode.HI, [], {
          location: shrInstr.location,
          comment: `Narrowed from SHR_WORD ${shiftCount} + LO (high byte → A)`,
        });

        const remainder = shiftCount - 8;

        if (remainder === 0) {
          // SHR_WORD 8 + LO → just HI (TXA)
          func.instructions.splice(i, 2, hiInstr);
          removed += 1; // 2 original → 1 replacement
          replaced += 1;
        } else {
          // SHR_WORD N + LO (N > 8) → HI + SHR_BYTE (N-8)
          const shrByteInstr = createInstruction(
            ILOpcode.SHR_BYTE,
            [createImmediateOperand(remainder, false)],
            {
              location: shrInstr.location,
              comment: `Remaining ${remainder} shifts after HI narrowing`,
            }
          );
          func.instructions.splice(i, 2, hiInstr, shrByteInstr);
          replaced += 2;
        }

        if (options.debug) {
          const replacement = remainder === 0
            ? 'HI (TXA only)'
            : `HI + SHR_BYTE ${remainder}`;
          debugInfo.push(
            `SHR_WORD+LO narrowing at ${i}: SHR_WORD ${shiftCount} + LO → ${replacement}`
          );
        }
      } else {
        // ── N = 3-7: SHR_WORD_LO(N) using shift-left technique ──
        // lo(word >> N) = hi(word << (8-N)), emits (8-N) ASL/ROL rounds.
        const shrWordLoInstr = createInstruction(
          ILOpcode.SHR_WORD_LO,
          [createImmediateOperand(shiftCount, false)],
          {
            location: shrInstr.location,
            comment: `Fused SHR_WORD ${shiftCount} + LO → shift-left technique (${8 - shiftCount} rounds)`,
          }
        );

        // Replace 2 instructions (SHR_WORD + LO) with 1 (SHR_WORD_LO)
        func.instructions.splice(i, 2, shrWordLoInstr);
        removed += 1; // 2 original → 1 replacement
        replaced += 1;

        if (options.debug) {
          debugInfo.push(
            `SHR_WORD+LO narrowing at ${i}: SHR_WORD ${shiftCount} + LO → SHR_WORD_LO ${shiftCount} (${8 - shiftCount} ASL/ROL rounds)`
          );
        }
      }
    }

    return createResult(
      removed,
      replaced,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 10: Delay Loop Canonicalization
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace barrier-only loops with canonical DEX/BNE delay loops.
   *
   * Detects counted for-loops whose body contains only BARRIER instructions
   * (no side effects beyond timing). These loops exist solely for delay
   * purposes and can be replaced with the compact 6502 idiom:
   *   `LDX #N / .loop: DEX / BNE .loop`  (5 bytes, N×5 cycles)
   *
   * Instead of the generic loop codegen which may use 15-20+ bytes.
   *
   * **Detection uses func.loops metadata** (populated by IL generator):
   * - Loop must be counted (`isCountedLoop === true`)
   * - Bound must be statically known (`boundValue` in 1-255)
   * - Loop body (between header and exit labels) must contain ONLY:
   *   - BARRIER instructions (the delay body)
   *   - Loop control: LOAD_BYTE counter, CMP_IMM, conditional jumps,
   *     INC_BYTE/DEC_BYTE counter, unconditional JUMP back to header
   *   - LABEL (structural markers)
   *
   * **Replacement:** The entire loop (header through exit label) is replaced
   * with a single DELAY_LOOP instruction. The counter init code before the
   * header becomes dead and will be cleaned by subsequent DCE passes.
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected delayLoopCanonicalization(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    let removed = 0;
    let replaced = 0;

    // Guard: if no loop metadata is available, nothing to canonicalize
    if (!func.loops || func.loops.length === 0) {
      return createResult(0, 0);
    }

    // Process loops in reverse order so splice indices stay valid
    for (let loopIdx = func.loops.length - 1; loopIdx >= 0; loopIdx--) {
      const loop = func.loops[loopIdx];

      // Must be a counted loop with known bound in byte range
      if (!loop.isCountedLoop) continue;
      if (loop.boundValue === undefined || loop.boundValue < 1 || loop.boundValue > 255) continue;

      // Find header and exit label indices in instruction array
      const headerIdx = this.findLabelIndex(func.instructions, loop.headerLabel);
      const exitIdx = this.findLabelIndex(func.instructions, loop.exitLabel);
      if (headerIdx === -1 || exitIdx === -1 || exitIdx <= headerIdx) continue;

      // Get counter slot name for matching loop control instructions
      const counterSlotName = loop.counterSlot?.name ?? null;

      // Check if loop body is barrier-only (no side effects beyond timing)
      if (!this.isBarrierOnlyLoop(func.instructions, headerIdx, exitIdx, counterSlotName)) {
        continue;
      }

      // Create the replacement DELAY_LOOP instruction
      const delayInstr = createInstruction(
        ILOpcode.DELAY_LOOP,
        [createImmediateOperand(loop.boundValue, false)],
        {
          location: func.instructions[headerIdx].location,
          comment: `Canonical delay loop: ${loop.boundValue} iterations (was barrier-only for loop)`,
        }
      );

      // Replace header..exit (inclusive of exit label) with DELAY_LOOP + exit label
      // Keep the exit label so any code after the loop can still reference it
      const exitLabelInstr = func.instructions[exitIdx];
      const seqLength = exitIdx - headerIdx + 1; // header through exit label inclusive
      func.instructions.splice(headerIdx, seqLength, delayInstr, exitLabelInstr);

      // Statistics: replaced seqLength instructions with 2 (DELAY_LOOP + exit label)
      removed += seqLength - 2;
      replaced += 1;

      if (options.debug) {
        debugInfo.push(
          `Delay loop canonicalization: ${loop.headerLabel}..${loop.exitLabel} (${loop.boundValue} iters) → DELAY_LOOP ${loop.boundValue}`
        );
      }
    }

    return createResult(
      removed,
      replaced,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  /**
   * Find the index of a LABEL instruction with the given name.
   *
   * @param instructions - Instruction array to search
   * @param labelName - Label name to find
   * @returns Index of the LABEL instruction, or -1 if not found
   */
  protected findLabelIndex(instructions: ILInstruction[], labelName: string): number {
    for (let i = 0; i < instructions.length; i++) {
      if (instructions[i].opcode === ILOpcode.LABEL) {
        const name = this.getLabelName(instructions[i]);
        if (name === labelName) return i;
      }
    }
    return -1;
  }

  /**
   * Check if a loop body contains only BARRIER instructions and loop control.
   *
   * Scans instructions from headerIdx+1 to exitIdx-1 (exclusive of both
   * the header label and exit label). Each instruction must be one of:
   * - BARRIER (the delay body — acceptable)
   * - LABEL (structural marker — acceptable)
   * - LOAD_BYTE of counterSlot (loop control — reading counter)
   * - CMP_IMM or CMP_BYTE (loop control — bound check)
   * - JUMP_GE, JUMP_NE, JUMP_LT, etc. (loop control — conditional exit)
   * - INC_BYTE or DEC_BYTE of counterSlot (loop control — counter update)
   * - JUMP (loop control — back-edge to header)
   *
   * Any other instruction means the loop has side effects and cannot
   * be replaced with a simple delay loop.
   *
   * @param instructions - Full instruction array
   * @param headerIdx - Index of the header LABEL
   * @param exitIdx - Index of the exit LABEL
   * @param counterSlotName - Name of the loop counter slot (null if unknown)
   * @returns true if the loop body is barrier-only
   */
  protected isBarrierOnlyLoop(
    instructions: ILInstruction[],
    headerIdx: number,
    exitIdx: number,
    counterSlotName: string | null
  ): boolean {
    // Scan all instructions in the loop body (between header and exit labels)
    for (let i = headerIdx + 1; i < exitIdx; i++) {
      const instr = instructions[i];

      switch (instr.opcode) {
        // Acceptable: delay body
        case ILOpcode.BARRIER:
        // Acceptable: structural markers
        case ILOpcode.LABEL:
        // Acceptable: loop control — conditional branches
        case ILOpcode.JUMP_EQ:
        case ILOpcode.JUMP_NE:
        case ILOpcode.JUMP_LT:
        case ILOpcode.JUMP_LE:
        case ILOpcode.JUMP_GE:
        case ILOpcode.JUMP_GT:
        // Acceptable: loop control — back-edge
        case ILOpcode.JUMP:
        // Acceptable: loop control — bound comparison
        case ILOpcode.CMP_IMM:
        case ILOpcode.CMP_BYTE:
          break;

        // Acceptable IF it's the counter slot
        case ILOpcode.LOAD_BYTE:
        case ILOpcode.INC_BYTE:
        case ILOpcode.DEC_BYTE: {
          if (counterSlotName === null) return false;
          const slotName = this.getSlotName(instr);
          if (slotName !== counterSlotName) return false;
          break;
        }

        // Anything else is a side effect — not a pure delay loop
        default:
          return false;
      }
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if a word slot has no subsequent LOAD_WORD readers after a given index.
   *
   * Used to verify a STORE_WORD is dead before removing it in addressExprFolding.
   * Scans forward from startIndex to end of function looking for any LOAD_WORD
   * that references the same slot. If found, the store is still live.
   *
   * @param slotName - Name of the slot to check for liveness
   * @param startIndex - Index to start scanning from (exclusive of the STORE itself)
   * @param instructions - Full instruction array to scan
   * @returns true if no LOAD_WORD for this slot is found (slot is dead)
   */
  protected isWordSlotDeadAfter(
    slotName: string,
    startIndex: number,
    instructions: ILInstruction[]
  ): boolean {
    for (let j = startIndex; j < instructions.length; j++) {
      if (instructions[j].opcode === ILOpcode.LOAD_WORD) {
        const loadSlot = this.getSlotName(instructions[j]);
        if (loadSlot === slotName) return false; // Slot is read later — not dead
      }
    }
    return true; // No readers found — slot is dead
  }

  /**
   * Extract immediate value from instruction operand.
   *
   * @param instr - Instruction to examine
   * @returns Immediate value or null if not immediate
   */
  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) {
      return null;
    }

    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }

  /**
   * Extract slot name from instruction operand.
   *
   * @param instr - Instruction to examine
   * @returns Slot name or null if not a slot operand
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) {
      return null;
    }

    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  /**
   * Create a LOAD_IMM instruction preserving metadata.
   *
   * @param value - Immediate value to load
   * @param original - Original instruction for metadata
   * @returns New LOAD_IMM instruction
   */
  protected createLoadImm(value: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.LOAD_IMM, [createImmediateOperand(value, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced)`
        : 'Strength reduced',
    });
  }

  /**
   * Create a SHL_BYTE instruction preserving metadata.
   *
   * @param shiftCount - Number of bits to shift
   * @param original - Original instruction for metadata
   * @returns New SHL_BYTE instruction
   */
  protected createShiftLeft(shiftCount: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.SHL_BYTE, [createImmediateOperand(shiftCount, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced from multiply)`
        : 'Strength reduced from multiply',
    });
  }

  /**
   * Create a SHR_BYTE instruction preserving metadata.
   *
   * @param shiftCount - Number of bits to shift
   * @param original - Original instruction for metadata
   * @returns New SHR_BYTE instruction
   */
  protected createShiftRight(shiftCount: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.SHR_BYTE, [createImmediateOperand(shiftCount, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced from divide)`
        : 'Strength reduced from divide',
    });
  }

  /**
   * Check if a number is a power of 2.
   *
   * @param n - Number to check
   * @returns true if n is a power of 2
   */
  protected isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Calculate log base 2 of a power of 2.
   *
   * @param n - Power of 2
   * @returns log2(n)
   */
  protected log2(n: number): number {
    return Math.log2(n);
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a strength reduction attempt.
 *
 * When `remove` is true, the instruction should be removed entirely
 * (e.g., multiply by 1 is a no-op). In that case `instruction` is unused.
 */
interface StrengthReductionResult {
  /** The replacement instruction (ignored when remove=true) */
  instruction: ILInstruction;
  /** Human-readable reason for the reduction */
  reason: string;
  /** If true, remove the instruction instead of replacing it */
  remove?: boolean;
}

/**
 * Result of matching a counter-wrap pattern.
 *
 * Contains the slot name being wrapped and the modulo limit N.
 * Used by `moduloToBitmask()` to verify the limit is a power of 2
 * before applying the AND bitmask optimization.
 */
interface CounterWrapMatch {
  /** Name of the slot being incremented and wrapped */
  slotName: string;
  /** The wrap limit N from the CMP_IMM instruction */
  limit: number;
}

/**
 * Result of matching a LOAD_ADDRESS + SHR_WORD + LO pattern.
 *
 * Contains the slot name, shift count, pattern length (3 or 5),
 * and pattern type (direct or with-store-reload-gap).
 * Used by `addressExprFolding()` to build the replacement instruction.
 */
interface AddressExprMatch {
  /** Name of the slot whose address is being loaded */
  slotName: string;
  /** Shift count from the SHR_WORD instruction */
  shiftCount: number;
  /** Total number of instructions matched (3 for direct, 5 for gap) */
  patternLength: number;
  /** Which variant of the pattern was matched */
  patternType: 'direct' | 'with-store-reload-gap' | 'with-dead-store-gap';
}

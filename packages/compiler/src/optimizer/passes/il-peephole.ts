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
 * - Modulo-to-bitmask: Replace counter-wrap-at-power-of-2 with AND
 *
 * @module optimizer/passes/il-peephole
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isImmediateOperand, isSlotOperand, isLabelOperand } from '../../il/guards.js';
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
   * 5. Modulo-to-bitmask (replaces counter-wrap with AND)
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
    results.push(this.moduloToBitmask(func, options));

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
  // Pattern 5: Modulo-to-Bitmask (Counter Wrap Optimization)
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
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

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

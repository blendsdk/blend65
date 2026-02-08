/**
 * IL Analysis Module
 *
 * Provides optimization analysis passes for IL:
 * - Live Range Analysis (backward dataflow)
 * - Dead Store Detection
 * - Optimization Hints Computation
 *
 * These analyses enable the optimizer to make informed decisions
 * about dead code elimination, register allocation, and hot path
 * optimization.
 *
 * @module il/analysis
 */

import { ILOpcode } from './enums.js';
import { ILInstruction, OptimizationHints } from './instruction.js';
import { ILFunction } from './structures.js';
import { isSlotOperand, isLabelOperand } from './guards.js';
import { SlotOperand } from './operands.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get defined variables from an instruction's def-use info.
 *
 * @param instr - Instruction to analyze
 * @returns Array of defined variable names
 */
function getDefs(instr: ILInstruction): string[] {
  return instr.defUse?.defs ?? [];
}

/**
 * Get used variables from an instruction's def-use info.
 *
 * @param instr - Instruction to analyze
 * @returns Array of used variable names
 */
function getUses(instr: ILInstruction): string[] {
  return instr.defUse?.uses ?? [];
}

// ============================================================================
// Control Flow Analysis
// ============================================================================

/**
 * Build a map from label names to instruction indices.
 *
 * @param instructions - Array of instructions
 * @returns Map from label name to index
 */
function buildLabelMap(instructions: ILInstruction[]): Map<string, number> {
  const labelMap = new Map<string, number>();
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
      const labelOp = instr.operands[0];
      if (isLabelOperand(labelOp)) {
        labelMap.set(labelOp.name, i);
      }
    }
  }
  return labelMap;
}

/**
 * Get successor indices for an instruction.
 *
 * For control flow analysis, we need to know which instructions
 * can follow this one.
 *
 * @param instructions - Array of all instructions
 * @param index - Current instruction index
 * @param labelMap - Map from label names to indices
 * @returns Array of successor indices
 */
function getSuccessors(
  instructions: ILInstruction[],
  index: number,
  labelMap: Map<string, number>
): number[] {
  const instr = instructions[index];
  const successors: number[] = [];

  // Handle different control flow patterns
  switch (instr.opcode) {
    case ILOpcode.JUMP:
      // Unconditional jump - only target
      if (instr.operands.length > 0 && isLabelOperand(instr.operands[0])) {
        const targetIdx = labelMap.get(instr.operands[0].name);
        if (targetIdx !== undefined) {
          successors.push(targetIdx);
        }
      }
      break;

    case ILOpcode.JUMP_EQ:
    case ILOpcode.JUMP_NE:
    case ILOpcode.JUMP_LT:
    case ILOpcode.JUMP_LE:
    case ILOpcode.JUMP_GE:
    case ILOpcode.JUMP_GT:
      // Conditional jump - target + fallthrough
      if (instr.operands.length > 0 && isLabelOperand(instr.operands[0])) {
        const targetIdx = labelMap.get(instr.operands[0].name);
        if (targetIdx !== undefined) {
          successors.push(targetIdx);
        }
      }
      // Fall through to next instruction
      if (index + 1 < instructions.length) {
        successors.push(index + 1);
      }
      break;

    case ILOpcode.RETURN:
      // No successors (exit point)
      break;

    default:
      // Normal instruction - fall through to next
      if (index + 1 < instructions.length) {
        successors.push(index + 1);
      }
      break;
  }

  return successors;
}

// ============================================================================
// Live Range Analysis
// ============================================================================

/**
 * Compute live ranges for all instructions in a function.
 *
 * Uses backward dataflow analysis:
 * - liveIn = (liveOut - defs) ∪ uses
 * - liveOut = union of liveIn of all successors
 *
 * Iterates until fixed point is reached.
 *
 * @param func - IL function to analyze
 *
 * @example
 * ```typescript
 * // After calling computeLiveRanges:
 * func.instructions[i].liveIn  // Variables live at entry
 * func.instructions[i].liveOut // Variables live at exit
 * ```
 */
export function computeLiveRanges(func: ILFunction): void {
  const instructions = func.instructions;
  if (instructions.length === 0) return;

  // Build label map for control flow
  const labelMap = buildLabelMap(instructions);

  // Initialize all liveIn/liveOut to empty sets
  for (const instr of instructions) {
    instr.liveIn = new Set<string>();
    instr.liveOut = new Set<string>();
  }

  // Build predecessor map for efficiency
  const predecessors: Map<number, number[]> = new Map();
  for (let i = 0; i < instructions.length; i++) {
    predecessors.set(i, []);
  }

  for (let i = 0; i < instructions.length; i++) {
    const succs = getSuccessors(instructions, i, labelMap);
    for (const succ of succs) {
      predecessors.get(succ)!.push(i);
    }
  }

  // Iterate until fixed point
  let changed = true;
  let iterations = 0;
  const maxIterations = instructions.length * 10; // Safety limit

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Backward iteration (from end to start)
    for (let i = instructions.length - 1; i >= 0; i--) {
      const instr = instructions[i];
      const oldLiveInSize = instr.liveIn!.size;
      const oldLiveOutSize = instr.liveOut!.size;

      // liveOut = union of liveIn of all successors
      const successors = getSuccessors(instructions, i, labelMap);
      const newLiveOut = new Set<string>();
      for (const succIdx of successors) {
        const succInstr = instructions[succIdx];
        if (succInstr.liveIn) {
          for (const v of succInstr.liveIn) {
            newLiveOut.add(v);
          }
        }
      }
      instr.liveOut = newLiveOut;

      // liveIn = (liveOut - defs) ∪ uses
      const newLiveIn = new Set<string>(instr.liveOut);

      // Remove defined variables
      for (const def of getDefs(instr)) {
        newLiveIn.delete(def);
      }

      // Add used variables
      for (const use of getUses(instr)) {
        newLiveIn.add(use);
      }
      instr.liveIn = newLiveIn;

      // Check if changed (set sizes changed)
      if (
        instr.liveIn.size !== oldLiveInSize ||
        instr.liveOut!.size !== oldLiveOutSize
      ) {
        changed = true;
      }
    }
  }
}

// ============================================================================
// Dead Store Detection
// ============================================================================

/**
 * Check if a store instruction is dead (value never used).
 *
 * A store is dead if the variable being stored to is not
 * live after this instruction.
 *
 * @param instr - Instruction to check
 * @returns true if this is a dead store
 *
 * @example
 * ```typescript
 * // Given:
 * // let x: byte = 5;  // x is not used later
 * // return 0;
 * // The store to x is dead because x is not in liveOut
 * if (isDeadStore(storeInstr)) {
 *   // Can eliminate this store
 * }
 * ```
 */
export function isDeadStore(instr: ILInstruction): boolean {
  // Only check store instructions
  if (
    instr.opcode !== ILOpcode.STORE_BYTE &&
    instr.opcode !== ILOpcode.STORE_WORD
  ) {
    return false;
  }

  // Get the variable being stored to
  if (instr.operands.length === 0) return false;
  const operand = instr.operands[0];
  if (!isSlotOperand(operand)) return false;

  const varName = (operand as SlotOperand).slot.name;

  // If variable is not live after this store, it's dead!
  // Note: liveOut must be computed first via computeLiveRanges()
  if (!instr.liveOut) return false;

  return !instr.liveOut.has(varName);
}

// ============================================================================
// Optimization Hints
// ============================================================================

/**
 * Check if an instruction accesses a "hot" slot.
 *
 * A slot is hot if it's used in a loop (maxLoopDepth > 0).
 *
 * @param instr - Instruction to check
 * @returns true if instruction accesses a hot slot
 */
export function hasHotSlotAccess(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op)) {
      const slot = (op as SlotOperand).slot;
      if (slot.maxLoopDepth !== undefined && slot.maxLoopDepth > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if an instruction accesses a frequently-used slot.
 *
 * A slot is frequently accessed if accessCount > threshold (default 20).
 *
 * @param instr - Instruction to check
 * @param threshold - Access count threshold (default 20)
 * @returns true if instruction accesses a frequent slot
 */
export function hasFrequentSlotAccess(
  instr: ILInstruction,
  threshold: number = 20
): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op)) {
      const slot = (op as SlotOperand).slot;
      if (slot.accessCount !== undefined && slot.accessCount > threshold) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if an instruction can be coalesced with adjacent instructions.
 *
 * Coalescing opportunities:
 * - Load followed by store to same address
 * - Consecutive loads from adjacent addresses
 * - Add/sub with immediate 1 → inc/dec
 *
 * @param instr - Current instruction
 * @param nextInstr - Next instruction (optional)
 * @returns true if can be coalesced
 */
export function canCoalesce(
  instr: ILInstruction,
  nextInstr?: ILInstruction
): boolean {
  if (!nextInstr) return false;

  // Load-Store coalescing: LOAD X followed by STORE X can be combined
  if (
    (instr.opcode === ILOpcode.LOAD_BYTE && nextInstr.opcode === ILOpcode.STORE_BYTE) ||
    (instr.opcode === ILOpcode.LOAD_WORD && nextInstr.opcode === ILOpcode.STORE_WORD)
  ) {
    // Check if same slot
    if (
      instr.operands.length > 0 &&
      nextInstr.operands.length > 0 &&
      isSlotOperand(instr.operands[0]) &&
      isSlotOperand(nextInstr.operands[0])
    ) {
      const loadSlot = (instr.operands[0] as SlotOperand).slot;
      const storeSlot = (nextInstr.operands[0] as SlotOperand).slot;
      if (loadSlot.name === storeSlot.name) {
        // This is a no-op (load then store same value)
        return true;
      }
    }
  }

  // Add/Sub immediate 1 → Inc/Dec coalescing
  if (
    (instr.opcode === ILOpcode.ADD_IMM || instr.opcode === ILOpcode.SUB_IMM) &&
    nextInstr.opcode === ILOpcode.STORE_BYTE
  ) {
    // Could be coalesced into INC/DEC if adding/subtracting 1
    // and storing back to the same variable we loaded from
    return true;
  }

  return false;
}

/**
 * Compute optimization hints for an instruction.
 *
 * @param instr - Instruction to analyze
 * @param loopDepth - Current loop nesting depth (0 = not in loop)
 * @param nextInstr - Next instruction for coalescing check
 * @returns Optimization hints
 *
 * @example
 * ```typescript
 * const hints = computeHints(instr, currentLoopDepth, instructions[i + 1]);
 * instr.hints = hints;
 * ```
 */
export function computeHints(
  instr: ILInstruction,
  loopDepth: number = 0,
  nextInstr?: ILInstruction
): OptimizationHints {
  return {
    isHotPath: loopDepth > 0 || hasHotSlotAccess(instr),
    isFrequentAccess: hasFrequentSlotAccess(instr),
    canCoalesce: canCoalesce(instr, nextInstr),
    isDead: isDeadStore(instr),
  };
}

// ============================================================================
// Full Analysis Pass
// ============================================================================

/**
 * Run all optimization analysis passes on a function.
 *
 * Performs in order:
 * 1. Live range computation (backward dataflow)
 * 2. Optimization hints computation
 *
 * @param func - IL function to analyze
 *
 * @example
 * ```typescript
 * const func = generator.generateFunction(decl);
 * runAnalysisPasses(func);
 * // func.instructions now have liveIn, liveOut, hints populated
 * ```
 */
export function runAnalysisPasses(func: ILFunction): void {
  // Step 1: Compute live ranges
  computeLiveRanges(func);

  // Step 2: Compute optimization hints
  // We need to track loop depth for hot path detection
  const instructions = func.instructions;
  let loopDepth = 0;

  // Simple approach: use maxLoopDepth from function if available
  // More accurate: track label-based loop boundaries
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    const nextInstr = i + 1 < instructions.length ? instructions[i + 1] : undefined;

    // Update loop depth heuristically based on labels
    // (This is a simplified approach - a more accurate one would
    // track actual loop boundaries from ILLoop structures)
    if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
      const labelOp = instr.operands[0];
      if (isLabelOperand(labelOp)) {
        const labelName = labelOp.name;
        if (labelName.includes('_header') || labelName.includes('_loop')) {
          loopDepth++;
        } else if (labelName.includes('_exit') || labelName.includes('_end')) {
          loopDepth = Math.max(0, loopDepth - 1);
        }
      }
    }

    // Compute hints for this instruction
    instr.hints = computeHints(instr, loopDepth, nextInstr);
  }
}

/**
 * Run analysis passes using actual loop structure information.
 *
 * This is more accurate than runAnalysisPasses() because it uses
 * the actual ILLoop boundaries rather than heuristics.
 *
 * @param func - IL function to analyze
 *
 * @example
 * ```typescript
 * const func = generator.generateFunction(decl);
 * runAnalysisPassesWithLoops(func);
 * // More accurate hot path detection
 * ```
 */
export function runAnalysisPassesWithLoops(func: ILFunction): void {
  // Step 1: Compute live ranges
  computeLiveRanges(func);

  // Step 2: Build loop depth map from ILLoop structures
  const loopDepthMap = buildLoopDepthMap(func);

  // Step 3: Compute optimization hints with accurate loop depth
  const instructions = func.instructions;
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    const nextInstr = i + 1 < instructions.length ? instructions[i + 1] : undefined;
    const depth = loopDepthMap.get(i) ?? 0;

    instr.hints = computeHints(instr, depth, nextInstr);
  }
}

/**
 * Build a map from instruction index to loop depth.
 *
 * Uses ILLoop boundaries to determine which instructions
 * are inside loops.
 *
 * @param func - IL function with loops array populated
 * @returns Map from instruction index to loop depth
 */
function buildLoopDepthMap(func: ILFunction): Map<number, number> {
  const depthMap = new Map<number, number>();
  const instructions = func.instructions;
  const labelMap = buildLabelMap(instructions);

  // Initialize all to depth 0
  for (let i = 0; i < instructions.length; i++) {
    depthMap.set(i, 0);
  }

  // For each loop, increment depth for instructions inside
  for (const loop of func.loops) {
    const headerIdx = labelMap.get(loop.headerLabel);
    const exitIdx = labelMap.get(loop.exitLabel);

    if (headerIdx !== undefined && exitIdx !== undefined) {
      // All instructions from header to exit are in this loop
      for (let i = headerIdx; i < exitIdx; i++) {
        const currentDepth = depthMap.get(i) ?? 0;
        depthMap.set(i, currentDepth + 1);
      }
    }
  }

  return depthMap;
}

// ============================================================================
// Statistics and Debugging
// ============================================================================

/**
 * Get analysis statistics for a function.
 *
 * @param func - Analyzed IL function
 * @returns Analysis statistics
 */
export function getAnalysisStats(func: ILFunction): AnalysisStats {
  const instructions = func.instructions;
  let deadStores = 0;
  let hotInstructions = 0;
  let coalesceableInstructions = 0;
  let frequentAccesses = 0;

  for (const instr of instructions) {
    if (instr.hints) {
      if (instr.hints.isDead) deadStores++;
      if (instr.hints.isHotPath) hotInstructions++;
      if (instr.hints.canCoalesce) coalesceableInstructions++;
      if (instr.hints.isFrequentAccess) frequentAccesses++;
    }
  }

  return {
    totalInstructions: instructions.length,
    deadStores,
    hotInstructions,
    coalesceableInstructions,
    frequentAccesses,
    maxLoopDepth: func.maxLoopDepth,
    loopCount: func.loops.length,
  };
}

/**
 * Analysis statistics for debugging and reporting.
 */
export interface AnalysisStats {
  /** Total number of instructions */
  totalInstructions: number;

  /** Number of dead store instructions */
  deadStores: number;

  /** Number of hot path instructions */
  hotInstructions: number;

  /** Number of coalesceable instructions */
  coalesceableInstructions: number;

  /** Number of frequent access instructions */
  frequentAccesses: number;

  /** Maximum loop nesting depth */
  maxLoopDepth: number;

  /** Number of loops in function */
  loopCount: number;
}
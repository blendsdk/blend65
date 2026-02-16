/**
 * Function Inlining Pass
 *
 * Replaces function call sites with the body of the called function,
 * eliminating the overhead of JSR/RTS instructions. This is a
 * program-level optimization pass that operates on the entire ILProgram.
 *
 * **Strategies by optimization level:**
 * - O1: Single-call-site inlining — functions called exactly once are always
 *   inlined (saves 12 cycles and 4 bytes on 6502 — JSR=6cy/3B + RTS=6cy/1B)
 * - O2/O3: Small-function inlining — functions below a size threshold
 *   (SMALL_FUNCTION_THRESHOLD) are inlined even with multiple call sites,
 *   subject to a 20% code growth budget (MAX_SIZE_GROWTH_RATIO)
 * - Os/Oz: No inlining — size optimization avoids code duplication
 *
 * **Algorithm:**
 * 1. Build call graph from the ILProgram
 * 2. Find inlining candidates based on strategy (single-call-site at O1)
 * 3. Process candidates bottom-up (leaf functions first):
 *    a. Find the CALL instruction in the caller
 *    b. Clone the callee's instructions with remapped labels and slots
 *    c. Replace RETURN with JUMP to a continuation label
 *    d. Replace the CALL with the cloned instruction body
 * 4. Dead function elimination will clean up fully-inlined functions
 *
 * **Safety checks:**
 * - Recursive functions (direct or mutual) are NOT inlined
 * - Exported and callback functions are NOT inlined (must remain callable)
 * - Intrinsic/asm functions are NOT inlined
 *
 * **Enabled at:** O1+ (via 'function-inline' in PROGRAM_LEVEL_PASSES)
 *
 * @module optimizer/passes/function-inlining
 */

import { ILOpcode } from '../../il/enums.js';
import type { FunctionOperand, LabelOperand, SlotOperand } from '../../il/operands.js';
import type { ILInstruction } from '../../il/instruction.js';
import type { ILFunction, ILProgram } from '../../il/structures.js';
import type { OptimizationOptions } from '../options.js';
import type { ProgramOptimizationPass, ProgramPassResult } from '../pass.js';
import { createEmptyProgramResult, createProgramResult } from '../pass.js';
import { CallGraph } from '../analysis/call-graph.js';
import { SlotKind } from '../../frame/enums.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum function size (instruction count) for small-function inlining at O2+.
 *
 * Functions with this many or fewer instructions are inlined even when called
 * from multiple sites. The threshold balances code size growth against call
 * overhead elimination. On the 6502, 20 IL instructions typically translates
 * to ~30-60 bytes of machine code, so the duplication cost is modest.
 */
export const SMALL_FUNCTION_THRESHOLD = 20;

/**
 * Maximum allowed code growth ratio for multi-site inlining (20%).
 *
 * When inlining a function at multiple call sites, the code is duplicated.
 * This limit prevents excessive bloat by capping total growth at 20% of the
 * original program size. Single-call-site inlining is exempt since it has
 * zero net code growth (the callee is removed by dead function elimination).
 */
export const MAX_SIZE_GROWTH_RATIO = 0.20;

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a candidate for function inlining.
 *
 * Contains all information needed to perform the inline transformation:
 * the callee function, the caller function, and the index of the CALL
 * instruction within the caller's instruction array.
 */
export interface InlineCandidate {
  /** The function to be inlined (callee) */
  readonly callee: ILFunction;

  /** The function containing the call site (caller) */
  readonly caller: ILFunction;

  /** Index of the CALL instruction in caller.instructions */
  readonly callSiteIndex: number;

  /**
   * Strategy that selected this candidate.
   *
   * - 'single-site': Function called exactly once (O1+, always profitable)
   * - 'small-function': Small function inlined at multiple sites (O2+, budget-limited)
   */
  readonly strategy: 'single-site' | 'small-function';
}

// ============================================================================
// Function Inlining Pass
// ============================================================================

/**
 * Inlines function bodies at call sites to eliminate call overhead.
 *
 * On the 6502, every JSR costs 6 cycles and 3 bytes, and every RTS
 * costs 6 cycles and 1 byte. For single-call-site functions, inlining
 * is always profitable — it saves 12 cycles and 4 bytes while removing
 * no code duplication.
 *
 * The pass processes candidates bottom-up (leaf functions first) to
 * ensure that if A calls B calls C, C is inlined into B before B is
 * inlined into A. This produces optimal results.
 *
 * @example
 * ```typescript
 * const pass = new FunctionInliningPass();
 * const result = pass.run(program, { level: 'O1' });
 * if (result.modified) {
 *   console.log(`Inlined ${result.functionsModified} functions`);
 * }
 * ```
 */
export class FunctionInliningPass implements ProgramOptimizationPass {
  /**
   * Unique pass name.
   *
   * Must match the name used in PROGRAM_LEVEL_PASSES config ('function-inline').
   */
  readonly name = 'function-inline';

  /**
   * This pass depends on dead-function-elim running first.
   *
   * Dead function elimination removes unreachable functions before
   * inlining, so we don't waste time inlining dead code.
   */
  readonly dependencies = ['dead-function-elim'];

  /**
   * Counter used to generate unique label/slot prefixes across
   * multiple inlining operations within the same pass run.
   * Reset at the start of each run().
   */
  protected inlineCounter = 0;

  /**
   * Run function inlining on the entire program.
   *
   * Builds a call graph, identifies inlining candidates based on the
   * optimization level, and performs inlining transformations. Candidates
   * are processed bottom-up (leaf functions first) to ensure correct
   * multi-level inlining.
   *
   * @param program - The IL program to optimize (modified in place)
   * @param options - Optimization options (level determines strategy)
   * @returns Result indicating how many functions were modified
   */
  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult {
    // Reset inline counter for this run
    this.inlineCounter = 0;

    // Nothing to inline if there are 0 or 1 functions
    if (program.functions.length <= 1) {
      return createEmptyProgramResult();
    }

    // Step 1: Build call graph
    const callGraph = CallGraph.build(program);

    // Step 2: Find inlining candidates based on optimization level
    const candidates = this.findCandidates(program, callGraph, options);

    // Nothing to inline
    if (candidates.length === 0) {
      return createEmptyProgramResult();
    }

    // Step 3: Sort candidates bottom-up (leaf functions first)
    // This ensures correct multi-level inlining
    const sorted = this.sortBottomUp(candidates, callGraph);

    // Step 4: Calculate size budget for multi-site inlining
    // Single-site inlining is exempt (zero net growth after DFE removes callee).
    // Small-function (multi-site) inlining duplicates code, so we cap total
    // growth at MAX_SIZE_GROWTH_RATIO of the original program size.
    const originalSize = this.calculateProgramSize(program);
    // Use a floor of SMALL_FUNCTION_THRESHOLD so that even small programs
    // can inline at least one small function fully. Without this floor,
    // a tiny program's 20% budget might be too small to inline anything.
    const maxGrowth = Math.max(
      Math.floor(originalSize * MAX_SIZE_GROWTH_RATIO),
      SMALL_FUNCTION_THRESHOLD
    );
    let cumulativeGrowth = 0;

    // Step 5: Perform inlining for each candidate
    let functionsModified = 0;
    const debugInfo: string[] = [];

    for (const candidate of sorted) {
      // For multi-site candidates, enforce the size budget before inlining.
      // Each inline replaces 1 CALL with N instructions → net growth = N - 1.
      if (candidate.strategy === 'small-function') {
        const netGrowth = candidate.callee.instructions.length - 1;
        if (cumulativeGrowth + netGrowth > maxGrowth) {
          if (options.debug) {
            debugInfo.push(
              `Skipped inlining '${candidate.callee.name}' into '${candidate.caller.name}' — ` +
                `size budget exceeded (growth: ${cumulativeGrowth + netGrowth}, max: ${maxGrowth})`
            );
          }
          continue;
        }
      }

      // Re-find call site index for multi-site candidates because prior
      // inlining in the same caller shifts instruction indices. For single-site
      // candidates the stored index is still valid (each callee has exactly
      // one caller), but re-finding is harmless and keeps the logic uniform.
      const freshIndex = this.findCallSiteIndex(candidate.caller, candidate.callee.name);
      if (freshIndex === -1) continue;

      // Create a fresh candidate with the up-to-date call site index
      const freshCandidate: InlineCandidate = { ...candidate, callSiteIndex: freshIndex };
      const success = this.inlineFunction(program, freshCandidate);

      if (success) {
        functionsModified++;

        // Track size growth for multi-site candidates
        if (candidate.strategy === 'small-function') {
          cumulativeGrowth += candidate.callee.instructions.length - 1;
        }

        if (options.debug) {
          debugInfo.push(
            `Inlined '${candidate.callee.name}' into '${candidate.caller.name}' ` +
              `at instruction index ${freshIndex} (${candidate.strategy})`
          );
        }
      }
    }

    // No modifications made
    if (functionsModified === 0) {
      return createEmptyProgramResult();
    }

    // Return result (dead function elim will clean up fully-inlined functions)
    return createProgramResult(
      0, // functionsRemoved — dead-function-elim handles this
      functionsModified,
      options.debug ? debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Candidate Selection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find functions that are candidates for inlining.
   *
   * At O1: only single-call-site functions (called exactly once).
   * At O2+: also small functions below a size threshold (Session 2.4).
   *
   * Candidates are filtered by safety checks:
   * - Not recursive (direct or mutual)
   * - Not exported (must remain callable from outside)
   * - Not a callback (invoked by hardware/runtime)
   * - Not the entry point
   * - Has at least one instruction (not empty)
   *
   * @param program - The IL program
   * @param callGraph - Pre-built call graph
   * @param options - Optimization options (level determines strategy)
   * @returns Array of inlining candidates
   */
  protected findCandidates(
    program: ILProgram,
    callGraph: CallGraph,
    options: OptimizationOptions
  ): InlineCandidate[] {
    const candidates: InlineCandidate[] = [];

    // Build a lookup map for quick function access by name
    const funcMap = new Map<string, ILFunction>();
    for (const func of program.functions) {
      funcMap.set(func.name, func);
    }

    // Determine if O2+ small-function inlining is allowed
    // Only O2 and O3 enable multi-site inlining. Os/Oz optimize for size
    // and avoid code duplication entirely.
    const allowSmallFunctionInlining =
      options.level === 'O2' || options.level === 'O3';

    for (const func of program.functions) {
      // Skip safety checks: entry point, exported, callback
      if (func.name === program.entryPoint) continue;
      if (func.isExported) continue;
      if (func.isCallback) continue;

      // Skip empty functions (nothing to inline)
      if (func.instructions.length === 0) continue;

      // Skip recursive functions (direct self-recursion)
      if (callGraph.isRecursive(func.name)) continue;

      // Get call count for this function
      const callCount = callGraph.getCallCount(func.name);

      // Strategy 1: Single-call-site inlining (O1+)
      // Functions called exactly once are always profitable to inline
      if (callCount === 1) {
        const callers = callGraph.getCallers(func.name);
        const callerName = [...callers][0];
        const caller = funcMap.get(callerName);

        if (caller) {
          // Skip if caller and callee are mutually recursive
          if (callGraph.isMutuallyRecursive(callerName, func.name)) continue;

          // Find the CALL instruction index in the caller
          const callSiteIndex = this.findCallSiteIndex(caller, func.name);
          if (callSiteIndex !== -1) {
            candidates.push({
              callee: func,
              caller,
              callSiteIndex,
              strategy: 'single-site',
            });
          }
        }
        continue; // Already handled — skip to next function
      }

      // Strategy 2: Small-function inlining (O2+)
      // Functions below the size threshold are inlined at every call site,
      // even when called multiple times. A size budget in run() prevents
      // excessive code growth.
      if (
        allowSmallFunctionInlining &&
        callCount > 1 &&
        func.instructions.length <= SMALL_FUNCTION_THRESHOLD
      ) {
        const callers = callGraph.getCallers(func.name);
        for (const callerName of callers) {
          const caller = funcMap.get(callerName);
          if (!caller) continue;

          // Skip if caller and callee are mutually recursive
          if (callGraph.isMutuallyRecursive(callerName, func.name)) continue;

          // Find ALL call sites for this callee in this caller
          // (a caller may invoke the same function multiple times)
          const callSiteIndices = this.findAllCallSiteIndices(caller, func.name);
          for (const idx of callSiteIndices) {
            candidates.push({
              callee: func,
              caller,
              callSiteIndex: idx,
              strategy: 'small-function',
            });
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Find the index of the first CALL instruction targeting the given function.
   *
   * Scans the caller's instructions for a CALL opcode with a FunctionOperand
   * matching the target function name.
   *
   * @param caller - The calling function to search in
   * @param targetName - The name of the function being called
   * @returns Index of the CALL instruction, or -1 if not found
   */
  protected findCallSiteIndex(caller: ILFunction, targetName: string): number {
    for (let i = 0; i < caller.instructions.length; i++) {
      const instr = caller.instructions[i];
      if (instr.opcode === ILOpcode.CALL && instr.operands.length > 0) {
        const operand = instr.operands[0];
        if (operand.kind === 'function' && (operand as FunctionOperand).name === targetName) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Find ALL CALL instruction indices targeting the given function.
   *
   * Unlike findCallSiteIndex which returns only the first match, this
   * returns every CALL to the target. Used for multi-site inlining at
   * O2+ where a function may be called multiple times from the same caller.
   *
   * @param caller - The calling function to search in
   * @param targetName - The name of the function being called
   * @returns Array of CALL instruction indices (may be empty)
   */
  protected findAllCallSiteIndices(caller: ILFunction, targetName: string): number[] {
    const indices: number[] = [];
    for (let i = 0; i < caller.instructions.length; i++) {
      const instr = caller.instructions[i];
      if (instr.opcode === ILOpcode.CALL && instr.operands.length > 0) {
        const operand = instr.operands[0];
        if (operand.kind === 'function' && (operand as FunctionOperand).name === targetName) {
          indices.push(i);
        }
      }
    }
    return indices;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Instruction Cloning
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Clone a callee's instructions with remapped labels and local slots.
   *
   * To avoid name collisions when inlining, labels and LOCAL slot references
   * in the cloned instructions are prefixed with a unique identifier based
   * on the callee name and an incrementing counter.
   *
   * **CRITICAL**: Parameter slots are NOT remapped. The caller stores
   * arguments to parameter slots before the CALL instruction. When the
   * CALL is replaced by the inlined body, the body must read from the
   * SAME parameter slots that the caller wrote to. Remapping parameter
   * slots would break this def-use chain, causing DCE to remove the
   * caller's argument stores as "dead" and the inlined body to read
   * from never-written remapped slots — producing ghost instructions
   * or missing code.
   *
   * The prefix format is: `_inline_{calleeName}_{counter}_`
   *
   * @param callee - The function being inlined
   * @returns Array of cloned instructions with unique label/slot names
   */
  protected cloneInstructions(callee: ILFunction): ILInstruction[] {
    const prefix = `_inline_${callee.name}_${this.inlineCounter}_`;
    this.inlineCounter++;

    // First, collect all labels defined in the callee so we know which to remap
    const calleeLabels = new Set<string>();
    for (const instr of callee.instructions) {
      if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
        const labelOp = instr.operands[0] as LabelOperand;
        calleeLabels.add(labelOp.name);
      }
    }

    // Collect parameter slot names from the callee's frame.
    // Parameter slots must NOT be remapped because the caller stores
    // arguments to these exact slot names before the CALL instruction.
    // When inlined, the body must read from the same slots the caller wrote to.
    const paramSlotNames = new Set<string>();
    for (const slot of callee.frame.slots) {
      if (slot.kind === SlotKind.Parameter) {
        paramSlotNames.add(slot.name);
      }
    }

    // Clone each instruction with remapped operands (excluding param slots)
    const cloned: ILInstruction[] = [];
    for (const instr of callee.instructions) {
      cloned.push(this.cloneInstruction(instr, prefix, calleeLabels, paramSlotNames));
    }

    return cloned;
  }

  /**
   * Clone a single instruction with remapped labels and local slots.
   *
   * Creates a deep copy of the instruction with:
   * - Label operands prefixed (if they reference callee-local labels)
   * - LOCAL slot operands prefixed (to avoid name collisions with caller slots)
   * - Parameter slot operands left unchanged (to preserve caller arg-store chain)
   * - All other operands copied as-is
   *
   * @param instr - The instruction to clone
   * @param prefix - Unique prefix for label/slot names
   * @param calleeLabels - Set of label names defined within the callee
   * @param paramSlotNames - Set of parameter slot names that must NOT be remapped
   * @returns Cloned instruction with remapped names
   */
  protected cloneInstruction(
    instr: ILInstruction,
    prefix: string,
    calleeLabels: Set<string>,
    paramSlotNames: Set<string>
  ): ILInstruction {
    // Remap operands
    const remappedOperands = instr.operands.map((op) => {
      // Remap label operands that reference callee-local labels
      if (op.kind === 'label') {
        const labelOp = op as LabelOperand;
        if (calleeLabels.has(labelOp.name)) {
          return { ...labelOp, name: prefix + labelOp.name };
        }
        return op;
      }

      // Remap LOCAL slot operands to avoid name collisions with caller.
      // Parameter slots are NOT remapped — the caller stores arguments
      // to these exact slot names before the CALL, and the inlined body
      // must read from the same slots to preserve the def-use chain.
      if (op.kind === 'slot') {
        const slotOp = op as SlotOperand;

        // Skip remapping for parameter slots — they are the caller/callee interface
        if (paramSlotNames.has(slotOp.slot.name)) {
          return op;
        }

        const remappedSlot = {
          ...slotOp.slot,
          name: prefix + slotOp.slot.name,
        };
        const result: SlotOperand = {
          ...slotOp,
          slot: remappedSlot,
        };
        // Also remap indexSlot if present (and not a parameter)
        if (slotOp.indexSlot && !paramSlotNames.has(slotOp.indexSlot.name)) {
          (result as { indexSlot: typeof slotOp.indexSlot }).indexSlot = {
            ...slotOp.indexSlot,
            name: prefix + slotOp.indexSlot.name,
          };
        }
        return result;
      }

      // All other operand types (immediate, function, address, asm_raw)
      // are value-based and don't need remapping
      return op;
    });

    // Remap defUse slot names (skip parameter slots to keep def-use chain intact)
    const remappedDefUse = instr.defUse
      ? {
          defs: instr.defUse.defs.map((d) => (paramSlotNames.has(d) ? d : prefix + d)),
          uses: instr.defUse.uses.map((u) => (paramSlotNames.has(u) ? u : prefix + u)),
        }
      : undefined;

    return {
      opcode: instr.opcode,
      operands: remappedOperands,
      location: instr.location,
      comment: instr.comment
        ? `[inlined from ${prefix.replace(/_inline_/, '').replace(/_\d+_$/, '')}] ${instr.comment}`
        : undefined,
      cost: instr.cost,
      defUse: remappedDefUse,
      hints: instr.hints,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Inlining Transformation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Perform the actual inlining transformation.
   *
   * Replaces the CALL instruction in the caller with the cloned body of
   * the callee. RETURN instructions in the callee are replaced with
   * JUMP to a continuation label placed after the inlined body.
   *
   * **Transformation:**
   * ```
   * Before:                    After:
   *   ...                        ...
   *   CALL callee                LABEL _inline_callee_0_entry
   *   ...                        [callee body with remapped labels/slots]
   *                               JUMP _inline_callee_0_cont  (was RETURN)
   *                               LABEL _inline_callee_0_cont
   *                               ...
   * ```
   *
   * @param program - The IL program (for context, not modified directly)
   * @param candidate - The inlining candidate with caller, callee, and call site
   * @returns true if inlining was successful, false if skipped
   */
  protected inlineFunction(
    _program: ILProgram,
    candidate: InlineCandidate
  ): boolean {
    const { caller, callee, callSiteIndex } = candidate;

    // Validate the call site still exists and targets the expected callee
    // (it may have been modified by a previous inlining in the same run)
    if (callSiteIndex >= caller.instructions.length) return false;
    const callInstr = caller.instructions[callSiteIndex];
    if (callInstr.opcode !== ILOpcode.CALL) return false;
    if (callInstr.operands.length === 0) return false;
    const funcOp = callInstr.operands[0];
    if (funcOp.kind !== 'function') return false;
    if ((funcOp as FunctionOperand).name !== callee.name) return false;

    // Clone callee instructions with remapped labels/slots
    const clonedBody = this.cloneInstructions(callee);

    // Create continuation label (placed after the inlined body)
    const contLabel = `_inline_${callee.name}_${this.inlineCounter - 1}_cont`;
    const contLabelInstr: ILInstruction = {
      opcode: ILOpcode.LABEL,
      operands: [{ kind: 'label', name: contLabel }],
      defUse: { defs: [], uses: [] },
    };

    // Replace RETURN instructions with JUMP to continuation label
    const processedBody = this.replaceReturnsWithJump(clonedBody, contLabel);

    // Optimization: If the last instruction is a JUMP to contLabel, remove it.
    // Since the continuation label immediately follows the inlined body,
    // a trailing JMP to it is a JMP-to-next-instruction (wasted 3 bytes + 3 cycles).
    // This only applies to the FINAL return — non-final returns in multi-return
    // functions still need their JMPs to skip remaining inlined code.
    if (processedBody.length > 0) {
      const lastInstr = processedBody[processedBody.length - 1];
      if (
        lastInstr.opcode === ILOpcode.JUMP &&
        lastInstr.operands.length > 0 &&
        lastInstr.operands[0].kind === 'label' &&
        (lastInstr.operands[0] as LabelOperand).name === contLabel
      ) {
        processedBody.pop();
      }
    }

    // Build the replacement sequence:
    // [cloned body with RETURNs→JUMPs] + [continuation LABEL]
    const replacement = [...processedBody, contLabelInstr];

    // Replace the CALL instruction with the inlined body
    caller.instructions.splice(callSiteIndex, 1, ...replacement);

    return true;
  }

  /**
   * Replace all RETURN instructions with JUMP to a continuation label.
   *
   * When inlining, the callee's RETURN cannot actually return from the
   * caller — instead it must jump to the point after the inlined body.
   *
   * @param instructions - The cloned callee instructions
   * @param contLabel - Name of the continuation label to jump to
   * @returns Instructions with RETURNs replaced by JUMPs
   */
  protected replaceReturnsWithJump(
    instructions: ILInstruction[],
    contLabel: string
  ): ILInstruction[] {
    return instructions.map((instr) => {
      if (instr.opcode === ILOpcode.RETURN) {
        // Replace RETURN with JUMP to continuation
        return {
          opcode: ILOpcode.JUMP,
          operands: [{ kind: 'label' as const, name: contLabel }],
          defUse: { defs: [], uses: [] },
          comment: instr.comment
            ? `[inlined return] ${instr.comment}`
            : '[inlined return → jump to continuation]',
        };
      }
      return instr;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Size Calculation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate the total instruction count across all functions.
   *
   * Used to compute the size budget for multi-site inlining. The budget
   * is a percentage of this value (MAX_SIZE_GROWTH_RATIO).
   *
   * @param program - The IL program
   * @returns Total number of instructions across all functions
   */
  protected calculateProgramSize(program: ILProgram): number {
    let total = 0;
    for (const func of program.functions) {
      total += func.instructions.length;
    }
    return total;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Ordering
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Sort candidates bottom-up so leaf functions are inlined first.
   *
   * If A calls B and B calls C, we want to inline C into B first,
   * then inline B (now containing C's body) into A. This produces
   * optimal results.
   *
   * Functions with no outgoing calls (leaf functions) are processed first.
   * Functions higher in the call chain are processed later.
   *
   * @param candidates - Array of inlining candidates
   * @param callGraph - Call graph for dependency analysis
   * @returns Sorted candidates (leaf functions first)
   */
  protected sortBottomUp(
    candidates: InlineCandidate[],
    callGraph: CallGraph
  ): InlineCandidate[] {
    // Sort by number of callees (ascending) — leaf functions first
    // Leaf functions have 0 outgoing calls, so they sort first
    return [...candidates].sort((a, b) => {
      const aCallees = callGraph.getCallees(a.callee.name).size;
      const bCallees = callGraph.getCallees(b.callee.name).size;
      return aCallees - bCallees;
    });
  }
}

/**
 * Intrinsic Lowering Pass - transforms INTRINSIC_PEEK/POKE to HARDWARE_READ/WRITE
 *
 * This optimization pass transforms peek/poke intrinsic instructions when
 * the address operand is a known constant. This enables the code generator
 * to emit efficient direct memory access instructions instead of indirect
 * addressing through a register.
 *
 * Transformations performed:
 * - INTRINSIC_PEEK with constant address → HARDWARE_READ
 * - INTRINSIC_POKE with constant address → HARDWARE_WRITE
 * - INTRINSIC_PEEKW with constant address → Two HARDWARE_READ instructions
 * - INTRINSIC_POKEW with constant address → Two HARDWARE_WRITE instructions
 *
 * After lowering, a simple dead code elimination removes the now-unused
 * CONST instructions that previously held the addresses.
 *
 * @module optimizer/intrinsic-lowering-pass
 */

import type { ILModule } from '../il/module.js';
import type { ILFunction } from '../il/function.js';
import type { BasicBlock } from '../il/basic-block.js';
import {
  ILOpcode,
  ILPeekInstruction,
  ILPokeInstruction,
  ILPeekwInstruction,
  ILPokewInstruction,
  ILHardwareReadInstruction,
  ILHardwareWriteInstruction,
  ILBinaryInstruction,
  ILConstInstruction,
} from '../il/instructions.js';
import { IL_BYTE, IL_WORD } from '../il/types.js';
import { ConstantTracker, type ConstantTrackingResult } from './constant-tracker.js';

/**
 * Statistics about transformations performed by the pass.
 */
export interface IntrinsicLoweringStats {
  /** Number of INTRINSIC_PEEK transformed to HARDWARE_READ */
  peekToHardwareRead: number;

  /** Number of INTRINSIC_POKE transformed to HARDWARE_WRITE */
  pokeToHardwareWrite: number;

  /** Number of INTRINSIC_PEEKW expanded (2 HARDWARE_READ each) */
  peekwExpanded: number;

  /** Number of INTRINSIC_POKEW expanded (2 HARDWARE_WRITE each) */
  pokewExpanded: number;

  /** Number of peek/poke left unchanged (non-constant address) */
  leftUnchanged: number;

  /** Number of dead CONST instructions removed */
  deadConstRemoved: number;

  /** Total number of functions processed */
  functionsProcessed: number;
}

/**
 * Result of the intrinsic lowering pass.
 */
export interface IntrinsicLoweringResult {
  /** The transformed module */
  module: ILModule;

  /** Whether any transformations were made */
  modified: boolean;

  /** Statistics about transformations */
  stats: IntrinsicLoweringStats;

  /** Any warnings generated during transformation */
  warnings: string[];
}

/**
 * Intrinsic Lowering Pass
 *
 * This pass transforms peek/poke intrinsic instructions to hardware
 * read/write instructions when the address is a known constant.
 *
 * The pass works in two phases:
 * 1. Transform intrinsics with constant addresses
 * 2. Remove dead CONST instructions that are no longer used
 *
 * @example
 * ```typescript
 * // Before:
 * // v0 = CONST $D020
 * // v1 = CONST 5
 * // INTRINSIC_POKE v0, v1
 *
 * // After:
 * // v1 = CONST 5
 * // HARDWARE_WRITE $D020, v1
 * ```
 */
export class IntrinsicLoweringPass {
  /** Constant tracker for analyzing registers */
  protected readonly constantTracker: ConstantTracker;

  /** Whether to output verbose logging */
  protected readonly verbose: boolean;

  /**
   * Creates a new intrinsic lowering pass.
   *
   * @param verbose - Whether to output verbose logging
   */
  constructor(verbose: boolean = false) {
    this.constantTracker = new ConstantTracker();
    this.verbose = verbose;
  }

  /**
   * Runs the intrinsic lowering pass on a module.
   *
   * @param module - The IL module to transform
   * @returns The transformation result
   */
  run(module: ILModule): IntrinsicLoweringResult {
    const stats: IntrinsicLoweringStats = {
      peekToHardwareRead: 0,
      pokeToHardwareWrite: 0,
      peekwExpanded: 0,
      pokewExpanded: 0,
      leftUnchanged: 0,
      deadConstRemoved: 0,
      functionsProcessed: 0,
    };

    const warnings: string[] = [];
    let modified = false;

    if (this.verbose) {
      console.log(`[IntrinsicLoweringPass] Processing module '${module.name}'`);
    }

    // Process each function
    for (const func of module.getFunctions()) {
      const funcModified = this.processFunction(func, stats, warnings);
      if (funcModified) {
        modified = true;
      }
      stats.functionsProcessed++;
    }

    if (this.verbose) {
      console.log('[IntrinsicLoweringPass] Stats:', stats);
    }

    return {
      module,
      modified,
      stats,
      warnings,
    };
  }

  /**
   * Processes a single function.
   *
   * @param func - The function to process
   * @param stats - Statistics to update
   * @param warnings - Warnings array to append to
   * @returns Whether the function was modified
   */
  protected processFunction(
    func: ILFunction,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    if (this.verbose) {
      console.log(`[IntrinsicLoweringPass] Processing function '${func.name}'`);
    }

    // Phase 1: Analyze constants
    const constantResult = this.constantTracker.analyze(func);

    // Phase 2: Transform intrinsics
    let modified = this.transformIntrinsics(func, constantResult, stats, warnings);

    // Phase 3: Remove dead constants
    // We need to re-analyze after transformations since some CONSTs may now be unused
    const postTransformResult = this.constantTracker.analyze(func);
    const deadRemoved = this.removeDeadConstants(func, postTransformResult, stats);
    if (deadRemoved) {
      modified = true;
    }

    return modified;
  }

  /**
   * Transforms intrinsic instructions in a function.
   *
   * @param func - The function to transform
   * @param constantResult - Constant tracking analysis result
   * @param stats - Statistics to update
   * @param warnings - Warnings array to append to
   * @returns Whether any transformations were made
   */
  protected transformIntrinsics(
    func: ILFunction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    let modified = false;

    for (const block of func.getBlocks()) {
      const blockModified = this.transformBlockIntrinsics(
        func,
        block,
        constantResult,
        stats,
        warnings,
      );
      if (blockModified) {
        modified = true;
      }
    }

    return modified;
  }

  /**
   * Transforms intrinsic instructions in a basic block.
   *
   * @param func - The function containing the block
   * @param block - The block to transform
   * @param constantResult - Constant tracking analysis result
   * @param stats - Statistics to update
   * @param warnings - Warnings array to append to
   * @returns Whether any transformations were made
   */
  protected transformBlockIntrinsics(
    func: ILFunction,
    block: BasicBlock,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    let modified = false;
    const instructions = block.getInstructions();

    // We need to iterate with indices and handle insertions carefully
    // Process in reverse to avoid index shifting issues when we insert
    // multiple instructions (for peekw/pokew)
    for (let i = instructions.length - 1; i >= 0; i--) {
      const instr = instructions[i];

      switch (instr.opcode) {
        case ILOpcode.INTRINSIC_PEEK: {
          const transformed = this.transformPeek(
            func,
            block,
            i,
            instr as ILPeekInstruction,
            constantResult,
            stats,
            warnings,
          );
          if (transformed) modified = true;
          break;
        }

        case ILOpcode.INTRINSIC_POKE: {
          const transformed = this.transformPoke(
            func,
            block,
            i,
            instr as ILPokeInstruction,
            constantResult,
            stats,
            warnings,
          );
          if (transformed) modified = true;
          break;
        }

        case ILOpcode.INTRINSIC_PEEKW: {
          const transformed = this.transformPeekw(
            func,
            block,
            i,
            instr as ILPeekwInstruction,
            constantResult,
            stats,
            warnings,
          );
          if (transformed) modified = true;
          break;
        }

        case ILOpcode.INTRINSIC_POKEW: {
          const transformed = this.transformPokew(
            func,
            block,
            i,
            instr as ILPokewInstruction,
            constantResult,
            stats,
            warnings,
          );
          if (transformed) modified = true;
          break;
        }
      }
    }

    return modified;
  }

  /**
   * Transforms an INTRINSIC_PEEK instruction to HARDWARE_READ.
   *
   * @param func - The function containing the instruction
   * @param block - The block containing the instruction
   * @param index - Index of the instruction in the block
   * @param instr - The peek instruction
   * @param constantResult - Constant tracking result
   * @param stats - Statistics to update
   * @param warnings - Warnings to append to
   * @returns Whether the transformation was made
   */
  protected transformPeek(
    _func: ILFunction,
    block: BasicBlock,
    index: number,
    instr: ILPeekInstruction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    const addressConstant = constantResult.getConstant(instr.address);

    if (!addressConstant) {
      stats.leftUnchanged++;
      if (this.verbose) {
        console.log(
          `[IntrinsicLoweringPass] PEEK at index ${index}: address not constant, leaving unchanged`,
        );
      }
      return false;
    }

    // Validate address is in valid 16-bit range
    if (addressConstant.value < 0 || addressConstant.value > 0xffff) {
      warnings.push(
        `PEEK address out of range: ${addressConstant.value} at instruction ${instr.id}`,
      );
      stats.leftUnchanged++;
      return false;
    }

    // Create HARDWARE_READ instruction
    const hardwareRead = new ILHardwareReadInstruction(
      instr.id,
      addressConstant.value,
      instr.result!,
      instr.metadata,
    );

    // Replace the instruction
    block.replaceInstruction(index, hardwareRead);
    stats.peekToHardwareRead++;

    if (this.verbose) {
      console.log(
        `[IntrinsicLoweringPass] Transformed PEEK to HARDWARE_READ $${addressConstant.value.toString(16).toUpperCase()}`,
      );
    }

    return true;
  }

  /**
   * Transforms an INTRINSIC_POKE instruction to HARDWARE_WRITE.
   *
   * @param func - The function containing the instruction
   * @param block - The block containing the instruction
   * @param index - Index of the instruction in the block
   * @param instr - The poke instruction
   * @param constantResult - Constant tracking result
   * @param stats - Statistics to update
   * @param warnings - Warnings to append to
   * @returns Whether the transformation was made
   */
  protected transformPoke(
    _func: ILFunction,
    block: BasicBlock,
    index: number,
    instr: ILPokeInstruction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    const addressConstant = constantResult.getConstant(instr.address);

    if (!addressConstant) {
      stats.leftUnchanged++;
      if (this.verbose) {
        console.log(
          `[IntrinsicLoweringPass] POKE at index ${index}: address not constant, leaving unchanged`,
        );
      }
      return false;
    }

    // Validate address is in valid 16-bit range
    if (addressConstant.value < 0 || addressConstant.value > 0xffff) {
      warnings.push(
        `POKE address out of range: ${addressConstant.value} at instruction ${instr.id}`,
      );
      stats.leftUnchanged++;
      return false;
    }

    // Create HARDWARE_WRITE instruction
    const hardwareWrite = new ILHardwareWriteInstruction(
      instr.id,
      addressConstant.value,
      instr.value,
      instr.metadata,
    );

    // Replace the instruction
    block.replaceInstruction(index, hardwareWrite);
    stats.pokeToHardwareWrite++;

    if (this.verbose) {
      console.log(
        `[IntrinsicLoweringPass] Transformed POKE to HARDWARE_WRITE $${addressConstant.value.toString(16).toUpperCase()}`,
      );
    }

    return true;
  }

  /**
   * Transforms an INTRINSIC_PEEKW instruction to two HARDWARE_READ instructions.
   *
   * PEEKW reads a 16-bit word in little-endian order:
   * - Low byte from address
   * - High byte from address+1
   *
   * @param func - The function containing the instruction
   * @param block - The block containing the instruction
   * @param index - Index of the instruction in the block
   * @param instr - The peekw instruction
   * @param constantResult - Constant tracking result
   * @param stats - Statistics to update
   * @param warnings - Warnings to append to
   * @returns Whether the transformation was made
   */
  protected transformPeekw(
    func: ILFunction,
    block: BasicBlock,
    index: number,
    instr: ILPeekwInstruction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    const addressConstant = constantResult.getConstant(instr.address);

    if (!addressConstant) {
      stats.leftUnchanged++;
      if (this.verbose) {
        console.log(
          `[IntrinsicLoweringPass] PEEKW at index ${index}: address not constant, leaving unchanged`,
        );
      }
      return false;
    }

    // Validate address is in valid 16-bit range (need room for +1)
    if (addressConstant.value < 0 || addressConstant.value > 0xfffe) {
      warnings.push(
        `PEEKW address out of range: ${addressConstant.value} at instruction ${instr.id}`,
      );
      stats.leftUnchanged++;
      return false;
    }

    const lowAddr = addressConstant.value;
    const highAddr = addressConstant.value + 1;

    // We need to expand PEEKW into:
    // 1. lowReg = HARDWARE_READ lowAddr
    // 2. highReg = HARDWARE_READ highAddr
    // 3. result = (highReg << 8) | lowReg
    //
    // For now, we'll use a simpler approach that the code generator
    // can understand: keep PEEKW but mark it as "lowered" with constant address.
    //
    // Actually, let's create the proper expansion:

    // Get the next available instruction ID
    const baseId = func.getNextInstructionId();

    // Create temporary registers for low and high bytes
    const lowReg = func.createRegister(IL_BYTE, `peekw_low_${instr.id}`);
    const highReg = func.createRegister(IL_BYTE, `peekw_high_${instr.id}`);

    // Create instructions
    const readLow = new ILHardwareReadInstruction(baseId, lowAddr, lowReg, instr.metadata);

    const readHigh = new ILHardwareReadInstruction(baseId + 1, highAddr, highReg, instr.metadata);

    // For a cleaner implementation, let's create:
    // readLow, readHigh, then combine them
    // The combination: result = (highReg * 256) + lowReg
    // Or: result = lowReg + (highReg << 8)

    // Let's use a simpler approach: emit 256 as constant, multiply, add
    const const256Reg = func.createRegister(IL_WORD, `peekw_256_${instr.id}`);
    const const256 = new ILConstInstruction(baseId + 2, 256, IL_WORD, const256Reg);

    const mulReg = func.createRegister(IL_WORD, `peekw_mul_${instr.id}`);
    const mulHigh = new ILBinaryInstruction(
      baseId + 3,
      ILOpcode.MUL,
      highReg,
      const256Reg,
      mulReg,
    );

    const addResult = new ILBinaryInstruction(
      baseId + 4,
      ILOpcode.ADD,
      lowReg,
      mulReg,
      instr.result!,
    );

    // Remove the original instruction and insert the new ones
    block.removeInstruction(index);

    // Insert in reverse order since we removed at index
    block.insertInstruction(index, addResult);
    block.insertInstruction(index, mulHigh);
    block.insertInstruction(index, const256);
    block.insertInstruction(index, readHigh);
    block.insertInstruction(index, readLow);

    stats.peekwExpanded++;

    if (this.verbose) {
      console.log(
        `[IntrinsicLoweringPass] Expanded PEEKW to two HARDWARE_READs at $${lowAddr.toString(16).toUpperCase()}, $${highAddr.toString(16).toUpperCase()}`,
      );
    }

    return true;
  }

  /**
   * Transforms an INTRINSIC_POKEW instruction to two HARDWARE_WRITE instructions.
   *
   * POKEW writes a 16-bit word in little-endian order:
   * - Low byte to address
   * - High byte to address+1
   *
   * @param func - The function containing the instruction
   * @param block - The block containing the instruction
   * @param index - Index of the instruction in the block
   * @param instr - The pokew instruction
   * @param constantResult - Constant tracking result
   * @param stats - Statistics to update
   * @param warnings - Warnings to append to
   * @returns Whether the transformation was made
   */
  protected transformPokew(
    func: ILFunction,
    block: BasicBlock,
    index: number,
    instr: ILPokewInstruction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
    warnings: string[],
  ): boolean {
    const addressConstant = constantResult.getConstant(instr.address);

    if (!addressConstant) {
      stats.leftUnchanged++;
      if (this.verbose) {
        console.log(
          `[IntrinsicLoweringPass] POKEW at index ${index}: address not constant, leaving unchanged`,
        );
      }
      return false;
    }

    // Validate address is in valid 16-bit range (need room for +1)
    if (addressConstant.value < 0 || addressConstant.value > 0xfffe) {
      warnings.push(
        `POKEW address out of range: ${addressConstant.value} at instruction ${instr.id}`,
      );
      stats.leftUnchanged++;
      return false;
    }

    const lowAddr = addressConstant.value;
    const highAddr = addressConstant.value + 1;

    // Expand POKEW into:
    // 1. lowReg = value & 0xFF (or INTRINSIC_LO)
    // 2. highReg = value >> 8 (or INTRINSIC_HI)
    // 3. HARDWARE_WRITE lowAddr, lowReg
    // 4. HARDWARE_WRITE highAddr, highReg

    const baseId = func.getNextInstructionId();

    // Create temp registers for low and high bytes
    const lowReg = func.createRegister(IL_BYTE, `pokew_low_${instr.id}`);
    const highReg = func.createRegister(IL_BYTE, `pokew_high_${instr.id}`);

    // Create mask constants
    const maskReg = func.createRegister(IL_WORD, `pokew_mask_${instr.id}`);
    const constMask = new ILConstInstruction(baseId, 0xff, IL_WORD, maskReg);

    const shiftReg = func.createRegister(IL_BYTE, `pokew_shift_${instr.id}`);
    const constShift = new ILConstInstruction(baseId + 1, 8, IL_BYTE, shiftReg);

    // Extract low byte: lowReg = value & 0xFF
    const andLow = new ILBinaryInstruction(baseId + 2, ILOpcode.AND, instr.value, maskReg, lowReg);

    // Extract high byte: highReg = value >> 8
    const shrHigh = new ILBinaryInstruction(
      baseId + 3,
      ILOpcode.SHR,
      instr.value,
      shiftReg,
      highReg,
    );

    // Write low byte
    const writeLow = new ILHardwareWriteInstruction(baseId + 4, lowAddr, lowReg, instr.metadata);

    // Write high byte
    const writeHigh = new ILHardwareWriteInstruction(baseId + 5, highAddr, highReg, instr.metadata);

    // Remove original and insert new instructions
    block.removeInstruction(index);

    // Insert in reverse order
    block.insertInstruction(index, writeHigh);
    block.insertInstruction(index, writeLow);
    block.insertInstruction(index, shrHigh);
    block.insertInstruction(index, andLow);
    block.insertInstruction(index, constShift);
    block.insertInstruction(index, constMask);

    stats.pokewExpanded++;

    if (this.verbose) {
      console.log(
        `[IntrinsicLoweringPass] Expanded POKEW to two HARDWARE_WRITEs at $${lowAddr.toString(16).toUpperCase()}, $${highAddr.toString(16).toUpperCase()}`,
      );
    }

    return true;
  }

  /**
   * Removes dead CONST instructions that are no longer used.
   *
   * After transforming intrinsics, the CONST instructions that held
   * addresses are often no longer used and can be removed.
   *
   * @param func - The function to process
   * @param constantResult - Constant tracking result
   * @param stats - Statistics to update
   * @returns Whether any instructions were removed
   */
  protected removeDeadConstants(
    func: ILFunction,
    constantResult: ConstantTrackingResult,
    stats: IntrinsicLoweringStats,
  ): boolean {
    let removed = false;
    const usedRegisters = constantResult.getUsedRegisters();

    for (const block of func.getBlocks()) {
      const instructions = block.getInstructions();

      // Process in reverse to avoid index issues when removing
      for (let i = instructions.length - 1; i >= 0; i--) {
        const instr = instructions[i];

        // Only consider CONST instructions
        if (instr.opcode !== ILOpcode.CONST) {
          continue;
        }

        // Check if the result register is used anywhere
        if (instr.result && !usedRegisters.has(instr.result.id)) {
          block.removeInstruction(i);
          stats.deadConstRemoved++;
          removed = true;

          if (this.verbose) {
            console.log(
              `[IntrinsicLoweringPass] Removed dead CONST instruction ${instr.id}`,
            );
          }
        }
      }
    }

    return removed;
  }
}

/**
 * Creates a new IntrinsicLoweringPass instance.
 *
 * @param verbose - Whether to enable verbose logging
 * @returns A new pass instance
 */
export function createIntrinsicLoweringPass(verbose: boolean = false): IntrinsicLoweringPass {
  return new IntrinsicLoweringPass(verbose);
}

/**
 * Convenience function to run the intrinsic lowering pass on a module.
 *
 * @param module - The module to transform
 * @param verbose - Whether to enable verbose logging
 * @returns The transformation result
 */
export function lowerIntrinsics(
  module: ILModule,
  verbose: boolean = false,
): IntrinsicLoweringResult {
  const pass = new IntrinsicLoweringPass(verbose);
  return pass.run(module);
}
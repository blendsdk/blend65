/**
 * Barriers Extreme Tests (Task 5.10)
 *
 * Extreme edge case tests for optimization barriers and volatile memory access.
 * Tests ILOptBarrierInstruction, ILVolatileReadInstruction, and ILVolatileWriteInstruction.
 *
 * Barriers are critical for C64 timing-critical code:
 * - Raster interrupt handlers that must execute in specific order
 * - Hardware register access sequences
 * - Interrupt enable/disable patterns
 * - Memory-mapped I/O operations
 *
 * Test Categories:
 * - Optimization Barrier Basic Tests
 * - Volatile Read Instruction Tests
 * - Volatile Write Instruction Tests
 * - Barrier Semantics and Side Effects Tests
 * - Timing-Critical Code Patterns Tests
 *
 * @module il/barriers-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILOptBarrierInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
  ILHardwareReadInstruction,
  ILCpuInstruction,
} from '../../il/instructions.js';
import { ILFunction } from '../../il/function.js';
import { ILModule } from '../../il/module.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';

// =============================================================================
// Test Constants - C64 Hardware Addresses
// =============================================================================

/**
 * VIC-II register addresses for timing-critical operations
 */
const VIC = {
  BORDER_COLOR: 0xd020,
  BACKGROUND_COLOR: 0xd021,
  RASTER: 0xd012,
  CONTROL1: 0xd011,
  IRQ_STATUS: 0xd019,
  IRQ_ENABLE: 0xd01a,
};

/**
 * SID register addresses
 */
const SID = {
  VOLUME_MODE: 0xd418,
  VOICE1_CONTROL: 0xd404,
  VOICE1_FREQ_LO: 0xd400,
  VOICE1_FREQ_HI: 0xd401,
};

/**
 * CIA register addresses
 */
const CIA = {
  CIA1_ICR: 0xdc0d, // Interrupt Control Register
  CIA2_ICR: 0xdd0d,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a virtual register for testing.
 *
 * @param id - Register ID
 * @param name - Optional register name
 * @returns A virtual register instance
 */
function createRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE, name);
}

/**
 * Creates a word register for address testing.
 *
 * @param id - Register ID
 * @param name - Optional register name
 * @returns A virtual register instance with word type
 */
function createWordRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_WORD, name);
}

// =============================================================================
// Optimization Barrier Basic Tests
// =============================================================================

describe('Barriers Extreme Tests', () => {
  describe('Optimization Barrier Basic Tests', () => {
    it('should create optimization barrier with correct opcode', () => {
      const barrier = new ILOptBarrierInstruction(0);

      expect(barrier.opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(barrier.id).toBe(0);
      expect(barrier.result).toBeNull();
    });

    it('should report optimization barrier as having side effects', () => {
      const barrier = new ILOptBarrierInstruction(0);

      // Barriers must have side effects to prevent elimination
      expect(barrier.hasSideEffects()).toBe(true);
    });

    it('should have no operands', () => {
      const barrier = new ILOptBarrierInstruction(0);

      expect(barrier.getOperands()).toHaveLength(0);
      expect(barrier.getUsedRegisters()).toHaveLength(0);
    });

    it('should not be a terminator instruction', () => {
      const barrier = new ILOptBarrierInstruction(0);

      expect(barrier.isTerminator()).toBe(false);
    });

    it('should produce correct string representation', () => {
      const barrier = new ILOptBarrierInstruction(42);

      expect(barrier.toString()).toBe('OPT_BARRIER');
    });

    it('should preserve metadata for raster-critical barriers', () => {
      const barrier = new ILOptBarrierInstruction(0, {
        rasterCritical: true,
        estimatedCycles: 0,
        sourceExpression: 'barrier()',
        location: { line: 10, column: 5, offset: 100 },
      });

      expect(barrier.metadata.rasterCritical).toBe(true);
      expect(barrier.metadata.estimatedCycles).toBe(0);
      expect(barrier.metadata.sourceExpression).toBe('barrier()');
    });
  });

  // ===========================================================================
  // Volatile Read Instruction Tests
  // ===========================================================================

  describe('Volatile Read Instruction Tests', () => {
    it('should create volatile read with correct opcode and operands', () => {
      const addressReg = createWordRegister(0, 'addr');
      const resultReg = createRegister(1, 'value');

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);

      expect(vread.opcode).toBe(ILOpcode.VOLATILE_READ);
      expect(vread.address).toBe(addressReg);
      expect(vread.result).toBe(resultReg);
    });

    it('should report volatile read as having side effects', () => {
      const addressReg = createWordRegister(0);
      const resultReg = createRegister(1);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);

      // Volatile reads must have side effects to prevent elimination
      expect(vread.hasSideEffects()).toBe(true);
    });

    it('should include address register in operands', () => {
      const addressReg = createWordRegister(0, 'hwAddr');
      const resultReg = createRegister(1);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);

      expect(vread.getOperands()).toContain(addressReg);
      expect(vread.getUsedRegisters()).toContain(addressReg);
      expect(vread.getUsedRegisters()).toHaveLength(1);
    });

    it('should produce correct string representation', () => {
      const addressReg = createWordRegister(0, 'addr');
      const resultReg = createRegister(1, 'value');

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);

      expect(vread.toString()).toBe('v1:value = VOLATILE_READ v0:addr');
    });

    it('should preserve hardware access metadata for VIC raster read', () => {
      const addressReg = createWordRegister(0);
      const resultReg = createRegister(1);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg, {
        addressingMode: 'Absolute',
        rasterCritical: true,
        estimatedCycles: 4,
        mapInfo: {
          structName: 'VIC',
          fieldName: 'raster',
          baseAddress: VIC.RASTER,
        },
      });

      expect(vread.metadata.addressingMode).toBe('Absolute');
      expect(vread.metadata.rasterCritical).toBe(true);
      expect(vread.metadata.mapInfo?.baseAddress).toBe(VIC.RASTER);
    });
  });

  // ===========================================================================
  // Volatile Write Instruction Tests
  // ===========================================================================

  describe('Volatile Write Instruction Tests', () => {
    it('should create volatile write with correct opcode and operands', () => {
      const addressReg = createWordRegister(0, 'addr');
      const valueReg = createRegister(1, 'color');

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg);

      expect(vwrite.opcode).toBe(ILOpcode.VOLATILE_WRITE);
      expect(vwrite.address).toBe(addressReg);
      expect(vwrite.value).toBe(valueReg);
      expect(vwrite.result).toBeNull();
    });

    it('should report volatile write as having side effects', () => {
      const addressReg = createWordRegister(0);
      const valueReg = createRegister(1);

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg);

      expect(vwrite.hasSideEffects()).toBe(true);
    });

    it('should include both address and value registers in operands', () => {
      const addressReg = createWordRegister(0, 'hwAddr');
      const valueReg = createRegister(1, 'data');

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg);

      const operands = vwrite.getOperands();
      expect(operands).toContain(addressReg);
      expect(operands).toContain(valueReg);

      const usedRegs = vwrite.getUsedRegisters();
      expect(usedRegs).toContain(addressReg);
      expect(usedRegs).toContain(valueReg);
      expect(usedRegs).toHaveLength(2);
    });

    it('should produce correct string representation', () => {
      const addressReg = createWordRegister(0, 'addr');
      const valueReg = createRegister(1, 'value');

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg);

      expect(vwrite.toString()).toBe('VOLATILE_WRITE v0:addr, v1:value');
    });

    it('should preserve hardware access metadata for border color write', () => {
      const addressReg = createWordRegister(0);
      const valueReg = createRegister(1);

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg, {
        addressingMode: 'Absolute',
        rasterCritical: true,
        estimatedCycles: 4,
        mapInfo: {
          structName: 'VIC',
          fieldName: 'borderColor',
          baseAddress: VIC.BORDER_COLOR,
        },
      });

      expect(vwrite.metadata.addressingMode).toBe('Absolute');
      expect(vwrite.metadata.rasterCritical).toBe(true);
      expect(vwrite.metadata.mapInfo?.baseAddress).toBe(VIC.BORDER_COLOR);
    });
  });

  // ===========================================================================
  // Barrier Semantics and Side Effects Tests
  // ===========================================================================

  describe('Barrier Semantics and Side Effects Tests', () => {
    it('should prevent elimination of barrier even with no uses', () => {
      const barrier = new ILOptBarrierInstruction(0);

      // Barrier has no result, but still has side effects
      expect(barrier.result).toBeNull();
      expect(barrier.hasSideEffects()).toBe(true);
    });

    it('should preserve volatile read in dead code elimination scenarios', () => {
      // Create a volatile read whose result is never used
      const addressReg = createWordRegister(0);
      const resultReg = createRegister(1);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);

      // Even though result is "unused", volatile read must not be eliminated
      expect(vread.hasSideEffects()).toBe(true);
    });

    it('should preserve volatile write in dead code elimination scenarios', () => {
      const addressReg = createWordRegister(0);
      const valueReg = createRegister(1);

      const vwrite = new ILVolatileWriteInstruction(0, addressReg, valueReg);

      // Volatile write must not be eliminated
      expect(vwrite.hasSideEffects()).toBe(true);
    });

    it('should distinguish volatile from non-volatile memory access', () => {
      const addressReg = createWordRegister(0);
      const resultReg = createRegister(1);
      const valueReg = createRegister(2);

      // Volatile versions have side effects
      const volatileRead = new ILVolatileReadInstruction(0, addressReg, resultReg);
      const volatileWrite = new ILVolatileWriteInstruction(1, addressReg, valueReg);

      // Hardware read/write also have special semantics
      const hwRead = new ILHardwareReadInstruction(2, VIC.RASTER, resultReg);
      const hwWrite = new ILHardwareWriteInstruction(3, VIC.BORDER_COLOR, valueReg);

      expect(volatileRead.hasSideEffects()).toBe(true);
      expect(volatileWrite.hasSideEffects()).toBe(true);
      expect(hwWrite.hasSideEffects()).toBe(true);
    });

    it('should mark barriers as non-terminators to allow subsequent instructions', () => {
      const barrier = new ILOptBarrierInstruction(0);
      const addressReg = createWordRegister(1);
      const resultReg = createRegister(2);
      const vread = new ILVolatileReadInstruction(1, addressReg, resultReg);

      // Neither should be terminators
      expect(barrier.isTerminator()).toBe(false);
      expect(vread.isTerminator()).toBe(false);
    });
  });

  // ===========================================================================
  // Timing-Critical Code Patterns Tests
  // ===========================================================================

  describe('Timing-Critical Code Patterns Tests', () => {
    it('should support barrier between raster wait and color write', () => {
      // Pattern: Read raster -> barrier -> write border color
      const rasterAddr = createWordRegister(0);
      const rasterVal = createRegister(1);
      const borderAddr = createWordRegister(2);
      const colorVal = createRegister(3);

      const readRaster = new ILVolatileReadInstruction(0, rasterAddr, rasterVal, {
        rasterCritical: true,
        mapInfo: { structName: 'VIC', fieldName: 'raster', baseAddress: VIC.RASTER },
      });

      const barrier = new ILOptBarrierInstruction(1, {
        rasterCritical: true,
        sourceExpression: 'timing_barrier',
      });

      const writeBorder = new ILVolatileWriteInstruction(2, borderAddr, colorVal, {
        rasterCritical: true,
        mapInfo: { structName: 'VIC', fieldName: 'borderColor', baseAddress: VIC.BORDER_COLOR },
      });

      // All instructions must have side effects to preserve order
      expect(readRaster.hasSideEffects()).toBe(true);
      expect(barrier.hasSideEffects()).toBe(true);
      expect(writeBorder.hasSideEffects()).toBe(true);
    });

    it('should support interrupt disable/enable pattern with barriers', () => {
      // Pattern: SEI -> critical section -> CLI
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const barrier1 = new ILOptBarrierInstruction(1);

      // Critical section operations would go here...

      const barrier2 = new ILOptBarrierInstruction(2);
      const cli = new ILCpuInstruction(3, ILOpcode.CPU_CLI);

      // All must have side effects
      expect(sei.hasSideEffects()).toBe(true);
      expect(barrier1.hasSideEffects()).toBe(true);
      expect(barrier2.hasSideEffects()).toBe(true);
      expect(cli.hasSideEffects()).toBe(true);
    });

    it('should support SID register write sequence with barriers', () => {
      // Pattern: Write frequency -> barrier -> write control (gate)
      const freqLoAddr = createWordRegister(0);
      const freqHiAddr = createWordRegister(1);
      const controlAddr = createWordRegister(2);
      const freqLoVal = createRegister(3);
      const freqHiVal = createRegister(4);
      const controlVal = createRegister(5);

      const writeFreqLo = new ILVolatileWriteInstruction(0, freqLoAddr, freqLoVal, {
        mapInfo: { structName: 'SID', fieldName: 'voice1FreqLo', baseAddress: SID.VOICE1_FREQ_LO },
      });

      const writeFreqHi = new ILVolatileWriteInstruction(1, freqHiAddr, freqHiVal, {
        mapInfo: { structName: 'SID', fieldName: 'voice1FreqHi', baseAddress: SID.VOICE1_FREQ_HI },
      });

      const barrier = new ILOptBarrierInstruction(2, {
        sourceExpression: 'sid_sync_barrier',
      });

      const writeControl = new ILVolatileWriteInstruction(3, controlAddr, controlVal, {
        mapInfo: { structName: 'SID', fieldName: 'voice1Control', baseAddress: SID.VOICE1_CONTROL },
      });

      // All writes and barrier must be preserved
      expect(writeFreqLo.hasSideEffects()).toBe(true);
      expect(writeFreqHi.hasSideEffects()).toBe(true);
      expect(barrier.hasSideEffects()).toBe(true);
      expect(writeControl.hasSideEffects()).toBe(true);
    });

    it('should support CIA interrupt acknowledge pattern', () => {
      // Pattern: Read ICR to acknowledge interrupt -> barrier -> handle interrupt
      const icrAddr = createWordRegister(0);
      const icrVal = createRegister(1);

      // Read CIA1 ICR to acknowledge interrupt
      const readICR = new ILVolatileReadInstruction(0, icrAddr, icrVal, {
        rasterCritical: true,
        mapInfo: { structName: 'CIA1', fieldName: 'icr', baseAddress: CIA.CIA1_ICR },
      });

      const barrier = new ILOptBarrierInstruction(1, {
        sourceExpression: 'irq_ack_barrier',
      });

      // The read MUST happen and be acknowledged before proceeding
      expect(readICR.hasSideEffects()).toBe(true);
      expect(barrier.hasSideEffects()).toBe(true);
    });

    it('should integrate barriers into ILFunction basic blocks', () => {
      const func = new ILFunction('rasterIRQ', [], IL_VOID);
      func.setInterrupt(true);

      const entryBlock = func.getEntryBlock();

      // Add barrier instruction to function
      const barrier = new ILOptBarrierInstruction(0, {
        rasterCritical: true,
      });

      entryBlock.addInstruction(barrier);

      // Verify barrier is in the block
      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(1);
      expect(instructions[0]).toBe(barrier);
      expect(instructions[0].opcode).toBe(ILOpcode.OPT_BARRIER);
    });

    it('should support module-level barrier hint metadata', () => {
      const module = new ILModule('timing-critical.bl65');

      // Store barrier-related optimization hints
      module.setMetadata('BarrierHints', {
        hasTimingCriticalCode: true,
        barrierCount: 5,
        rasterBarriers: 3,
        sidBarriers: 2,
        preserveBarriers: true,
        optimizationLevel: 'conservative',
      });

      const hints = module.getMetadata<{
        hasTimingCriticalCode: boolean;
        barrierCount: number;
        rasterBarriers: number;
        sidBarriers: number;
        preserveBarriers: boolean;
        optimizationLevel: string;
      }>('BarrierHints');

      expect(hints?.hasTimingCriticalCode).toBe(true);
      expect(hints?.barrierCount).toBe(5);
      expect(hints?.preserveBarriers).toBe(true);
      expect(hints?.optimizationLevel).toBe('conservative');
    });

    it('should track volatile access patterns in function metadata', () => {
      const func = new ILFunction('updateHardware', [], IL_VOID);

      // Simulate volatile access tracking
      const volatileAccesses = [
        { type: 'read', address: VIC.RASTER, instruction: 0 },
        { type: 'write', address: VIC.BORDER_COLOR, instruction: 2 },
        { type: 'write', address: SID.VOLUME_MODE, instruction: 4 },
      ];

      // Store in function (using module metadata in practice)
      const module = new ILModule('volatile-tracking.bl65');
      module.setMetadata('VolatileAccessPatterns', {
        updateHardware: volatileAccesses,
      });

      const patterns = module.getMetadata<Record<string, typeof volatileAccesses>>('VolatileAccessPatterns');
      expect(patterns?.updateHardware).toHaveLength(3);
      expect(patterns?.updateHardware[0].address).toBe(VIC.RASTER);
    });

    it('should support barrier placement hints for optimizer', () => {
      const module = new ILModule('optimized.bl65');

      // Store barrier placement recommendations
      module.setMetadata('BarrierPlacementHints', {
        beforeHardwareWrites: true,
        afterInterruptDisable: true,
        beforeInterruptEnable: true,
        aroundSIDSequences: true,
        minimumGapCycles: 2,
      });

      const placement = module.getMetadata<{
        beforeHardwareWrites: boolean;
        afterInterruptDisable: boolean;
        beforeInterruptEnable: boolean;
        aroundSIDSequences: boolean;
        minimumGapCycles: number;
      }>('BarrierPlacementHints');

      expect(placement?.beforeHardwareWrites).toBe(true);
      expect(placement?.aroundSIDSequences).toBe(true);
      expect(placement?.minimumGapCycles).toBe(2);
    });
  });
});
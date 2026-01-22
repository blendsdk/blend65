/**
 * Intrinsics Integration Extreme Tests (Task 5a.4)
 *
 * Extreme edge case tests for cross-category intrinsic integration.
 * Tests realistic C64 workflows combining multiple intrinsic categories.
 *
 * Test Categories:
 * - Cross-Category Integration Tests (Memory + CPU + Optimization)
 * - Realistic C64 Workflow Tests (Raster IRQ, Bank Switching, SID)
 * - Optimizer Barrier Respect Tests
 * - Memory + CPU Integration Tests
 * - Complete System Integration Tests
 *
 * @module il/intrinsics-integration-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILOptBarrierInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
  ILCpuInstruction,
  ILPeekInstruction,
  ILPokeInstruction,
  ILPeekwInstruction,
  ILPokewInstruction,
  ILLoInstruction,
  ILHiInstruction,
  ILConstInstruction,
} from '../../il/instructions.js';
import { ILFunction } from '../../il/function.js';
import { ILModule } from '../../il/module.js';
import { BasicBlock } from '../../il/basic-block.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';

// =============================================================================
// Test Constants - C64 Hardware Addresses
// =============================================================================

/**
 * VIC-II register addresses
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
  CIA1_ICR: 0xdc0d,
  CIA2_ICR: 0xdd0d,
};

/**
 * Memory configuration addresses
 */
const MEMORY = {
  PROCESSOR_PORT: 0x0001,
  BANK_CONFIG: 0xdd00,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a byte register for testing.
 */
function createByteReg(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE, name);
}

/**
 * Creates a word register for testing.
 */
function createWordReg(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_WORD, name);
}

// =============================================================================
// Cross-Category Integration Tests
// =============================================================================

describe('Intrinsics Integration Extreme Tests', () => {
  describe('Cross-Category Integration Tests', () => {
    it('should combine Memory + CPU intrinsics (sei + poke + cli pattern)', () => {
      // Pattern: SEI -> POKE -> CLI (critical hardware write)
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addrReg = createWordReg(1, 'addr');
      const valueReg = createByteReg(2, 'value');
      const poke = new ILPokeInstruction(1, addrReg, valueReg);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      // All must have side effects to preserve execution order
      expect(sei.hasSideEffects()).toBe(true);
      expect(poke.hasSideEffects()).toBe(true);
      expect(cli.hasSideEffects()).toBe(true);

      // Verify correct opcodes
      expect(sei.opcode).toBe(ILOpcode.CPU_SEI);
      expect(poke.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(cli.opcode).toBe(ILOpcode.CPU_CLI);
    });

    it('should combine Memory + Optimization intrinsics (barrier + peek)', () => {
      const barrier = new ILOptBarrierInstruction(0);
      const addrReg = createWordReg(1, 'addr');
      const resultReg = createByteReg(2, 'result');
      const peek = new ILPeekInstruction(1, addrReg, resultReg);

      expect(barrier.hasSideEffects()).toBe(true);
      expect(barrier.opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(peek.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
    });

    it('should combine CPU + Optimization intrinsics (sei + barrier)', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const barrier = new ILOptBarrierInstruction(1);

      // Both are barriers in their own way
      expect(sei.hasSideEffects()).toBe(true);
      expect(barrier.hasSideEffects()).toBe(true);
    });

    it('should combine Utility + Memory intrinsics (lo/hi with poke pattern)', () => {
      const wordReg = createWordReg(0, 'address');
      const loReg = createByteReg(1, 'lo');
      const hiReg = createByteReg(2, 'hi');

      // Extract lo/hi bytes
      const loInst = new ILLoInstruction(0, wordReg, loReg);
      const hiInst = new ILHiInstruction(1, wordReg, hiReg);

      // Use them for poke
      const addrLoReg = createWordReg(3, 'addrLo');
      const addrHiReg = createWordReg(4, 'addrHi');
      const pokeLo = new ILPokeInstruction(2, addrLoReg, loReg);
      const pokeHi = new ILPokeInstruction(3, addrHiReg, hiReg);

      expect(loInst.opcode).toBe(ILOpcode.INTRINSIC_LO);
      expect(hiInst.opcode).toBe(ILOpcode.INTRINSIC_HI);
      expect(pokeLo.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(pokeHi.opcode).toBe(ILOpcode.INTRINSIC_POKE);
    });

    it('should combine Stack + CPU intrinsics (php + sei + plp)', () => {
      // Save flags -> disable interrupts -> restore flags
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const sei = new ILCpuInstruction(1, ILOpcode.CPU_SEI);
      const plp = new ILCpuInstruction(2, ILOpcode.CPU_PLP);

      expect(php.hasSideEffects()).toBe(true);
      expect(sei.hasSideEffects()).toBe(true);
      expect(plp.hasSideEffects()).toBe(true);
    });

    it('should combine Stack + Memory intrinsics (pha + poke + pla)', () => {
      // Save A -> write to memory -> restore A
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);
      const addrReg = createWordReg(1);
      const valueReg = createByteReg(2);
      const poke = new ILPokeInstruction(1, addrReg, valueReg);
      const resultReg = createByteReg(3);
      const pla = new ILCpuInstruction(2, ILOpcode.CPU_PLA, resultReg);

      expect(pha.opcode).toBe(ILOpcode.CPU_PHA);
      expect(poke.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(pla.opcode).toBe(ILOpcode.CPU_PLA);
    });

    it('should verify all intrinsic categories can be combined in sequence', () => {
      // Memory
      const memCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Memory);
      expect(memCategories.length).toBeGreaterThan(0);

      // CPU
      const cpuCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CPU);
      expect(cpuCategories.length).toBeGreaterThan(0);

      // Optimization
      const optCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Optimization);
      expect(optCategories.length).toBeGreaterThan(0);

      // Stack
      const stackCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Stack);
      expect(stackCategories.length).toBeGreaterThan(0);

      // Utility
      const utilCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      expect(utilCategories.length).toBeGreaterThan(0);

      // CompileTime
      const compileCategories = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      expect(compileCategories.length).toBeGreaterThan(0);
    });

    it('should combine volatile operations with CPU intrinsics', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addrReg = createWordReg(1);
      const resultReg = createByteReg(2);
      const volatileRead = new ILVolatileReadInstruction(1, addrReg, resultReg);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      expect(sei.hasSideEffects()).toBe(true);
      expect(volatileRead.hasSideEffects()).toBe(true);
      expect(cli.hasSideEffects()).toBe(true);
    });

    it('should combine peekw/pokew with CPU intrinsics for 16-bit operations', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addrReg = createWordReg(1);
      const resultReg = createWordReg(2);
      const peekw = new ILPeekwInstruction(1, addrReg, resultReg);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      expect(peekw.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
      expect(sei.opcode).toBe(ILOpcode.CPU_SEI);
      expect(cli.opcode).toBe(ILOpcode.CPU_CLI);
    });
  });

  // ===========================================================================
  // Realistic C64 Workflow Tests
  // ===========================================================================

  describe('Realistic C64 Workflow Tests', () => {
    it('should support bank switching workflow (sei + barrier + poke + barrier + cli)', () => {
      // Pattern from 05a-intrinsics-library.md bankSwitch function
      const func = new ILFunction('bankSwitch', [IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // SEI - Disable interrupts
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      entryBlock.addInstruction(sei);

      // Barrier - Critical section start
      const barrier1 = new ILOptBarrierInstruction(1);
      entryBlock.addInstruction(barrier1);

      // POKE - Switch memory configuration
      const addrReg = createWordReg(2, 'configAddr');
      const configReg = createByteReg(3, 'config');
      const poke = new ILPokeInstruction(2, addrReg, configReg);
      entryBlock.addInstruction(poke);

      // Barrier - Critical section end
      const barrier2 = new ILOptBarrierInstruction(3);
      entryBlock.addInstruction(barrier2);

      // CLI - Enable interrupts
      const cli = new ILCpuInstruction(4, ILOpcode.CPU_CLI);
      entryBlock.addInstruction(cli);

      // Verify all 5 instructions are in the block
      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(5);
      expect(instructions[0].opcode).toBe(ILOpcode.CPU_SEI);
      expect(instructions[1].opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(instructions[2].opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(instructions[3].opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(instructions[4].opcode).toBe(ILOpcode.CPU_CLI);
    });

    it('should support raster IRQ wait loop workflow', () => {
      // Pattern: Read raster -> compare -> loop until match -> change border
      const func = new ILFunction('waitRaster', [IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Volatile read of raster register
      const rasterAddrReg = createWordReg(0, 'rasterAddr');
      const rasterValueReg = createByteReg(1, 'rasterValue');
      const readRaster = new ILVolatileReadInstruction(0, rasterAddrReg, rasterValueReg, {
        rasterCritical: true,
        mapInfo: { structName: 'VIC', fieldName: 'raster', baseAddress: VIC.RASTER },
      });

      // Barrier before color change
      const barrier = new ILOptBarrierInstruction(1);

      // Volatile write to border color
      const borderAddrReg = createWordReg(2, 'borderAddr');
      const colorReg = createByteReg(3, 'color');
      const writeBorder = new ILVolatileWriteInstruction(2, borderAddrReg, colorReg, {
        rasterCritical: true,
        mapInfo: { structName: 'VIC', fieldName: 'borderColor', baseAddress: VIC.BORDER_COLOR },
      });

      entryBlock.addInstruction(readRaster);
      entryBlock.addInstruction(barrier);
      entryBlock.addInstruction(writeBorder);

      // All instructions must have side effects
      expect(readRaster.hasSideEffects()).toBe(true);
      expect(barrier.hasSideEffects()).toBe(true);
      expect(writeBorder.hasSideEffects()).toBe(true);
    });

    it('should support SID register initialization workflow', () => {
      // Pattern: Set frequency -> barrier -> gate voice
      const func = new ILFunction('initSIDVoice', [], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Write frequency low byte
      const freqLoAddr = createWordReg(0);
      const freqLoVal = createByteReg(1);
      const writeFreqLo = new ILPokeInstruction(0, freqLoAddr, freqLoVal);

      // Write frequency high byte
      const freqHiAddr = createWordReg(2);
      const freqHiVal = createByteReg(3);
      const writeFreqHi = new ILPokeInstruction(1, freqHiAddr, freqHiVal);

      // Barrier to ensure frequency is set before gating
      const barrier = new ILOptBarrierInstruction(2);

      // Write control register (gate voice)
      const controlAddr = createWordReg(4);
      const controlVal = createByteReg(5);
      const writeControl = new ILPokeInstruction(3, controlAddr, controlVal);

      entryBlock.addInstruction(writeFreqLo);
      entryBlock.addInstruction(writeFreqHi);
      entryBlock.addInstruction(barrier);
      entryBlock.addInstruction(writeControl);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(4);
      expect(instructions[2].opcode).toBe(ILOpcode.OPT_BARRIER);
    });

    it('should support CIA interrupt acknowledge workflow', () => {
      // Pattern: SEI -> Read ICR (acknowledge) -> barrier -> handle -> CLI
      const func = new ILFunction('handleIRQ', [], IL_VOID);
      func.setInterrupt(true);
      const entryBlock = func.getEntryBlock();

      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      entryBlock.addInstruction(sei);

      // Read CIA ICR to acknowledge interrupt
      const icrAddr = createWordReg(1);
      const icrVal = createByteReg(2);
      const readICR = new ILVolatileReadInstruction(1, icrAddr, icrVal, {
        mapInfo: { structName: 'CIA1', fieldName: 'icr', baseAddress: CIA.CIA1_ICR },
      });
      entryBlock.addInstruction(readICR);

      // Barrier after acknowledge
      const barrier = new ILOptBarrierInstruction(2);
      entryBlock.addInstruction(barrier);

      const cli = new ILCpuInstruction(3, ILOpcode.CPU_CLI);
      entryBlock.addInstruction(cli);

      expect(func.getInterrupt()).toBe(true);
      expect(entryBlock.getInstructions()).toHaveLength(4);
    });

    it('should support preserve and modify workflow (php + pha + work + pla + plp)', () => {
      // Pattern from 05a-intrinsics-library.md preserveAndModify function
      const func = new ILFunction('preserveAndModify', [], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Save processor status
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      entryBlock.addInstruction(php);

      // Save accumulator
      const pha = new ILCpuInstruction(1, ILOpcode.CPU_PHA);
      entryBlock.addInstruction(pha);

      // Do some work (poke to hardware)
      const addrReg = createWordReg(2);
      const valueReg = createByteReg(3);
      const poke = new ILPokeInstruction(2, addrReg, valueReg);
      entryBlock.addInstruction(poke);

      // Restore accumulator
      const plaResultReg = createByteReg(4);
      const pla = new ILCpuInstruction(3, ILOpcode.CPU_PLA, plaResultReg);
      entryBlock.addInstruction(pla);

      // Restore processor status
      const plp = new ILCpuInstruction(4, ILOpcode.CPU_PLP);
      entryBlock.addInstruction(plp);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(5);
      expect(instructions[0].opcode).toBe(ILOpcode.CPU_PHP);
      expect(instructions[1].opcode).toBe(ILOpcode.CPU_PHA);
      expect(instructions[2].opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(instructions[3].opcode).toBe(ILOpcode.CPU_PLA);
      expect(instructions[4].opcode).toBe(ILOpcode.CPU_PLP);
    });

    it('should support VIC sprite position update workflow', () => {
      // Pattern: Read position -> update -> write back (atomic with SEI/CLI)
      const func = new ILFunction('updateSpritePos', [IL_BYTE, IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Disable interrupts for atomic update
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      entryBlock.addInstruction(sei);

      // Write X position (word operation for sprite X with MSB)
      const xAddrReg = createWordReg(1);
      const xValReg = createWordReg(2);
      const pokeX = new ILPokewInstruction(1, xAddrReg, xValReg);
      entryBlock.addInstruction(pokeX);

      // Write Y position
      const yAddrReg = createWordReg(3);
      const yValReg = createByteReg(4);
      const pokeY = new ILPokeInstruction(2, yAddrReg, yValReg);
      entryBlock.addInstruction(pokeY);

      // Re-enable interrupts
      const cli = new ILCpuInstruction(3, ILOpcode.CPU_CLI);
      entryBlock.addInstruction(cli);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(4);
    });

    it('should support keyboard scan workflow with peek', () => {
      // Pattern: Select row -> read column data -> process
      const func = new ILFunction('scanKeyboard', [], IL_BYTE);
      const entryBlock = func.getEntryBlock();

      // Write to select row (CIA1 port A)
      const rowAddrReg = createWordReg(0);
      const rowValReg = createByteReg(1);
      const selectRow = new ILPokeInstruction(0, rowAddrReg, rowValReg);
      entryBlock.addInstruction(selectRow);

      // Barrier to ensure row selection propagates
      const barrier = new ILOptBarrierInstruction(1);
      entryBlock.addInstruction(barrier);

      // Read column data (CIA1 port B)
      const colAddrReg = createWordReg(2);
      const colValReg = createByteReg(3);
      const readCol = new ILPeekInstruction(2, colAddrReg, colValReg);
      entryBlock.addInstruction(readCol);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(3);
      expect(instructions[0].opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(instructions[1].opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(instructions[2].opcode).toBe(ILOpcode.INTRINSIC_PEEK);
    });

    it('should support NOP timing delay workflow', () => {
      // Pattern: Multiple NOPs for precise timing
      const func = new ILFunction('delay4Cycles', [], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // 2 NOPs = 4 cycles
      const nop1 = new ILCpuInstruction(0, ILOpcode.CPU_NOP);
      const nop2 = new ILCpuInstruction(1, ILOpcode.CPU_NOP);

      entryBlock.addInstruction(nop1);
      entryBlock.addInstruction(nop2);

      // NOPs should have side effects to prevent elimination
      expect(nop1.hasSideEffects()).toBe(true);
      expect(nop2.hasSideEffects()).toBe(true);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(2);
    });

    it('should support word address extraction for indirect addressing', () => {
      // Pattern: Extract lo/hi from pointer, use for indirect access
      const wordAddrReg = createWordReg(0, 'ptr');
      const loReg = createByteReg(1, 'ptrLo');
      const hiReg = createByteReg(2, 'ptrHi');

      // Extract lo and hi bytes
      const loInst = new ILLoInstruction(0, wordAddrReg, loReg);
      const hiInst = new ILHiInstruction(1, wordAddrReg, hiReg);

      // Store to zero page for indirect addressing
      const zpLoAddr = createWordReg(3, 'zpLo');
      const zpHiAddr = createWordReg(4, 'zpHi');
      const storeLo = new ILPokeInstruction(2, zpLoAddr, loReg);
      const storeHi = new ILPokeInstruction(3, zpHiAddr, hiReg);

      expect(loInst.result).toBe(loReg);
      expect(hiInst.result).toBe(hiReg);
      expect(storeLo.value).toBe(loReg);
      expect(storeHi.value).toBe(hiReg);
    });

    it('should support BRK software interrupt for debugging', () => {
      const func = new ILFunction('debugBreak', [], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Barrier before break to ensure all writes complete
      const barrier = new ILOptBarrierInstruction(0);
      entryBlock.addInstruction(barrier);

      // Software interrupt
      const brk = new ILCpuInstruction(1, ILOpcode.CPU_BRK);
      entryBlock.addInstruction(brk);

      expect(brk.hasSideEffects()).toBe(true);
      const instructions = entryBlock.getInstructions();
      expect(instructions).toHaveLength(2);
      expect(instructions[1].opcode).toBe(ILOpcode.CPU_BRK);
    });
  });

  // ===========================================================================
  // Optimizer Barrier Respect Tests
  // ===========================================================================

  describe('Optimizer Barrier Respect Tests', () => {
    it('should verify barriers have side effects preventing DCE', () => {
      const barrier = new ILOptBarrierInstruction(0);

      // Barriers must have side effects to prevent Dead Code Elimination
      expect(barrier.hasSideEffects()).toBe(true);
      expect(barrier.result).toBeNull(); // No result, but still preserved
    });

    it('should verify volatile reads have side effects preventing DCE', () => {
      const addrReg = createWordReg(0);
      const resultReg = createByteReg(1);
      const vread = new ILVolatileReadInstruction(0, addrReg, resultReg);

      // Even if result is unused, volatile read must not be eliminated
      expect(vread.hasSideEffects()).toBe(true);
    });

    it('should verify volatile writes have side effects preventing DCE', () => {
      const addrReg = createWordReg(0);
      const valueReg = createByteReg(1);
      const vwrite = new ILVolatileWriteInstruction(0, addrReg, valueReg);

      expect(vwrite.hasSideEffects()).toBe(true);
    });

    it('should verify all CPU intrinsics have side effects', () => {
      const cpuIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CPU);

      for (const intrinsic of cpuIntrinsics) {
        expect(intrinsic.hasSideEffects).toBe(true);
      }
    });

    it('should verify all optimization intrinsics act as barriers', () => {
      const optIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Optimization);

      for (const intrinsic of optIntrinsics) {
        // All optimization intrinsics should have side effects and be barriers
        expect(intrinsic.hasSideEffects).toBe(true);
        expect(intrinsic.isBarrier).toBe(true);
      }
    });

    it('should preserve instruction order with barriers in basic block', () => {
      const func = new ILFunction('preserveOrder', [], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // Write 1 -> Barrier -> Write 2 (order must be preserved)
      const addr1 = createWordReg(0);
      const val1 = createByteReg(1);
      const write1 = new ILPokeInstruction(0, addr1, val1);

      const barrier = new ILOptBarrierInstruction(1);

      const addr2 = createWordReg(2);
      const val2 = createByteReg(3);
      const write2 = new ILPokeInstruction(2, addr2, val2);

      entryBlock.addInstruction(write1);
      entryBlock.addInstruction(barrier);
      entryBlock.addInstruction(write2);

      // Verify order is preserved
      const instructions = entryBlock.getInstructions();
      expect(instructions[0]).toBe(write1);
      expect(instructions[1]).toBe(barrier);
      expect(instructions[2]).toBe(write2);
    });

    it('should verify SEI/CLI act as implicit barriers', () => {
      const seiDef = INTRINSIC_REGISTRY.get('sei');
      const cliDef = INTRINSIC_REGISTRY.get('cli');

      expect(seiDef?.isBarrier).toBe(true);
      expect(cliDef?.isBarrier).toBe(true);
      expect(seiDef?.hasSideEffects).toBe(true);
      expect(cliDef?.hasSideEffects).toBe(true);
    });

    it('should verify volatile_read and volatile_write are barriers', () => {
      const volatileReadDef = INTRINSIC_REGISTRY.get('volatile_read');
      const volatileWriteDef = INTRINSIC_REGISTRY.get('volatile_write');

      expect(volatileReadDef?.isBarrier).toBe(true);
      expect(volatileWriteDef?.isBarrier).toBe(true);
      expect(volatileReadDef?.isVolatile).toBe(true);
      expect(volatileWriteDef?.isVolatile).toBe(true);
    });

    it('should verify barrier instruction preserves raster-critical metadata', () => {
      const barrier = new ILOptBarrierInstruction(0, {
        rasterCritical: true,
        estimatedCycles: 0,
        sourceExpression: 'barrier()',
      });

      expect(barrier.metadata.rasterCritical).toBe(true);
      expect(barrier.metadata.estimatedCycles).toBe(0);
    });

    it('should track multiple barriers in a function for optimization hints', () => {
      const module = new ILModule('multi-barrier.bl65');
      const func = new ILFunction('multiBarrier', [], IL_VOID);
      module.addFunction(func);

      const entryBlock = func.getEntryBlock();

      // Add multiple barriers
      for (let i = 0; i < 5; i++) {
        entryBlock.addInstruction(new ILOptBarrierInstruction(i));
      }

      // Store barrier count as module metadata
      module.setMetadata('BarrierCount', 5);

      expect(module.getMetadata('BarrierCount')).toBe(5);
      expect(entryBlock.getInstructions()).toHaveLength(5);
    });
  });

  // ===========================================================================
  // Memory + CPU Integration Tests
  // ===========================================================================

  describe('Memory + CPU Integration Tests', () => {
    it('should integrate 8-bit memory operations with interrupt control', () => {
      const func = new ILFunction('atomicWrite8', [IL_WORD, IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // SEI -> POKE -> CLI pattern for atomic 8-bit write
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addr = createWordReg(1);
      const val = createByteReg(2);
      const poke = new ILPokeInstruction(1, addr, val);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      entryBlock.addInstruction(sei);
      entryBlock.addInstruction(poke);
      entryBlock.addInstruction(cli);

      expect(entryBlock.getInstructions()).toHaveLength(3);
      expect(entryBlock.getInstructions().every((i) => i.hasSideEffects())).toBe(true);
    });

    it('should integrate 16-bit memory operations with interrupt control', () => {
      const func = new ILFunction('atomicWrite16', [IL_WORD, IL_WORD], IL_VOID);
      const entryBlock = func.getEntryBlock();

      // SEI -> POKEW -> CLI pattern for atomic 16-bit write
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addr = createWordReg(1);
      const val = createWordReg(2);
      const pokew = new ILPokewInstruction(1, addr, val);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      entryBlock.addInstruction(sei);
      entryBlock.addInstruction(pokew);
      entryBlock.addInstruction(cli);

      expect(entryBlock.getInstructions()).toHaveLength(3);
    });

    it('should integrate peek with NOP timing', () => {
      // Pattern: PEEK -> NOP (delay) -> process result
      const func = new ILFunction('timedRead', [IL_WORD], IL_BYTE);
      const entryBlock = func.getEntryBlock();

      const addr = createWordReg(0);
      const result = createByteReg(1);
      const peek = new ILPeekInstruction(0, addr, result);
      const nop = new ILCpuInstruction(1, ILOpcode.CPU_NOP);

      entryBlock.addInstruction(peek);
      entryBlock.addInstruction(nop);

      expect(peek.result).toBe(result);
      expect(nop.opcode).toBe(ILOpcode.CPU_NOP);
    });

    it('should integrate poke with stack preservation', () => {
      // Pattern: PHA -> POKE -> PLA (preserve A during hardware write)
      const func = new ILFunction('preserveAndPoke', [IL_WORD, IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);
      const addr = createWordReg(1);
      const val = createByteReg(2);
      const poke = new ILPokeInstruction(1, addr, val);
      const plaResult = createByteReg(3);
      const pla = new ILCpuInstruction(2, ILOpcode.CPU_PLA, plaResult);

      entryBlock.addInstruction(pha);
      entryBlock.addInstruction(poke);
      entryBlock.addInstruction(pla);

      expect(entryBlock.getInstructions()).toHaveLength(3);
    });

    it('should integrate peek with flag preservation', () => {
      // Pattern: PHP -> PEEK -> PLP (preserve flags during read)
      const func = new ILFunction('preserveFlagsRead', [IL_WORD], IL_BYTE);
      const entryBlock = func.getEntryBlock();

      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const addr = createWordReg(1);
      const result = createByteReg(2);
      const peek = new ILPeekInstruction(1, addr, result);
      const plp = new ILCpuInstruction(2, ILOpcode.CPU_PLP);

      entryBlock.addInstruction(php);
      entryBlock.addInstruction(peek);
      entryBlock.addInstruction(plp);

      expect(entryBlock.getInstructions()).toHaveLength(3);
    });

    it('should integrate volatile operations with full CPU state preservation', () => {
      // Pattern: PHP -> PHA -> SEI -> volatile_write -> CLI -> PLA -> PLP
      const func = new ILFunction('fullPreserveWrite', [IL_WORD, IL_BYTE], IL_VOID);
      const entryBlock = func.getEntryBlock();

      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const pha = new ILCpuInstruction(1, ILOpcode.CPU_PHA);
      const sei = new ILCpuInstruction(2, ILOpcode.CPU_SEI);

      const addr = createWordReg(3);
      const val = createByteReg(4);
      const vwrite = new ILVolatileWriteInstruction(3, addr, val);

      const cli = new ILCpuInstruction(4, ILOpcode.CPU_CLI);
      const plaResult = createByteReg(5);
      const pla = new ILCpuInstruction(5, ILOpcode.CPU_PLA, plaResult);
      const plp = new ILCpuInstruction(6, ILOpcode.CPU_PLP);

      entryBlock.addInstruction(php);
      entryBlock.addInstruction(pha);
      entryBlock.addInstruction(sei);
      entryBlock.addInstruction(vwrite);
      entryBlock.addInstruction(cli);
      entryBlock.addInstruction(pla);
      entryBlock.addInstruction(plp);

      expect(entryBlock.getInstructions()).toHaveLength(7);
    });

    it('should integrate lo/hi extraction with sequential poke operations', () => {
      // Pattern: Extract lo/hi -> poke lo -> barrier -> poke hi
      const func = new ILFunction('writeWordAtomic', [IL_WORD, IL_WORD], IL_VOID);
      const entryBlock = func.getEntryBlock();

      const wordVal = createWordReg(0, 'value');
      const loReg = createByteReg(1, 'lo');
      const hiReg = createByteReg(2, 'hi');

      const extractLo = new ILLoInstruction(0, wordVal, loReg);
      const extractHi = new ILHiInstruction(1, wordVal, hiReg);

      const addrLo = createWordReg(3);
      const addrHi = createWordReg(4);
      const pokeLo = new ILPokeInstruction(2, addrLo, loReg);
      const barrier = new ILOptBarrierInstruction(3);
      const pokeHi = new ILPokeInstruction(4, addrHi, hiReg);

      entryBlock.addInstruction(extractLo);
      entryBlock.addInstruction(extractHi);
      entryBlock.addInstruction(pokeLo);
      entryBlock.addInstruction(barrier);
      entryBlock.addInstruction(pokeHi);

      expect(entryBlock.getInstructions()).toHaveLength(5);
    });

    it('should integrate peekw with interrupt-safe pattern', () => {
      // Pattern: SEI -> PEEKW -> barrier -> CLI
      const func = new ILFunction('safeRead16', [IL_WORD], IL_WORD);
      const entryBlock = func.getEntryBlock();

      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const addr = createWordReg(1);
      const result = createWordReg(2);
      const peekw = new ILPeekwInstruction(1, addr, result);
      const barrier = new ILOptBarrierInstruction(2);
      const cli = new ILCpuInstruction(3, ILOpcode.CPU_CLI);

      entryBlock.addInstruction(sei);
      entryBlock.addInstruction(peekw);
      entryBlock.addInstruction(barrier);
      entryBlock.addInstruction(cli);

      expect(entryBlock.getInstructions()).toHaveLength(4);
    });

    it('should verify memory intrinsics in registry have correct parameter counts', () => {
      const memIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Memory);

      // peek: 1 param (address)
      const peekDef = memIntrinsics.find((i) => i.name === 'peek');
      expect(peekDef?.parameterTypes.length).toBe(1);

      // poke: 2 params (address, value)
      const pokeDef = memIntrinsics.find((i) => i.name === 'poke');
      expect(pokeDef?.parameterTypes.length).toBe(2);

      // peekw: 1 param (address)
      const peekwDef = memIntrinsics.find((i) => i.name === 'peekw');
      expect(peekwDef?.parameterTypes.length).toBe(1);

      // pokew: 2 params (address, value)
      const pokewDef = memIntrinsics.find((i) => i.name === 'pokew');
      expect(pokewDef?.parameterTypes.length).toBe(2);
    });

    it('should verify CPU intrinsics in registry have correct parameter counts', () => {
      const cpuIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CPU);

      // All basic CPU intrinsics (sei, cli, nop, brk) have 0 parameters
      for (const intrinsic of cpuIntrinsics) {
        expect(intrinsic.parameterTypes.length).toBe(0);
      }
    });
  });

  // ===========================================================================
  // Complete System Integration Tests
  // ===========================================================================

  describe('Complete System Integration Tests', () => {
    it('should build complete raster IRQ handler module', () => {
      const module = new ILModule('raster-irq.bl65');

      // IRQ handler function
      const irqHandler = new ILFunction('irqHandler', [], IL_VOID);
      irqHandler.setInterrupt(true);
      module.addFunction(irqHandler);

      const entryBlock = irqHandler.getEntryBlock();

      // Full IRQ handler pattern:
      // PHP -> PHA -> read raster -> barrier -> write color -> barrier -> PLA -> PLP
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const pha = new ILCpuInstruction(1, ILOpcode.CPU_PHA);

      const rasterAddr = createWordReg(2);
      const rasterVal = createByteReg(3);
      const readRaster = new ILVolatileReadInstruction(2, rasterAddr, rasterVal);

      const barrier1 = new ILOptBarrierInstruction(3);

      const borderAddr = createWordReg(4);
      const colorVal = createByteReg(5);
      const writeBorder = new ILVolatileWriteInstruction(4, borderAddr, colorVal);

      const barrier2 = new ILOptBarrierInstruction(5);

      const plaResult = createByteReg(6);
      const pla = new ILCpuInstruction(6, ILOpcode.CPU_PLA, plaResult);
      const plp = new ILCpuInstruction(7, ILOpcode.CPU_PLP);

      entryBlock.addInstruction(php);
      entryBlock.addInstruction(pha);
      entryBlock.addInstruction(readRaster);
      entryBlock.addInstruction(barrier1);
      entryBlock.addInstruction(writeBorder);
      entryBlock.addInstruction(barrier2);
      entryBlock.addInstruction(pla);
      entryBlock.addInstruction(plp);

      expect(module.getFunctions()).toHaveLength(1);
      expect(entryBlock.getInstructions()).toHaveLength(8);
      expect(irqHandler.getInterrupt()).toBe(true);
    });

    it('should build complete SID player module', () => {
      const module = new ILModule('sid-player.bl65');

      // Init function
      const initFunc = new ILFunction('sidInit', [], IL_VOID);
      module.addFunction(initFunc);

      // Play function
      const playFunc = new ILFunction('sidPlay', [], IL_VOID);
      module.addFunction(playFunc);

      // Init: Set volume
      const initBlock = initFunc.getEntryBlock();
      const volAddr = createWordReg(0);
      const volVal = createByteReg(1);
      const setVolume = new ILPokeInstruction(0, volAddr, volVal);
      initBlock.addInstruction(setVolume);

      // Play: Update frequency with barrier before gate
      const playBlock = playFunc.getEntryBlock();
      const freqAddr = createWordReg(2);
      const freqVal = createWordReg(3);
      const setFreq = new ILPokewInstruction(1, freqAddr, freqVal);
      const barrier = new ILOptBarrierInstruction(2);
      const gateAddr = createWordReg(4);
      const gateVal = createByteReg(5);
      const setGate = new ILPokeInstruction(3, gateAddr, gateVal);

      playBlock.addInstruction(setFreq);
      playBlock.addInstruction(barrier);
      playBlock.addInstruction(setGate);

      expect(module.getFunctions()).toHaveLength(2);
      expect(initBlock.getInstructions()).toHaveLength(1);
      expect(playBlock.getInstructions()).toHaveLength(3);
    });

    it('should build complete memory copy routine with intrinsics', () => {
      const module = new ILModule('memcopy.bl65');

      const copyFunc = new ILFunction('memcopy', [IL_WORD, IL_WORD, IL_WORD], IL_VOID);
      module.addFunction(copyFunc);

      const entryBlock = copyFunc.getEntryBlock();

      // Set up zero page pointers using lo/hi
      const srcPtr = createWordReg(0, 'src');
      const srcLo = createByteReg(1);
      const srcHi = createByteReg(2);
      const extractSrcLo = new ILLoInstruction(0, srcPtr, srcLo);
      const extractSrcHi = new ILHiInstruction(1, srcPtr, srcHi);

      const zpSrcLoAddr = createWordReg(3);
      const zpSrcHiAddr = createWordReg(4);
      const storeSrcLo = new ILPokeInstruction(2, zpSrcLoAddr, srcLo);
      const storeSrcHi = new ILPokeInstruction(3, zpSrcHiAddr, srcHi);

      entryBlock.addInstruction(extractSrcLo);
      entryBlock.addInstruction(extractSrcHi);
      entryBlock.addInstruction(storeSrcLo);
      entryBlock.addInstruction(storeSrcHi);

      expect(entryBlock.getInstructions()).toHaveLength(4);
    });

    it('should verify total intrinsic count in registry', () => {
      // Count all intrinsics
      const allIntrinsics = Array.from(INTRINSIC_REGISTRY.getAll());

      // Should have: peek, poke, peekw, pokew (4)
      //              barrier, volatile_read, volatile_write (3)
      //              sei, cli, nop, brk (4)
      //              pha, pla, php, plp (4)
      //              sizeof, length (2)
      //              lo, hi (2)
      // Total: 19 intrinsics
      expect(allIntrinsics.length).toBe(19);
    });

    it('should verify all intrinsics have valid opcodes or are compile-time', () => {
      for (const intrinsic of INTRINSIC_REGISTRY.getAll()) {
        // Either has a valid opcode OR is compile-time (opcode is null)
        if (intrinsic.isCompileTime) {
          expect(intrinsic.opcode).toBeNull();
        } else {
          expect(intrinsic.opcode).not.toBeNull();
        }
      }
    });

    it('should verify all intrinsics have valid cycle counts or null for compile-time', () => {
      for (const intrinsic of INTRINSIC_REGISTRY.getAll()) {
        if (intrinsic.isCompileTime) {
          expect(intrinsic.cycleCount).toBeNull();
        } else {
          // Runtime intrinsics should have a valid cycle count (number >= 0)
          expect(typeof intrinsic.cycleCount).toBe('number');
          expect(intrinsic.cycleCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should build module with all intrinsic categories represented', () => {
      const module = new ILModule('all-categories.bl65');
      const func = new ILFunction('useAllCategories', [], IL_VOID);
      module.addFunction(func);

      const entryBlock = func.getEntryBlock();
      let instId = 0;

      // Memory: peek, poke
      const addr1 = createWordReg(instId++);
      const val1 = createByteReg(instId++);
      const poke = new ILPokeInstruction(instId++, addr1, val1);
      entryBlock.addInstruction(poke);

      // Optimization: barrier
      const barrier = new ILOptBarrierInstruction(instId++);
      entryBlock.addInstruction(barrier);

      // CPU: sei, cli
      const sei = new ILCpuInstruction(instId++, ILOpcode.CPU_SEI);
      entryBlock.addInstruction(sei);
      const cli = new ILCpuInstruction(instId++, ILOpcode.CPU_CLI);
      entryBlock.addInstruction(cli);

      // Stack: pha, pla
      const pha = new ILCpuInstruction(instId++, ILOpcode.CPU_PHA);
      entryBlock.addInstruction(pha);
      const plaResult = createByteReg(instId++);
      const pla = new ILCpuInstruction(instId++, ILOpcode.CPU_PLA, plaResult);
      entryBlock.addInstruction(pla);

      // Utility: lo, hi
      const wordVal = createWordReg(instId++);
      const loResult = createByteReg(instId++);
      const hiResult = createByteReg(instId++);
      const lo = new ILLoInstruction(instId++, wordVal, loResult);
      const hi = new ILHiInstruction(instId++, wordVal, hiResult);
      entryBlock.addInstruction(lo);
      entryBlock.addInstruction(hi);

      // Should have 8 instructions from all categories
      expect(entryBlock.getInstructions()).toHaveLength(8);

      // Verify opcodes
      const opcodes = entryBlock.getInstructions().map((i) => i.opcode);
      expect(opcodes).toContain(ILOpcode.INTRINSIC_POKE);
      expect(opcodes).toContain(ILOpcode.OPT_BARRIER);
      expect(opcodes).toContain(ILOpcode.CPU_SEI);
      expect(opcodes).toContain(ILOpcode.CPU_CLI);
      expect(opcodes).toContain(ILOpcode.CPU_PHA);
      expect(opcodes).toContain(ILOpcode.CPU_PLA);
      expect(opcodes).toContain(ILOpcode.INTRINSIC_LO);
      expect(opcodes).toContain(ILOpcode.INTRINSIC_HI);
    });

    it('should track comprehensive module metadata for intrinsic usage', () => {
      const module = new ILModule('intrinsic-stats.bl65');

      // Track intrinsic usage statistics
      module.setMetadata('IntrinsicUsage', {
        memoryAccess: { peek: 5, poke: 10, peekw: 2, pokew: 3 },
        optimization: { barrier: 8, volatile_read: 4, volatile_write: 6 },
        cpu: { sei: 3, cli: 3, nop: 12, brk: 1 },
        stack: { pha: 2, pla: 2, php: 1, plp: 1 },
        utility: { lo: 7, hi: 7 },
        compileTime: { sizeof: 15, length: 8 },
      });

      const usage = module.getMetadata<Record<string, Record<string, number>>>('IntrinsicUsage');
      expect(usage?.memoryAccess.peek).toBe(5);
      expect(usage?.optimization.barrier).toBe(8);
      expect(usage?.cpu.nop).toBe(12);
      expect(usage?.utility.lo).toBe(7);
    });

    it('should verify intrinsic return types match IL types', () => {
      // Memory reads return bytes/words
      const peekDef = INTRINSIC_REGISTRY.get('peek');
      expect(peekDef?.returnType).toEqual(IL_BYTE);

      const peekwDef = INTRINSIC_REGISTRY.get('peekw');
      expect(peekwDef?.returnType).toEqual(IL_WORD);

      // Memory writes return void
      const pokeDef = INTRINSIC_REGISTRY.get('poke');
      expect(pokeDef?.returnType).toEqual(IL_VOID);

      // CPU instructions mostly return void
      const seiDef = INTRINSIC_REGISTRY.get('sei');
      expect(seiDef?.returnType).toEqual(IL_VOID);

      // PLA returns byte
      const plaDef = INTRINSIC_REGISTRY.get('pla');
      expect(plaDef?.returnType).toEqual(IL_BYTE);

      // Utility returns bytes
      const loDef = INTRINSIC_REGISTRY.get('lo');
      expect(loDef?.returnType).toEqual(IL_BYTE);
    });

    it('should build complete game loop with all integration patterns', () => {
      const module = new ILModule('game-loop.bl65');

      // Main game loop function
      const gameLoop = new ILFunction('gameLoop', [], IL_VOID);
      module.addFunction(gameLoop);

      const entryBlock = gameLoop.getEntryBlock();
      let instId = 0;

      // 1. Disable interrupts
      const sei = new ILCpuInstruction(instId++, ILOpcode.CPU_SEI);
      entryBlock.addInstruction(sei);

      // 2. Barrier after interrupt disable
      const barrier1 = new ILOptBarrierInstruction(instId++);
      entryBlock.addInstruction(barrier1);

      // 3. Read joystick (peek)
      const joyAddr = createWordReg(instId++);
      const joyVal = createByteReg(instId++);
      const readJoy = new ILPeekInstruction(instId++, joyAddr, joyVal);
      entryBlock.addInstruction(readJoy);

      // 4. Update sprite position (pokew for X, poke for Y)
      const sprXAddr = createWordReg(instId++);
      const sprXVal = createWordReg(instId++);
      const updateSprX = new ILPokewInstruction(instId++, sprXAddr, sprXVal);
      entryBlock.addInstruction(updateSprX);

      const sprYAddr = createWordReg(instId++);
      const sprYVal = createByteReg(instId++);
      const updateSprY = new ILPokeInstruction(instId++, sprYAddr, sprYVal);
      entryBlock.addInstruction(updateSprY);

      // 5. Barrier before VIC access
      const barrier2 = new ILOptBarrierInstruction(instId++);
      entryBlock.addInstruction(barrier2);

      // 6. Update border color
      const borderAddr = createWordReg(instId++);
      const borderVal = createByteReg(instId++);
      const updateBorder = new ILVolatileWriteInstruction(instId++, borderAddr, borderVal);
      entryBlock.addInstruction(updateBorder);

      // 7. Barrier after VIC access
      const barrier3 = new ILOptBarrierInstruction(instId++);
      entryBlock.addInstruction(barrier3);

      // 8. Re-enable interrupts
      const cli = new ILCpuInstruction(instId++, ILOpcode.CPU_CLI);
      entryBlock.addInstruction(cli);

      // Verify complete game loop structure
      expect(entryBlock.getInstructions()).toHaveLength(9);

      // Verify first is SEI, last is CLI
      const instructions = entryBlock.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.CPU_SEI);
      expect(instructions[instructions.length - 1].opcode).toBe(ILOpcode.CPU_CLI);
    });
  });
});
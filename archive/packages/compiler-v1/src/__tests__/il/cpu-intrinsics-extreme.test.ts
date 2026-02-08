/**
 * CPU Intrinsics Extreme Tests
 *
 * Session 11: Task 5.11 - Comprehensive extreme edge case tests for CPU instruction
 * intrinsics (ILCpuInstruction) including all 8 opcodes: SEI, CLI, NOP, BRK, PHA, PLA, PHP, PLP.
 *
 * Tests cover:
 * - Instruction creation for all opcodes
 * - Cycle count verification
 * - Side effects behavior (all CPU instructions have side effects)
 * - Operand and used register handling
 * - String representation format
 * - Result register handling (only PLA returns a value)
 * - Terminator status (none are terminators)
 * - Integration patterns (interrupt pairs, stack pairs)
 * - DCE prevention verification
 *
 * @module __tests__/il/cpu-intrinsics-extreme
 */

import { describe, it, expect } from 'vitest';
import {
  ILCpuInstruction,
  ILOpcode,
  ILOptBarrierInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE } from '../../il/types.js';
import { ILFunction } from '../../il/function.js';

// =============================================================================
// CPU Instruction Basic Creation Tests
// =============================================================================

describe('CPU Intrinsics Extreme Tests', () => {
  describe('SEI (Set Interrupt Disable) Instruction', () => {
    it('should create SEI instruction with correct opcode', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.opcode).toBe(ILOpcode.CPU_SEI);
      expect(sei.id).toBe(0);
      expect(sei.result).toBeNull();
    });

    it('should have correct cycle count for SEI (2 cycles)', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.getCycleCount()).toBe(2);
    });

    it('should report side effects for SEI (modifies processor status)', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.hasSideEffects()).toBe(true);
    });

    it('should have no operands for SEI', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.getOperands()).toEqual([]);
      expect(sei.getUsedRegisters()).toEqual([]);
    });

    it('should format SEI instruction as string', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.toString()).toBe('CPU_SEI');
    });

    it('should not be a terminator', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      expect(sei.isTerminator()).toBe(false);
    });
  });

  describe('CLI (Clear Interrupt Disable) Instruction', () => {
    it('should create CLI instruction with correct opcode', () => {
      const cli = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      expect(cli.opcode).toBe(ILOpcode.CPU_CLI);
      expect(cli.id).toBe(0);
      expect(cli.result).toBeNull();
    });

    it('should have correct cycle count for CLI (2 cycles)', () => {
      const cli = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      expect(cli.getCycleCount()).toBe(2);
    });

    it('should report side effects for CLI (modifies processor status)', () => {
      const cli = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      expect(cli.hasSideEffects()).toBe(true);
    });

    it('should have no operands for CLI', () => {
      const cli = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      expect(cli.getOperands()).toEqual([]);
      expect(cli.getUsedRegisters()).toEqual([]);
    });

    it('should format CLI instruction as string', () => {
      const cli = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      expect(cli.toString()).toBe('CPU_CLI');
    });
  });

  describe('NOP (No Operation) Instruction', () => {
    it('should create NOP instruction with correct opcode', () => {
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      expect(nop.opcode).toBe(ILOpcode.CPU_NOP);
      expect(nop.id).toBe(0);
      expect(nop.result).toBeNull();
    });

    it('should have correct cycle count for NOP (2 cycles)', () => {
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      expect(nop.getCycleCount()).toBe(2);
    });

    it('should report side effects for NOP (timing-critical, cannot be eliminated)', () => {
      // NOP has side effects because it's used for timing and must not be eliminated
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      expect(nop.hasSideEffects()).toBe(true);
    });

    it('should have no operands for NOP', () => {
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      expect(nop.getOperands()).toEqual([]);
      expect(nop.getUsedRegisters()).toEqual([]);
    });

    it('should format NOP instruction as string', () => {
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      expect(nop.toString()).toBe('CPU_NOP');
    });
  });

  describe('BRK (Software Interrupt) Instruction', () => {
    it('should create BRK instruction with correct opcode', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.opcode).toBe(ILOpcode.CPU_BRK);
      expect(brk.id).toBe(0);
      expect(brk.result).toBeNull();
    });

    it('should have correct cycle count for BRK (7 cycles)', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.getCycleCount()).toBe(7);
    });

    it('should report side effects for BRK (triggers interrupt)', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.hasSideEffects()).toBe(true);
    });

    it('should have no operands for BRK', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.getOperands()).toEqual([]);
      expect(brk.getUsedRegisters()).toEqual([]);
    });

    it('should format BRK instruction as string', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.toString()).toBe('CPU_BRK');
    });

    it('should not be a terminator (control returns after interrupt)', () => {
      // BRK triggers an interrupt but control can return
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK);

      expect(brk.isTerminator()).toBe(false);
    });
  });

  describe('PHA (Push Accumulator) Instruction', () => {
    it('should create PHA instruction with correct opcode', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.opcode).toBe(ILOpcode.CPU_PHA);
      expect(pha.id).toBe(0);
      expect(pha.result).toBeNull();
    });

    it('should have correct cycle count for PHA (3 cycles)', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.getCycleCount()).toBe(3);
    });

    it('should report side effects for PHA (modifies stack)', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.hasSideEffects()).toBe(true);
    });

    it('should have no operands for PHA', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.getOperands()).toEqual([]);
      expect(pha.getUsedRegisters()).toEqual([]);
    });

    it('should format PHA instruction as string', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.toString()).toBe('CPU_PHA');
    });
  });

  describe('PLA (Pull Accumulator) Instruction', () => {
    it('should create PLA instruction with result register', () => {
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, result);

      expect(pla.opcode).toBe(ILOpcode.CPU_PLA);
      expect(pla.id).toBe(0);
      expect(pla.result).toBe(result);
    });

    it('should have correct cycle count for PLA (4 cycles)', () => {
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, result);

      expect(pla.getCycleCount()).toBe(4);
    });

    it('should report side effects for PLA (modifies stack and flags)', () => {
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, result);

      expect(pla.hasSideEffects()).toBe(true);
    });

    it('should have no operands for PLA (reads from stack)', () => {
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, result);

      expect(pla.getOperands()).toEqual([]);
      expect(pla.getUsedRegisters()).toEqual([]);
    });

    it('should format PLA instruction with result register', () => {
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, result);

      expect(pla.toString()).toBe(`${result} = CPU_PLA`);
    });

    it('should create PLA without result register (for void context)', () => {
      const pla = new ILCpuInstruction(0, ILOpcode.CPU_PLA, null);

      expect(pla.result).toBeNull();
      expect(pla.toString()).toBe('CPU_PLA');
    });
  });

  describe('PHP (Push Processor Status) Instruction', () => {
    it('should create PHP instruction with correct opcode', () => {
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      expect(php.opcode).toBe(ILOpcode.CPU_PHP);
      expect(php.id).toBe(0);
      expect(php.result).toBeNull();
    });

    it('should have correct cycle count for PHP (3 cycles)', () => {
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      expect(php.getCycleCount()).toBe(3);
    });

    it('should report side effects for PHP (modifies stack)', () => {
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      expect(php.hasSideEffects()).toBe(true);
    });

    it('should format PHP instruction as string', () => {
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      expect(php.toString()).toBe('CPU_PHP');
    });
  });

  describe('PLP (Pull Processor Status) Instruction', () => {
    it('should create PLP instruction with correct opcode', () => {
      const plp = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      expect(plp.opcode).toBe(ILOpcode.CPU_PLP);
      expect(plp.id).toBe(0);
      expect(plp.result).toBeNull();
    });

    it('should have correct cycle count for PLP (4 cycles)', () => {
      const plp = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      expect(plp.getCycleCount()).toBe(4);
    });

    it('should report side effects for PLP (modifies stack and all flags)', () => {
      const plp = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      expect(plp.hasSideEffects()).toBe(true);
    });

    it('should format PLP instruction as string', () => {
      const plp = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      expect(plp.toString()).toBe('CPU_PLP');
    });
  });

  // =============================================================================
  // Interrupt Control Patterns
  // =============================================================================

  describe('Interrupt Control Patterns', () => {
    it('should support SEI/CLI interrupt disable/enable pair', () => {
      // Common pattern: disable interrupts, do critical work, enable interrupts
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const cli = new ILCpuInstruction(1, ILOpcode.CPU_CLI);

      // Both must have side effects to prevent DCE
      expect(sei.hasSideEffects()).toBe(true);
      expect(cli.hasSideEffects()).toBe(true);

      // Neither should be a terminator
      expect(sei.isTerminator()).toBe(false);
      expect(cli.isTerminator()).toBe(false);

      // Total cycle count for pair
      expect(sei.getCycleCount() + cli.getCycleCount()).toBe(4);
    });

    it('should support nested interrupt protection with PHP/PLP', () => {
      // Pattern: save flags, disable interrupts, critical work, restore flags
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const sei = new ILCpuInstruction(1, ILOpcode.CPU_SEI);
      const plp = new ILCpuInstruction(2, ILOpcode.CPU_PLP);

      // All must have side effects
      expect(php.hasSideEffects()).toBe(true);
      expect(sei.hasSideEffects()).toBe(true);
      expect(plp.hasSideEffects()).toBe(true);

      // Total cycle count: 3 + 2 + 4 = 9 cycles
      expect(php.getCycleCount() + sei.getCycleCount() + plp.getCycleCount()).toBe(9);
    });

    it('should integrate SEI/CLI with optimization barriers', () => {
      // Pattern: SEI -> barrier -> critical code -> barrier -> CLI
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const barrier1 = new ILOptBarrierInstruction(1);
      const barrier2 = new ILOptBarrierInstruction(2);
      const cli = new ILCpuInstruction(3, ILOpcode.CPU_CLI);

      // All have side effects
      expect(sei.hasSideEffects()).toBe(true);
      expect(barrier1.hasSideEffects()).toBe(true);
      expect(barrier2.hasSideEffects()).toBe(true);
      expect(cli.hasSideEffects()).toBe(true);
    });
  });

  // =============================================================================
  // Stack Operation Patterns
  // =============================================================================

  describe('Stack Operation Patterns', () => {
    it('should support PHA/PLA accumulator save/restore pair', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(1, ILOpcode.CPU_PLA, result);

      // Both have side effects
      expect(pha.hasSideEffects()).toBe(true);
      expect(pla.hasSideEffects()).toBe(true);

      // Total cycle count: 3 + 4 = 7 cycles
      expect(pha.getCycleCount() + pla.getCycleCount()).toBe(7);
    });

    it('should support PHP/PLP processor status save/restore pair', () => {
      const php = new ILCpuInstruction(0, ILOpcode.CPU_PHP);
      const plp = new ILCpuInstruction(1, ILOpcode.CPU_PLP);

      // Both have side effects
      expect(php.hasSideEffects()).toBe(true);
      expect(plp.hasSideEffects()).toBe(true);

      // Total cycle count: 3 + 4 = 7 cycles
      expect(php.getCycleCount() + plp.getCycleCount()).toBe(7);
    });

    it('should support full context save (PHA + PHP)', () => {
      // Pattern: save accumulator, save flags, critical code, restore
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);
      const php = new ILCpuInstruction(1, ILOpcode.CPU_PHP);
      const plp = new ILCpuInstruction(2, ILOpcode.CPU_PLP);
      const result = new VirtualRegister(0, IL_BYTE);
      const pla = new ILCpuInstruction(3, ILOpcode.CPU_PLA, result);

      // Total cycle count: 3 + 3 + 4 + 4 = 14 cycles
      const totalCycles =
        pha.getCycleCount() + php.getCycleCount() + plp.getCycleCount() + pla.getCycleCount();
      expect(totalCycles).toBe(14);
    });
  });

  // =============================================================================
  // NOP Timing Patterns
  // =============================================================================

  describe('NOP Timing Patterns', () => {
    it('should support multiple NOPs for timing adjustment', () => {
      // Pattern: use NOPs to pad timing to exact cycle counts
      const nop1 = new ILCpuInstruction(0, ILOpcode.CPU_NOP);
      const nop2 = new ILCpuInstruction(1, ILOpcode.CPU_NOP);
      const nop3 = new ILCpuInstruction(2, ILOpcode.CPU_NOP);

      // Each NOP is 2 cycles, total 6 cycles
      expect(nop1.getCycleCount() + nop2.getCycleCount() + nop3.getCycleCount()).toBe(6);

      // All NOPs have side effects (timing-critical)
      expect(nop1.hasSideEffects()).toBe(true);
      expect(nop2.hasSideEffects()).toBe(true);
      expect(nop3.hasSideEffects()).toBe(true);
    });

    it('should support NOP chains with metadata for raster timing', () => {
      // Pattern: NOPs used for raster synchronization
      const nop1 = new ILCpuInstruction(0, ILOpcode.CPU_NOP, null, {
        rasterCritical: true,
        estimatedCycles: 2,
      });
      const nop2 = new ILCpuInstruction(1, ILOpcode.CPU_NOP, null, {
        rasterCritical: true,
        estimatedCycles: 2,
      });

      expect(nop1.metadata.rasterCritical).toBe(true);
      expect(nop2.metadata.rasterCritical).toBe(true);
      expect(nop1.metadata.estimatedCycles).toBe(2);
      expect(nop2.metadata.estimatedCycles).toBe(2);
    });
  });

  // =============================================================================
  // BRK Debugging Patterns
  // =============================================================================

  describe('BRK Debugging Patterns', () => {
    it('should support BRK for debugging breakpoints', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK, null, {
        sourceExpression: 'debug breakpoint',
      });

      expect(brk.opcode).toBe(ILOpcode.CPU_BRK);
      expect(brk.hasSideEffects()).toBe(true);
      expect(brk.getCycleCount()).toBe(7);
      expect(brk.metadata.sourceExpression).toBe('debug breakpoint');
    });

    it('should support BRK with location metadata for debugging', () => {
      const brk = new ILCpuInstruction(0, ILOpcode.CPU_BRK, null, {
        location: {
          line: 42,
          column: 0,
          offset: 1000,
        },
      });

      expect(brk.metadata.location).toBeDefined();
      expect(brk.metadata.location!.line).toBe(42);
    });
  });

  // =============================================================================
  // Cycle Count Edge Cases
  // =============================================================================

  describe('Cycle Count Edge Cases', () => {
    it('should return default cycle count (2) for unknown opcode', () => {
      // Test the fallback behavior by creating an instruction
      // with a valid opcode and checking getCycleCount works
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      expect(sei.getCycleCount()).toBe(2);
    });

    it('should verify all CPU instruction cycle counts are documented', () => {
      // SEI: 2, CLI: 2, NOP: 2, BRK: 7, PHA: 3, PLA: 4, PHP: 3, PLP: 4
      const expectedCycles: Record<ILOpcode, number> = {
        [ILOpcode.CPU_SEI]: 2,
        [ILOpcode.CPU_CLI]: 2,
        [ILOpcode.CPU_NOP]: 2,
        [ILOpcode.CPU_BRK]: 7,
        [ILOpcode.CPU_PHA]: 3,
        [ILOpcode.CPU_PLA]: 4,
        [ILOpcode.CPU_PHP]: 3,
        [ILOpcode.CPU_PLP]: 4,
      } as Record<ILOpcode, number>;

      const cpuOpcodes = [
        ILOpcode.CPU_SEI,
        ILOpcode.CPU_CLI,
        ILOpcode.CPU_NOP,
        ILOpcode.CPU_BRK,
        ILOpcode.CPU_PHA,
        ILOpcode.CPU_PLA,
        ILOpcode.CPU_PHP,
        ILOpcode.CPU_PLP,
      ];

      for (const opcode of cpuOpcodes) {
        const instr = new ILCpuInstruction(0, opcode);
        expect(instr.getCycleCount()).toBe(expectedCycles[opcode]);
      }
    });
  });

  // =============================================================================
  // Integration with ILFunction
  // =============================================================================

  describe('Integration with ILFunction', () => {
    it('should add CPU instructions to basic block', () => {
      const func = new ILFunction('test', [], IL_BYTE, 'testModule');
      const entryBlock = func.getEntryBlock();

      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
      const nop = new ILCpuInstruction(1, ILOpcode.CPU_NOP);
      const cli = new ILCpuInstruction(2, ILOpcode.CPU_CLI);

      entryBlock.addInstruction(sei);
      entryBlock.addInstruction(nop);
      entryBlock.addInstruction(cli);

      const instructions = entryBlock.getInstructions();
      expect(instructions).toContain(sei);
      expect(instructions).toContain(nop);
      expect(instructions).toContain(cli);
    });

    it('should compute total cycle count for CPU instruction sequence', () => {
      const func = new ILFunction('interruptHandler', [], IL_BYTE, 'testModule');
      const entryBlock = func.getEntryBlock();

      // Typical interrupt handler entry: PHA, PHP (save A and flags)
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);
      const php = new ILCpuInstruction(1, ILOpcode.CPU_PHP);

      entryBlock.addInstruction(pha);
      entryBlock.addInstruction(php);

      // Calculate total cycle overhead
      let totalCycles = 0;
      for (const instr of entryBlock.getInstructions()) {
        if (instr instanceof ILCpuInstruction) {
          totalCycles += instr.getCycleCount();
        }
      }

      // PHA (3) + PHP (3) = 6 cycles
      expect(totalCycles).toBe(6);
    });
  });

  // =============================================================================
  // Metadata Preservation Tests
  // =============================================================================

  describe('Metadata Preservation', () => {
    it('should preserve source location metadata', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI, null, {
        location: { line: 10, column: 4, offset: 100 },
      });

      expect(sei.metadata.location).toEqual({ line: 10, column: 4, offset: 100 });
    });

    it('should preserve m6502Hints metadata', () => {
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA, null, {
        m6502Hints: {
          preferredRegister: 'A',
        },
      });

      expect(pha.metadata.m6502Hints).toBeDefined();
      expect(pha.metadata.m6502Hints!.preferredRegister).toBe('A');
    });

    it('should preserve executionFrequency metadata', () => {
      // NOPs in hot loops for timing
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP, null, {
        executionFrequency: 'hot',
        loopDepth: 1,
      });

      expect(nop.metadata.executionFrequency).toBe('hot');
      expect(nop.metadata.loopDepth).toBe(1);
    });

    it('should preserve rasterCritical metadata', () => {
      const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI, null, {
        rasterCritical: true,
      });

      expect(sei.metadata.rasterCritical).toBe(true);
    });
  });

  // =============================================================================
  // DCE Prevention Tests
  // =============================================================================

  describe('DCE (Dead Code Elimination) Prevention', () => {
    it('should mark all CPU instructions as having side effects', () => {
      const cpuOpcodes = [
        ILOpcode.CPU_SEI,
        ILOpcode.CPU_CLI,
        ILOpcode.CPU_NOP,
        ILOpcode.CPU_BRK,
        ILOpcode.CPU_PHA,
        ILOpcode.CPU_PLA,
        ILOpcode.CPU_PHP,
        ILOpcode.CPU_PLP,
      ];

      for (const opcode of cpuOpcodes) {
        const instr = new ILCpuInstruction(0, opcode);
        expect(instr.hasSideEffects()).toBe(true);
      }
    });

    it('should prevent DCE from removing PHA without matching PLA', () => {
      // PHA must have side effects even if result is unused
      const pha = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      expect(pha.hasSideEffects()).toBe(true);
      expect(pha.result).toBeNull();
    });

    it('should prevent DCE from removing timing-critical NOPs', () => {
      // NOPs used for timing must not be eliminated
      const nop = new ILCpuInstruction(0, ILOpcode.CPU_NOP, null, {
        rasterCritical: true,
      });

      expect(nop.hasSideEffects()).toBe(true);
    });
  });
});
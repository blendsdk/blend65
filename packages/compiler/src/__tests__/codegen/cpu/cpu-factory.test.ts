/**
 * CPU Instruction Set Factory Tests
 *
 * Tests the factory function and type/constant exports.
 * Verifies correct instantiation of CPU strategy classes
 * based on target string.
 *
 * @module __tests__/codegen/cpu/cpu-factory
 */

import { describe, it, expect } from 'vitest';
import {
  createCpuInstructionSet,
  CpuInstructionSet,
  Cpu6502InstructionSet,
  Cpu65C02InstructionSet,
  DEFAULT_CPU_TARGET,
} from '../../../codegen/cpu/index.js';

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createCpuInstructionSet', () => {
  it('creates Cpu6502InstructionSet for "6502" target', () => {
    const cpu = createCpuInstructionSet('6502');
    expect(cpu).toBeInstanceOf(Cpu6502InstructionSet);
    expect(cpu.target).toBe('6502');
  });

  it('creates Cpu65C02InstructionSet for "65c02" target', () => {
    const cpu = createCpuInstructionSet('65c02');
    expect(cpu).toBeInstanceOf(Cpu65C02InstructionSet);
    expect(cpu.target).toBe('65c02');
  });

  it('returns instances that extend CpuInstructionSet', () => {
    const cpu6502 = createCpuInstructionSet('6502');
    const cpu65c02 = createCpuInstructionSet('65c02');

    // Both should be instances of the abstract base
    expect(cpu6502).toBeInstanceOf(CpuInstructionSet);
    expect(cpu65c02).toBeInstanceOf(CpuInstructionSet);
  });

  it('creates distinct instances on each call', () => {
    const cpu1 = createCpuInstructionSet('6502');
    const cpu2 = createCpuInstructionSet('6502');

    // Should be separate instances, not singletons
    expect(cpu1).not.toBe(cpu2);
    expect(cpu1.target).toBe(cpu2.target);
  });

  it('throws for unknown CPU target', () => {
    // Force an invalid target to test error handling
    expect(() => createCpuInstructionSet('z80' as any)).toThrow(
      'Unknown CPU target: z80'
    );
  });
});

// ============================================================================
// Default CPU Target Tests
// ============================================================================

describe('DEFAULT_CPU_TARGET', () => {
  it('defaults to 6502 for backward compatibility', () => {
    expect(DEFAULT_CPU_TARGET).toBe('6502');
  });

  it('can be used with the factory function', () => {
    const cpu = createCpuInstructionSet(DEFAULT_CPU_TARGET);
    expect(cpu).toBeInstanceOf(Cpu6502InstructionSet);
  });
});

// ============================================================================
// Target Property Tests
// ============================================================================

describe('CpuInstructionSet.target', () => {
  it('6502 target property is readonly and correct', () => {
    const cpu = createCpuInstructionSet('6502');
    expect(cpu.target).toBe('6502');
  });

  it('65c02 target property is readonly and correct', () => {
    const cpu = createCpuInstructionSet('65c02');
    expect(cpu.target).toBe('65c02');
  });
});

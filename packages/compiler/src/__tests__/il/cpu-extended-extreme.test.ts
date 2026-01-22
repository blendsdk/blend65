/**
 * CPU Extended Extreme Tests
 *
 * Session 14: Task 5a.2 - Comprehensive extreme edge case tests for CPU and Stack
 * intrinsic registry definitions.
 *
 * This session focuses on REGISTRY definitions (not ILCpuInstruction class which was
 * tested in Session 11). Tests cover:
 * - CPU intrinsics registry: sei, cli, nop, brk (IntrinsicCategory.CPU)
 * - Stack intrinsics registry: pha, pla, php, plp (IntrinsicCategory.Stack)
 * - Category filtering and consistency
 * - Signature validation (parameter types, return types)
 * - Properties validation (hasSideEffects, isBarrier, isVolatile, cycleCount)
 * - Documentation tests (descriptions)
 *
 * @module __tests__/il/cpu-extended-extreme
 */

import { describe, it, expect } from 'vitest';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import { ILOpcode } from '../../il/instructions.js';
import { IL_VOID, IL_BYTE } from '../../il/types.js';

// =============================================================================
// CPU Intrinsics Registry Tests (sei, cli, nop, brk)
// =============================================================================

describe('CPU Extended Extreme Tests', () => {
  describe('sei() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('sei')).toBe(true);
      expect(registry.get('sei')).toBeDefined();
    });

    it('should be in CPU category', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.category).toBe(IntrinsicCategory.CPU);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.parameterTypes).toEqual([]);
      expect(sei.parameterNames).toEqual([]);
      expect(sei.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_SEI opcode', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.opcode).toBe(ILOpcode.CPU_SEI);
    });

    it('should have side effects (modifies processor status)', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.hasSideEffects).toBe(true);
    });

    it('should be a barrier (implicit barrier for interrupt control)', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.isBarrier).toBe(true);
    });

    it('should not be volatile', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.isVolatile).toBe(false);
    });

    it('should have cycle count of 2', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.cycleCount).toBe(2);
    });

    it('should not be compile-time intrinsic', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.isCompileTime).toBe(false);
    });

    it('should have meaningful description', () => {
      const registry = new IntrinsicRegistry();
      const sei = registry.get('sei')!;

      expect(sei.description).toBeTruthy();
      expect(sei.description.toLowerCase()).toContain('interrupt');
    });
  });

  describe('cli() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('cli')).toBe(true);
      expect(registry.get('cli')).toBeDefined();
    });

    it('should be in CPU category', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.category).toBe(IntrinsicCategory.CPU);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.parameterTypes).toEqual([]);
      expect(cli.parameterNames).toEqual([]);
      expect(cli.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_CLI opcode', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.opcode).toBe(ILOpcode.CPU_CLI);
    });

    it('should have side effects (modifies processor status)', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.hasSideEffects).toBe(true);
    });

    it('should be a barrier (implicit barrier for interrupt control)', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.isBarrier).toBe(true);
    });

    it('should have cycle count of 2', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.cycleCount).toBe(2);
    });

    it('should have meaningful description', () => {
      const registry = new IntrinsicRegistry();
      const cli = registry.get('cli')!;

      expect(cli.description).toBeTruthy();
      expect(cli.description.toLowerCase()).toContain('interrupt');
    });
  });

  describe('nop() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('nop')).toBe(true);
      expect(registry.get('nop')).toBeDefined();
    });

    it('should be in CPU category', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.category).toBe(IntrinsicCategory.CPU);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.parameterTypes).toEqual([]);
      expect(nop.parameterNames).toEqual([]);
      expect(nop.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_NOP opcode', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.opcode).toBe(ILOpcode.CPU_NOP);
    });

    it('should have side effects (timing-critical, cannot be eliminated)', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.hasSideEffects).toBe(true);
    });

    it('should NOT be a barrier (just delays, does not prevent reordering)', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.isBarrier).toBe(false);
    });

    it('should have cycle count of 2', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.cycleCount).toBe(2);
    });

    it('should have meaningful description mentioning timing', () => {
      const registry = new IntrinsicRegistry();
      const nop = registry.get('nop')!;

      expect(nop.description).toBeTruthy();
      expect(nop.description.toLowerCase()).toContain('timing');
    });
  });

  describe('brk() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('brk')).toBe(true);
      expect(registry.get('brk')).toBeDefined();
    });

    it('should be in CPU category', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.category).toBe(IntrinsicCategory.CPU);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.parameterTypes).toEqual([]);
      expect(brk.parameterNames).toEqual([]);
      expect(brk.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_BRK opcode', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.opcode).toBe(ILOpcode.CPU_BRK);
    });

    it('should have side effects (triggers software interrupt)', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.hasSideEffects).toBe(true);
    });

    it('should be a barrier (implicit barrier for interrupt)', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.isBarrier).toBe(true);
    });

    it('should have cycle count of 7', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.cycleCount).toBe(7);
    });

    it('should have meaningful description', () => {
      const registry = new IntrinsicRegistry();
      const brk = registry.get('brk')!;

      expect(brk.description).toBeTruthy();
      expect(brk.description.toLowerCase()).toContain('interrupt');
    });
  });

  // =============================================================================
  // Stack Intrinsics Registry Tests (pha, pla, php, plp)
  // =============================================================================

  describe('pha() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('pha')).toBe(true);
      expect(registry.get('pha')).toBeDefined();
    });

    it('should be in Stack category', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.category).toBe(IntrinsicCategory.Stack);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.parameterTypes).toEqual([]);
      expect(pha.parameterNames).toEqual([]);
      expect(pha.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_PHA opcode', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.opcode).toBe(ILOpcode.CPU_PHA);
    });

    it('should have side effects (modifies stack)', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.hasSideEffects).toBe(true);
    });

    it('should NOT be a barrier', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.isBarrier).toBe(false);
    });

    it('should have cycle count of 3', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.cycleCount).toBe(3);
    });

    it('should have meaningful description mentioning stack', () => {
      const registry = new IntrinsicRegistry();
      const pha = registry.get('pha')!;

      expect(pha.description).toBeTruthy();
      expect(pha.description.toLowerCase()).toContain('stack');
    });
  });

  describe('pla() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('pla')).toBe(true);
      expect(registry.get('pla')).toBeDefined();
    });

    it('should be in Stack category', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.category).toBe(IntrinsicCategory.Stack);
    });

    it('should have byte return type (pulls accumulator value)', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.parameterTypes).toEqual([]);
      expect(pla.parameterNames).toEqual([]);
      expect(pla.returnType).toBe(IL_BYTE);
    });

    it('should map to CPU_PLA opcode', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.opcode).toBe(ILOpcode.CPU_PLA);
    });

    it('should have side effects (modifies stack and flags)', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.hasSideEffects).toBe(true);
    });

    it('should NOT be a barrier', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.isBarrier).toBe(false);
    });

    it('should have cycle count of 4', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.cycleCount).toBe(4);
    });

    it('should have meaningful description mentioning stack', () => {
      const registry = new IntrinsicRegistry();
      const pla = registry.get('pla')!;

      expect(pla.description).toBeTruthy();
      expect(pla.description.toLowerCase()).toContain('stack');
    });
  });

  describe('php() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('php')).toBe(true);
      expect(registry.get('php')).toBeDefined();
    });

    it('should be in Stack category', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.category).toBe(IntrinsicCategory.Stack);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.parameterTypes).toEqual([]);
      expect(php.parameterNames).toEqual([]);
      expect(php.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_PHP opcode', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.opcode).toBe(ILOpcode.CPU_PHP);
    });

    it('should have side effects (modifies stack)', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.hasSideEffects).toBe(true);
    });

    it('should NOT be a barrier', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.isBarrier).toBe(false);
    });

    it('should have cycle count of 3', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.cycleCount).toBe(3);
    });

    it('should have meaningful description mentioning processor status', () => {
      const registry = new IntrinsicRegistry();
      const php = registry.get('php')!;

      expect(php.description).toBeTruthy();
      expect(php.description.toLowerCase()).toContain('status');
    });
  });

  describe('plp() Registry Definition', () => {
    it('should be registered in the intrinsic registry', () => {
      const registry = new IntrinsicRegistry();

      expect(registry.isIntrinsic('plp')).toBe(true);
      expect(registry.get('plp')).toBeDefined();
    });

    it('should be in Stack category', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.category).toBe(IntrinsicCategory.Stack);
    });

    it('should have void signature (no parameters, void return)', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.parameterTypes).toEqual([]);
      expect(plp.parameterNames).toEqual([]);
      expect(plp.returnType).toBe(IL_VOID);
    });

    it('should map to CPU_PLP opcode', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.opcode).toBe(ILOpcode.CPU_PLP);
    });

    it('should have side effects (modifies stack and all flags)', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.hasSideEffects).toBe(true);
    });

    it('should be a barrier (modifies processor flags)', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.isBarrier).toBe(true);
    });

    it('should have cycle count of 4', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.cycleCount).toBe(4);
    });

    it('should have meaningful description mentioning processor status', () => {
      const registry = new IntrinsicRegistry();
      const plp = registry.get('plp')!;

      expect(plp.description).toBeTruthy();
      expect(plp.description.toLowerCase()).toContain('status');
    });
  });

  // =============================================================================
  // Category Filtering Tests
  // =============================================================================

  describe('Category Filtering', () => {
    it('should return all CPU intrinsics via getByCategory', () => {
      const registry = new IntrinsicRegistry();
      const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);

      const names = cpuIntrinsics.map((i) => i.name);
      expect(names).toContain('sei');
      expect(names).toContain('cli');
      expect(names).toContain('nop');
      expect(names).toContain('brk');
      expect(cpuIntrinsics.length).toBe(4);
    });

    it('should return all Stack intrinsics via getByCategory', () => {
      const registry = new IntrinsicRegistry();
      const stackIntrinsics = registry.getByCategory(IntrinsicCategory.Stack);

      const names = stackIntrinsics.map((i) => i.name);
      expect(names).toContain('pha');
      expect(names).toContain('pla');
      expect(names).toContain('php');
      expect(names).toContain('plp');
      expect(stackIntrinsics.length).toBe(4);
    });

    it('should have CPU and Stack as distinct categories', () => {
      const registry = new IntrinsicRegistry();
      const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);
      const stackIntrinsics = registry.getByCategory(IntrinsicCategory.Stack);

      // No overlap between categories
      const cpuNames = new Set(cpuIntrinsics.map((i) => i.name));
      const stackNames = new Set(stackIntrinsics.map((i) => i.name));

      for (const name of cpuNames) {
        expect(stackNames.has(name)).toBe(false);
      }
    });
  });

  // =============================================================================
  // Category Consistency Tests
  // =============================================================================

  describe('Category Consistency', () => {
    it('should have all CPU intrinsics with hasSideEffects=true', () => {
      const registry = new IntrinsicRegistry();
      const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);

      for (const intrinsic of cpuIntrinsics) {
        expect(intrinsic.hasSideEffects).toBe(true);
      }
    });

    it('should have all Stack intrinsics with hasSideEffects=true', () => {
      const registry = new IntrinsicRegistry();
      const stackIntrinsics = registry.getByCategory(IntrinsicCategory.Stack);

      for (const intrinsic of stackIntrinsics) {
        expect(intrinsic.hasSideEffects).toBe(true);
      }
    });

    it('should have all CPU/Stack intrinsics as non-compile-time', () => {
      const registry = new IntrinsicRegistry();
      const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);
      const stackIntrinsics = registry.getByCategory(IntrinsicCategory.Stack);

      for (const intrinsic of [...cpuIntrinsics, ...stackIntrinsics]) {
        expect(intrinsic.isCompileTime).toBe(false);
      }
    });

    it('should have all CPU/Stack intrinsics with valid opcodes', () => {
      const registry = new IntrinsicRegistry();
      const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);
      const stackIntrinsics = registry.getByCategory(IntrinsicCategory.Stack);

      for (const intrinsic of [...cpuIntrinsics, ...stackIntrinsics]) {
        expect(intrinsic.opcode).not.toBeNull();
      }
    });
  });

  // =============================================================================
  // Global Registry Tests
  // =============================================================================

  describe('Global Registry (INTRINSIC_REGISTRY)', () => {
    it('should have all CPU intrinsics available in global registry', () => {
      expect(INTRINSIC_REGISTRY.isIntrinsic('sei')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('cli')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('nop')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('brk')).toBe(true);
    });

    it('should have all Stack intrinsics available in global registry', () => {
      expect(INTRINSIC_REGISTRY.isIntrinsic('pha')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('pla')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('php')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('plp')).toBe(true);
    });
  });
});
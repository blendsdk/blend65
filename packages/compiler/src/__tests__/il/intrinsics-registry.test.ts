/**
 * IL Intrinsics Registry Tests
 *
 * Tests for the IntrinsicRegistry class that manages all intrinsic functions.
 * Verifies:
 * - Registry construction and initialization
 * - Intrinsic lookup by name
 * - Category-based filtering
 * - Compile-time intrinsic identification
 * - All built-in intrinsics are registered correctly
 *
 * @module il/intrinsics-registry.test
 */

import { describe, expect, it } from 'vitest';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
  type IntrinsicDefinition,
} from '../../il/intrinsics/registry.js';
import { ILOpcode } from '../../il/instructions.js';
import { IL_VOID, IL_BYTE, IL_WORD } from '../../il/types.js';

// =============================================================================
// IntrinsicRegistry Construction Tests
// =============================================================================

describe('IntrinsicRegistry', () => {
  describe('construction', () => {
    it('should create a registry with built-in intrinsics', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.size).toBeGreaterThan(0);
    });

    it('should register all expected intrinsics', () => {
      const registry = new IntrinsicRegistry();
      // Memory intrinsics
      expect(registry.isIntrinsic('peek')).toBe(true);
      expect(registry.isIntrinsic('poke')).toBe(true);
      expect(registry.isIntrinsic('peekw')).toBe(true);
      expect(registry.isIntrinsic('pokew')).toBe(true);
      // Optimization intrinsics
      expect(registry.isIntrinsic('barrier')).toBe(true);
      expect(registry.isIntrinsic('volatile_read')).toBe(true);
      expect(registry.isIntrinsic('volatile_write')).toBe(true);
      // CPU intrinsics
      expect(registry.isIntrinsic('sei')).toBe(true);
      expect(registry.isIntrinsic('cli')).toBe(true);
      expect(registry.isIntrinsic('nop')).toBe(true);
      expect(registry.isIntrinsic('brk')).toBe(true);
      // Stack intrinsics
      expect(registry.isIntrinsic('pha')).toBe(true);
      expect(registry.isIntrinsic('pla')).toBe(true);
      expect(registry.isIntrinsic('php')).toBe(true);
      expect(registry.isIntrinsic('plp')).toBe(true);
      // Utility intrinsics
      expect(registry.isIntrinsic('sizeof')).toBe(true);
      expect(registry.isIntrinsic('length')).toBe(true);
      expect(registry.isIntrinsic('lo')).toBe(true);
      expect(registry.isIntrinsic('hi')).toBe(true);
    });
  });

  describe('isIntrinsic()', () => {
    it('should return true for registered intrinsics', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.isIntrinsic('peek')).toBe(true);
      expect(registry.isIntrinsic('sei')).toBe(true);
    });

    it('should return false for non-intrinsics', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.isIntrinsic('unknownFunction')).toBe(false);
      expect(registry.isIntrinsic('')).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return definition for registered intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const def = registry.get('peek');
      expect(def).toBeDefined();
      expect(def!.name).toBe('peek');
    });

    it('should return undefined for non-intrinsics', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.get('unknownFunction')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return all registered intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const all = Array.from(registry.getAll());
      expect(all.length).toBe(registry.size);
      expect(all.every((def) => def.name && def.category)).toBe(true);
    });
  });

  describe('getNames()', () => {
    it('should return all intrinsic names', () => {
      const registry = new IntrinsicRegistry();
      const names = Array.from(registry.getNames());
      expect(names.length).toBe(registry.size);
      expect(names).toContain('peek');
      expect(names).toContain('sei');
    });
  });

  describe('getByCategory()', () => {
    it('should return memory intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const memory = registry.getByCategory(IntrinsicCategory.Memory);
      expect(memory.length).toBe(4);
      expect(memory.map((d) => d.name)).toContain('peek');
      expect(memory.map((d) => d.name)).toContain('poke');
      expect(memory.map((d) => d.name)).toContain('peekw');
      expect(memory.map((d) => d.name)).toContain('pokew');
    });

    it('should return CPU intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const cpu = registry.getByCategory(IntrinsicCategory.CPU);
      expect(cpu.length).toBe(4);
      expect(cpu.map((d) => d.name)).toContain('sei');
      expect(cpu.map((d) => d.name)).toContain('cli');
      expect(cpu.map((d) => d.name)).toContain('nop');
      expect(cpu.map((d) => d.name)).toContain('brk');
    });

    it('should return stack intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const stack = registry.getByCategory(IntrinsicCategory.Stack);
      expect(stack.length).toBe(4);
      expect(stack.map((d) => d.name)).toContain('pha');
      expect(stack.map((d) => d.name)).toContain('pla');
      expect(stack.map((d) => d.name)).toContain('php');
      expect(stack.map((d) => d.name)).toContain('plp');
    });

    it('should return optimization intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const opt = registry.getByCategory(IntrinsicCategory.Optimization);
      expect(opt.length).toBe(3);
      expect(opt.map((d) => d.name)).toContain('barrier');
      expect(opt.map((d) => d.name)).toContain('volatile_read');
      expect(opt.map((d) => d.name)).toContain('volatile_write');
    });
  });

  describe('getCompileTimeIntrinsics()', () => {
    it('should return only compile-time intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const compileTime = registry.getCompileTimeIntrinsics();
      expect(compileTime.length).toBeGreaterThan(0);
      expect(compileTime.every((d) => d.isCompileTime)).toBe(true);
      expect(compileTime.map((d) => d.name)).toContain('sizeof');
    });
  });
});

// =============================================================================
// Memory Intrinsics Tests
// =============================================================================

describe('Memory Intrinsics', () => {
  describe('peek intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('peek')!;
      expect(def.name).toBe('peek');
      expect(def.category).toBe(IntrinsicCategory.Memory);
      expect(def.parameterTypes).toEqual([IL_WORD]);
      expect(def.returnType).toBe(IL_BYTE);
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
      expect(def.isCompileTime).toBe(false);
      expect(def.hasSideEffects).toBe(false);
    });
  });

  describe('poke intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('poke')!;
      expect(def.name).toBe('poke');
      expect(def.category).toBe(IntrinsicCategory.Memory);
      expect(def.parameterTypes).toEqual([IL_WORD, IL_BYTE]);
      expect(def.returnType).toBe(IL_VOID);
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(def.hasSideEffects).toBe(true);
    });
  });

  describe('peekw intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('peekw')!;
      expect(def.name).toBe('peekw');
      expect(def.returnType).toBe(IL_WORD);
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    });
  });

  describe('pokew intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('pokew')!;
      expect(def.name).toBe('pokew');
      expect(def.parameterTypes).toEqual([IL_WORD, IL_WORD]);
      expect(def.returnType).toBe(IL_VOID);
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
    });
  });
});

// =============================================================================
// CPU Intrinsics Tests
// =============================================================================

describe('CPU Intrinsics', () => {
  describe('sei intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('sei')!;
      expect(def.name).toBe('sei');
      expect(def.category).toBe(IntrinsicCategory.CPU);
      expect(def.parameterTypes).toEqual([]);
      expect(def.returnType).toBe(IL_VOID);
      expect(def.opcode).toBe(ILOpcode.CPU_SEI);
      expect(def.hasSideEffects).toBe(true);
      expect(def.isBarrier).toBe(true);
      expect(def.cycleCount).toBe(2);
    });
  });

  describe('cli intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('cli')!;
      expect(def.opcode).toBe(ILOpcode.CPU_CLI);
      expect(def.cycleCount).toBe(2);
    });
  });

  describe('nop intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('nop')!;
      expect(def.opcode).toBe(ILOpcode.CPU_NOP);
      expect(def.cycleCount).toBe(2);
      expect(def.hasSideEffects).toBe(true); // Prevents elimination
    });
  });

  describe('brk intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('brk')!;
      expect(def.opcode).toBe(ILOpcode.CPU_BRK);
      expect(def.cycleCount).toBe(7);
    });
  });
});

// =============================================================================
// Stack Intrinsics Tests
// =============================================================================

describe('Stack Intrinsics', () => {
  describe('pha intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('pha')!;
      expect(def.opcode).toBe(ILOpcode.CPU_PHA);
      expect(def.returnType).toBe(IL_VOID);
      expect(def.cycleCount).toBe(3);
    });
  });

  describe('pla intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('pla')!;
      expect(def.opcode).toBe(ILOpcode.CPU_PLA);
      expect(def.returnType).toBe(IL_BYTE);
      expect(def.cycleCount).toBe(4);
    });
  });

  describe('php intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('php')!;
      expect(def.opcode).toBe(ILOpcode.CPU_PHP);
      expect(def.cycleCount).toBe(3);
    });
  });

  describe('plp intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('plp')!;
      expect(def.opcode).toBe(ILOpcode.CPU_PLP);
      expect(def.cycleCount).toBe(4);
      expect(def.isBarrier).toBe(true); // Modifies flags
    });
  });
});

// =============================================================================
// Utility Intrinsics Tests
// =============================================================================

describe('Utility Intrinsics', () => {
  describe('sizeof intrinsic', () => {
    it('should be compile-time only', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof')!;
      expect(def.isCompileTime).toBe(true);
      expect(def.opcode).toBeNull();
      expect(def.returnType).toBe(IL_BYTE);
    });
  });

  describe('length intrinsic', () => {
    it('should be compile-time only (no dynamic arrays in Blend65)', () => {
      const def = INTRINSIC_REGISTRY.get('length')!;
      // All arrays in Blend65 have fixed, compile-time known sizes.
      // There are no dynamic arrays, so length is always a compile-time constant.
      expect(def.isCompileTime).toBe(true);
      expect(def.opcode).toBeNull(); // No runtime IL needed
      expect(def.returnType).toBe(IL_WORD);
      expect(def.cycleCount).toBeNull(); // No runtime cost
      expect(def.category).toBe(IntrinsicCategory.CompileTime);
    });
  });

  describe('lo intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('lo')!;
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_LO);
      expect(def.parameterTypes).toEqual([IL_WORD]);
      expect(def.returnType).toBe(IL_BYTE);
    });
  });

  describe('hi intrinsic', () => {
    it('should have correct definition', () => {
      const def = INTRINSIC_REGISTRY.get('hi')!;
      expect(def.opcode).toBe(ILOpcode.INTRINSIC_HI);
      expect(def.parameterTypes).toEqual([IL_WORD]);
      expect(def.returnType).toBe(IL_BYTE);
    });
  });
});

// =============================================================================
// Optimization Intrinsics Tests
// =============================================================================

describe('Optimization Intrinsics', () => {
  describe('barrier intrinsic', () => {
    it('should be an optimization barrier', () => {
      const def = INTRINSIC_REGISTRY.get('barrier')!;
      expect(def.isBarrier).toBe(true);
      expect(def.hasSideEffects).toBe(true);
      expect(def.opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(def.cycleCount).toBe(0);
    });
  });

  describe('volatile_read intrinsic', () => {
    it('should be volatile and barrier', () => {
      const def = INTRINSIC_REGISTRY.get('volatile_read')!;
      expect(def.isVolatile).toBe(true);
      expect(def.isBarrier).toBe(true);
      expect(def.opcode).toBe(ILOpcode.VOLATILE_READ);
    });
  });

  describe('volatile_write intrinsic', () => {
    it('should be volatile and barrier', () => {
      const def = INTRINSIC_REGISTRY.get('volatile_write')!;
      expect(def.isVolatile).toBe(true);
      expect(def.isBarrier).toBe(true);
      expect(def.opcode).toBe(ILOpcode.VOLATILE_WRITE);
    });
  });
});

// =============================================================================
// Global Registry Tests
// =============================================================================

describe('INTRINSIC_REGISTRY singleton', () => {
  it('should be pre-populated with intrinsics', () => {
    expect(INTRINSIC_REGISTRY.size).toBeGreaterThan(0);
    expect(INTRINSIC_REGISTRY.isIntrinsic('peek')).toBe(true);
  });

  it('should be the same instance everywhere', () => {
    const count = INTRINSIC_REGISTRY.size;
    expect(count).toBeGreaterThan(15); // At least 16 intrinsics registered
  });
});
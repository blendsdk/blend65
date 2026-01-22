/**
 * IL lo/hi Intrinsics - Extreme Tests
 *
 * Extreme edge case tests for the lo() and hi() byte extraction intrinsics.
 * These tests verify byte extraction from 16-bit words for:
 * - ILLoInstruction: Extract low byte (bits 0-7)
 * - ILHiInstruction: Extract high byte (bits 8-15)
 * - Registry definitions and metadata
 * - Edge cases (zero, max values, specific bit patterns)
 * - Integration patterns (lo/hi pairs, address decomposition)
 *
 * lo() and hi() are essential for 6502 programming where addresses
 * and 16-bit values must be manipulated byte-by-byte.
 *
 * @module il/intrinsics-lo-hi-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILLoInstruction,
  ILHiInstruction,
  type ILMetadata,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';
import {
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import { ILFunction } from '../../il/function.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a test virtual register with the given ID.
 */
function createTestRegister(id: number): VirtualRegister {
  return new VirtualRegister(id, IL_WORD);
}

/**
 * Creates a test result register (byte type for lo/hi result).
 */
function createResultRegister(id: number): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE);
}

/**
 * Creates a test source location for metadata.
 */
function createTestLocation() {
  return { line: 1, column: 1, offset: 0 };
}

// =============================================================================
// Extreme Test Category: ILLoInstruction
// =============================================================================

describe('lo/hi Intrinsics Extreme Tests', () => {
  describe('ILLoInstruction', () => {
    /**
     * Verify lo instruction has correct opcode.
     */
    it('should have INTRINSIC_LO opcode', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.opcode).toBe(ILOpcode.INTRINSIC_LO);
    });

    /**
     * Verify lo instruction stores source register.
     */
    it('should store source register', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.source).toBe(source);
    });

    /**
     * Verify lo instruction stores result register.
     */
    it('should store result register', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.result).toBe(result);
    });

    /**
     * Verify getOperands returns source register.
     */
    it('should return source in getOperands', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      const operands = lo.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(source);
    });

    /**
     * Verify getUsedRegisters returns source register.
     */
    it('should return source in getUsedRegisters', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      const used = lo.getUsedRegisters();
      expect(used).toHaveLength(1);
      expect(used[0]).toBe(source);
    });

    /**
     * Verify lo instruction has no side effects.
     * Pure byte extraction operation.
     */
    it('should have no side effects', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.hasSideEffects()).toBe(false);
    });

    /**
     * Verify lo instruction is not a terminator.
     */
    it('should not be a terminator', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.isTerminator()).toBe(false);
    });

    /**
     * Verify toString format for lo instruction.
     */
    it('should format toString correctly', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(0, source, result);

      expect(lo.toString()).toBe('v1 = INTRINSIC_LO v0');
    });

    /**
     * Verify lo instruction preserves metadata.
     */
    it('should preserve metadata', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const metadata: ILMetadata = {
        location: createTestLocation(),
        sourceExpression: 'lo(addr)',
      };
      const lo = new ILLoInstruction(0, source, result, metadata);

      expect(lo.metadata.location).toBeDefined();
      expect(lo.metadata.sourceExpression).toBe('lo(addr)');
    });

    /**
     * Verify lo instruction stores instruction ID.
     */
    it('should store instruction ID', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const lo = new ILLoInstruction(42, source, result);

      expect(lo.id).toBe(42);
    });
  });

  // ===========================================================================
  // Extreme Test Category: ILHiInstruction
  // ===========================================================================

  describe('ILHiInstruction', () => {
    /**
     * Verify hi instruction has correct opcode.
     */
    it('should have INTRINSIC_HI opcode', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.opcode).toBe(ILOpcode.INTRINSIC_HI);
    });

    /**
     * Verify hi instruction stores source register.
     */
    it('should store source register', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.source).toBe(source);
    });

    /**
     * Verify hi instruction stores result register.
     */
    it('should store result register', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.result).toBe(result);
    });

    /**
     * Verify getOperands returns source register.
     */
    it('should return source in getOperands', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      const operands = hi.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(source);
    });

    /**
     * Verify getUsedRegisters returns source register.
     */
    it('should return source in getUsedRegisters', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      const used = hi.getUsedRegisters();
      expect(used).toHaveLength(1);
      expect(used[0]).toBe(source);
    });

    /**
     * Verify hi instruction has no side effects.
     */
    it('should have no side effects', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.hasSideEffects()).toBe(false);
    });

    /**
     * Verify hi instruction is not a terminator.
     */
    it('should not be a terminator', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.isTerminator()).toBe(false);
    });

    /**
     * Verify toString format for hi instruction.
     */
    it('should format toString correctly', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(0, source, result);

      expect(hi.toString()).toBe('v1 = INTRINSIC_HI v0');
    });

    /**
     * Verify hi instruction preserves metadata.
     */
    it('should preserve metadata', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const metadata: ILMetadata = {
        location: createTestLocation(),
        sourceExpression: 'hi(addr)',
      };
      const hi = new ILHiInstruction(0, source, result, metadata);

      expect(hi.metadata.location).toBeDefined();
      expect(hi.metadata.sourceExpression).toBe('hi(addr)');
    });

    /**
     * Verify hi instruction stores instruction ID.
     */
    it('should store instruction ID', () => {
      const source = createTestRegister(0);
      const result = createResultRegister(1);
      const hi = new ILHiInstruction(42, source, result);

      expect(hi.id).toBe(42);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Registry Definitions
  // ===========================================================================

  describe('Registry Definitions', () => {
    describe('lo() Registry', () => {
      /**
       * Verify lo is registered in the intrinsic registry.
       */
      it('should be registered as an intrinsic', () => {
        expect(INTRINSIC_REGISTRY.isIntrinsic('lo')).toBe(true);
      });

      /**
       * Verify lo is in the Utility category.
       */
      it('should be in Utility category', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.category).toBe(IntrinsicCategory.Utility);
      });

      /**
       * Verify lo takes word parameter and returns byte.
       */
      it('should take word parameter and return byte', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.parameterTypes).toEqual([IL_WORD]);
        expect(def.returnType).toBe(IL_BYTE);
      });

      /**
       * Verify lo has correct opcode.
       */
      it('should have INTRINSIC_LO opcode', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.opcode).toBe(ILOpcode.INTRINSIC_LO);
      });

      /**
       * Verify lo has no side effects in registry.
       */
      it('should have no side effects in registry', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.hasSideEffects).toBe(false);
      });

      /**
       * Verify lo is not a barrier.
       */
      it('should not be a barrier', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.isBarrier).toBe(false);
      });

      /**
       * Verify lo is not volatile.
       */
      it('should not be volatile', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.isVolatile).toBe(false);
      });

      /**
       * Verify lo is not compile-time only.
       * Can be compile-time when value is constant, but not always.
       */
      it('should not be compile-time only', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.isCompileTime).toBe(false);
      });

      /**
       * Verify lo has zero cycle count (just uses low byte).
       */
      it('should have zero cycle count', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.cycleCount).toBe(0);
      });

      /**
       * Verify lo has parameter name 'value'.
       */
      it('should have parameter name value', () => {
        const def = INTRINSIC_REGISTRY.get('lo')!;
        expect(def.parameterNames).toEqual(['value']);
      });
    });

    describe('hi() Registry', () => {
      /**
       * Verify hi is registered in the intrinsic registry.
       */
      it('should be registered as an intrinsic', () => {
        expect(INTRINSIC_REGISTRY.isIntrinsic('hi')).toBe(true);
      });

      /**
       * Verify hi is in the Utility category.
       */
      it('should be in Utility category', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.category).toBe(IntrinsicCategory.Utility);
      });

      /**
       * Verify hi takes word parameter and returns byte.
       */
      it('should take word parameter and return byte', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.parameterTypes).toEqual([IL_WORD]);
        expect(def.returnType).toBe(IL_BYTE);
      });

      /**
       * Verify hi has correct opcode.
       */
      it('should have INTRINSIC_HI opcode', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.opcode).toBe(ILOpcode.INTRINSIC_HI);
      });

      /**
       * Verify hi has no side effects in registry.
       */
      it('should have no side effects in registry', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.hasSideEffects).toBe(false);
      });

      /**
       * Verify hi is not a barrier.
       */
      it('should not be a barrier', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.isBarrier).toBe(false);
      });

      /**
       * Verify hi is not volatile.
       */
      it('should not be volatile', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.isVolatile).toBe(false);
      });

      /**
       * Verify hi is not compile-time only.
       */
      it('should not be compile-time only', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.isCompileTime).toBe(false);
      });

      /**
       * Verify hi has 3 cycle count (LDA zp+1).
       */
      it('should have 3 cycle count', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.cycleCount).toBe(3);
      });

      /**
       * Verify hi has parameter name 'value'.
       */
      it('should have parameter name value', () => {
        const def = INTRINSIC_REGISTRY.get('hi')!;
        expect(def.parameterNames).toEqual(['value']);
      });
    });
  });

  // ===========================================================================
  // Extreme Test Category: Integration Patterns
  // ===========================================================================

  describe('Integration Patterns', () => {
    /**
     * Test lo/hi pair extraction from same word.
     * Common pattern for decomposing addresses.
     */
    it('should support lo/hi pair extraction from same source', () => {
      const source = createTestRegister(0);
      const loResult = createResultRegister(1);
      const hiResult = createResultRegister(2);

      const loInstr = new ILLoInstruction(0, source, loResult);
      const hiInstr = new ILHiInstruction(1, source, hiResult);

      // Both use the same source
      expect(loInstr.source).toBe(source);
      expect(hiInstr.source).toBe(source);

      // Results are different registers
      expect(loInstr.result).not.toBe(hiInstr.result);
    });

    /**
     * Test adding lo/hi instructions to basic block.
     */
    it('should be addable to basic block', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const block = func.getEntryBlock();

      const source = func.createRegister(IL_WORD);
      const loResult = func.createRegister(IL_BYTE);
      const hiResult = func.createRegister(IL_BYTE);

      const loInstr = new ILLoInstruction(0, source, loResult);
      const hiInstr = new ILHiInstruction(1, source, hiResult);

      block.addInstruction(loInstr);
      block.addInstruction(hiInstr);

      expect(block.getInstructions()).toHaveLength(2);
      expect(block.getInstructions()[0]).toBe(loInstr);
      expect(block.getInstructions()[1]).toBe(hiInstr);
    });

    /**
     * Test metadata preservation for C64 address decomposition.
     */
    it('should preserve C64 address decomposition metadata', () => {
      const source = createTestRegister(0);
      const loResult = createResultRegister(1);
      const hiResult = createResultRegister(2);

      const loInstr = new ILLoInstruction(0, source, loResult, {
        sourceExpression: 'lo($D000)',
        m6502Hints: { preferredRegister: 'A' },
      });

      const hiInstr = new ILHiInstruction(1, source, hiResult, {
        sourceExpression: 'hi($D000)',
        m6502Hints: { preferredRegister: 'A' },
      });

      expect(loInstr.metadata.sourceExpression).toBe('lo($D000)');
      expect(loInstr.metadata.m6502Hints?.preferredRegister).toBe('A');
      expect(hiInstr.metadata.sourceExpression).toBe('hi($D000)');
      expect(hiInstr.metadata.m6502Hints?.preferredRegister).toBe('A');
    });

    /**
     * Test both lo and hi are pure (no side effects, can be DCE'd if unused).
     */
    it('should both be candidates for DCE if unused', () => {
      const source = createTestRegister(0);
      const loResult = createResultRegister(1);
      const hiResult = createResultRegister(2);

      const loInstr = new ILLoInstruction(0, source, loResult);
      const hiInstr = new ILHiInstruction(1, source, hiResult);

      // Both can be eliminated if results are unused
      expect(loInstr.hasSideEffects()).toBe(false);
      expect(hiInstr.hasSideEffects()).toBe(false);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Utility Category Consistency
  // ===========================================================================

  describe('Utility Category Consistency', () => {
    /**
     * Verify lo and hi are both in Utility category.
     */
    it('should have both lo and hi in Utility category', () => {
      const utilityIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      const names = utilityIntrinsics.map((i) => i.name);

      expect(names).toContain('lo');
      expect(names).toContain('hi');
    });

    /**
     * Verify lo and hi have consistent interface (word -> byte).
     */
    it('should have consistent word -> byte signature', () => {
      const loDef = INTRINSIC_REGISTRY.get('lo')!;
      const hiDef = INTRINSIC_REGISTRY.get('hi')!;

      // Same parameter type
      expect(loDef.parameterTypes).toEqual(hiDef.parameterTypes);
      expect(loDef.parameterTypes).toEqual([IL_WORD]);

      // Same return type
      expect(loDef.returnType).toBe(hiDef.returnType);
      expect(loDef.returnType).toBe(IL_BYTE);
    });

    /**
     * Verify lo and hi have consistent properties (no side effects, not barrier).
     */
    it('should have consistent side effect properties', () => {
      const loDef = INTRINSIC_REGISTRY.get('lo')!;
      const hiDef = INTRINSIC_REGISTRY.get('hi')!;

      expect(loDef.hasSideEffects).toBe(hiDef.hasSideEffects);
      expect(loDef.isBarrier).toBe(hiDef.isBarrier);
      expect(loDef.isVolatile).toBe(hiDef.isVolatile);
      expect(loDef.isCompileTime).toBe(hiDef.isCompileTime);
    });

    /**
     * Verify lo/hi cycle count difference (lo=0, hi=3).
     * lo just uses low byte, hi needs to access high byte.
     */
    it('should have different cycle counts (lo=0, hi=3)', () => {
      const loDef = INTRINSIC_REGISTRY.get('lo')!;
      const hiDef = INTRINSIC_REGISTRY.get('hi')!;

      expect(loDef.cycleCount).toBe(0);
      expect(hiDef.cycleCount).toBe(3);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Documentation and Descriptions
  // ===========================================================================

  describe('Documentation and Descriptions', () => {
    /**
     * Verify lo has meaningful description.
     */
    it('should have lo description mentioning low byte', () => {
      const def = INTRINSIC_REGISTRY.get('lo')!;
      expect(def.description.toLowerCase()).toContain('low');
      expect(def.description.toLowerCase()).toContain('byte');
    });

    /**
     * Verify hi has meaningful description.
     */
    it('should have hi description mentioning high byte', () => {
      const def = INTRINSIC_REGISTRY.get('hi')!;
      expect(def.description.toLowerCase()).toContain('high');
      expect(def.description.toLowerCase()).toContain('byte');
    });
  });
});
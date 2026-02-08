/**
 * IL Optimization Control Intrinsics - Extreme Tests
 *
 * Extreme edge case tests for optimization control intrinsics:
 * - barrier(): OPT_BARRIER - prevents instruction reordering
 * - volatile_read(): VOLATILE_READ - read that cannot be eliminated
 * - volatile_write(): VOLATILE_WRITE - write that cannot be eliminated
 *
 * These intrinsics are critical for timing-critical code and hardware access.
 *
 * @module il/opt-control-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILOptBarrierInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
  type ILMetadata,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';
import {
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import { ILFunction } from '../../il/function.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a test virtual register with the given ID and type.
 */
function createWordRegister(id: number): VirtualRegister {
  return new VirtualRegister(id, IL_WORD);
}

/**
 * Creates a test byte register.
 */
function createByteRegister(id: number): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE);
}

/**
 * Creates a test source location for metadata.
 */
function createTestLocation() {
  return { line: 1, column: 1, offset: 0 };
}

// =============================================================================
// Extreme Test Category: ILOptBarrierInstruction
// =============================================================================

describe('Optimization Control Extreme Tests', () => {
  describe('ILOptBarrierInstruction', () => {
    /**
     * Verify barrier instruction has correct opcode.
     */
    it('should have OPT_BARRIER opcode', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.opcode).toBe(ILOpcode.OPT_BARRIER);
    });

    /**
     * Verify barrier instruction has no result register.
     */
    it('should have no result register (void)', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.result).toBeNull();
    });

    /**
     * Verify barrier instruction has no operands.
     */
    it('should have no operands', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.getOperands()).toHaveLength(0);
    });

    /**
     * Verify barrier instruction uses no registers.
     */
    it('should use no registers', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.getUsedRegisters()).toHaveLength(0);
    });

    /**
     * Verify barrier instruction has side effects (prevents DCE).
     */
    it('should have side effects to prevent DCE', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.hasSideEffects()).toBe(true);
    });

    /**
     * Verify barrier instruction is not a terminator.
     */
    it('should not be a terminator', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.isTerminator()).toBe(false);
    });

    /**
     * Verify toString format for barrier instruction.
     */
    it('should format toString correctly', () => {
      const barrier = new ILOptBarrierInstruction(0);
      expect(barrier.toString()).toBe('OPT_BARRIER');
    });

    /**
     * Verify barrier instruction preserves metadata.
     */
    it('should preserve metadata', () => {
      const metadata: ILMetadata = {
        location: createTestLocation(),
        sourceExpression: 'barrier()',
      };
      const barrier = new ILOptBarrierInstruction(0, metadata);
      expect(barrier.metadata.location).toBeDefined();
      expect(barrier.metadata.sourceExpression).toBe('barrier()');
    });

    /**
     * Verify barrier instruction stores instruction ID.
     */
    it('should store instruction ID', () => {
      const barrier = new ILOptBarrierInstruction(42);
      expect(barrier.id).toBe(42);
    });
  });

  // ===========================================================================
  // Extreme Test Category: ILVolatileReadInstruction
  // ===========================================================================

  describe('ILVolatileReadInstruction', () => {
    /**
     * Verify volatile read instruction has correct opcode.
     */
    it('should have VOLATILE_READ opcode', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.opcode).toBe(ILOpcode.VOLATILE_READ);
    });

    /**
     * Verify volatile read stores address register.
     */
    it('should store address register', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.address).toBe(address);
    });

    /**
     * Verify volatile read stores result register.
     */
    it('should store result register', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.result).toBe(result);
    });

    /**
     * Verify getOperands returns address register.
     */
    it('should return address in getOperands', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      const operands = vread.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(address);
    });

    /**
     * Verify getUsedRegisters returns address register.
     */
    it('should return address in getUsedRegisters', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      const used = vread.getUsedRegisters();
      expect(used).toHaveLength(1);
      expect(used[0]).toBe(address);
    });

    /**
     * Verify volatile read has side effects (cannot be eliminated).
     */
    it('should have side effects to prevent elimination', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.hasSideEffects()).toBe(true);
    });

    /**
     * Verify volatile read is not a terminator.
     */
    it('should not be a terminator', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.isTerminator()).toBe(false);
    });

    /**
     * Verify toString format for volatile read instruction.
     */
    it('should format toString correctly', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const vread = new ILVolatileReadInstruction(0, address, result);
      expect(vread.toString()).toBe('v1 = VOLATILE_READ v0');
    });

    /**
     * Verify volatile read preserves metadata.
     */
    it('should preserve metadata', () => {
      const address = createWordRegister(0);
      const result = createByteRegister(1);
      const metadata: ILMetadata = {
        location: createTestLocation(),
        sourceExpression: 'volatile_read($D012)',
      };
      const vread = new ILVolatileReadInstruction(0, address, result, metadata);
      expect(vread.metadata.location).toBeDefined();
      expect(vread.metadata.sourceExpression).toBe('volatile_read($D012)');
    });
  });

  // ===========================================================================
  // Extreme Test Category: ILVolatileWriteInstruction
  // ===========================================================================

  describe('ILVolatileWriteInstruction', () => {
    /**
     * Verify volatile write instruction has correct opcode.
     */
    it('should have VOLATILE_WRITE opcode', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.opcode).toBe(ILOpcode.VOLATILE_WRITE);
    });

    /**
     * Verify volatile write stores address register.
     */
    it('should store address register', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.address).toBe(address);
    });

    /**
     * Verify volatile write stores value register.
     */
    it('should store value register', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.value).toBe(value);
    });

    /**
     * Verify volatile write has no result register (void).
     */
    it('should have no result register (void)', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.result).toBeNull();
    });

    /**
     * Verify getOperands returns address and value registers.
     */
    it('should return address and value in getOperands', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      const operands = vwrite.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(address);
      expect(operands[1]).toBe(value);
    });

    /**
     * Verify getUsedRegisters returns address and value registers.
     */
    it('should return address and value in getUsedRegisters', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      const used = vwrite.getUsedRegisters();
      expect(used).toHaveLength(2);
      expect(used[0]).toBe(address);
      expect(used[1]).toBe(value);
    });

    /**
     * Verify volatile write has side effects.
     */
    it('should have side effects', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.hasSideEffects()).toBe(true);
    });

    /**
     * Verify volatile write is not a terminator.
     */
    it('should not be a terminator', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.isTerminator()).toBe(false);
    });

    /**
     * Verify toString format for volatile write instruction.
     */
    it('should format toString correctly', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const vwrite = new ILVolatileWriteInstruction(0, address, value);
      expect(vwrite.toString()).toBe('VOLATILE_WRITE v0, v1');
    });

    /**
     * Verify volatile write preserves metadata.
     */
    it('should preserve metadata', () => {
      const address = createWordRegister(0);
      const value = createByteRegister(1);
      const metadata: ILMetadata = {
        location: createTestLocation(),
        sourceExpression: 'volatile_write($D020, 0)',
      };
      const vwrite = new ILVolatileWriteInstruction(0, address, value, metadata);
      expect(vwrite.metadata.location).toBeDefined();
      expect(vwrite.metadata.sourceExpression).toBe('volatile_write($D020, 0)');
    });
  });

  // ===========================================================================
  // Extreme Test Category: Registry Definitions
  // ===========================================================================

  describe('Registry Definitions', () => {
    describe('barrier() Registry', () => {
      /**
       * Verify barrier is registered as an intrinsic.
       */
      it('should be registered as an intrinsic', () => {
        expect(INTRINSIC_REGISTRY.isIntrinsic('barrier')).toBe(true);
      });

      /**
       * Verify barrier is in Optimization category.
       */
      it('should be in Optimization category', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.category).toBe(IntrinsicCategory.Optimization);
      });

      /**
       * Verify barrier takes no parameters and returns void.
       */
      it('should take no parameters and return void', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.parameterTypes).toEqual([]);
        expect(def.returnType).toBe(IL_VOID);
      });

      /**
       * Verify barrier has OPT_BARRIER opcode.
       */
      it('should have OPT_BARRIER opcode', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.opcode).toBe(ILOpcode.OPT_BARRIER);
      });

      /**
       * Verify barrier has side effects.
       */
      it('should have side effects', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.hasSideEffects).toBe(true);
      });

      /**
       * Verify barrier is a barrier.
       */
      it('should be a barrier', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.isBarrier).toBe(true);
      });

      /**
       * Verify barrier is not volatile.
       */
      it('should not be volatile', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.isVolatile).toBe(false);
      });

      /**
       * Verify barrier has zero cycle count (no runtime cost).
       */
      it('should have zero cycle count', () => {
        const def = INTRINSIC_REGISTRY.get('barrier')!;
        expect(def.cycleCount).toBe(0);
      });
    });

    describe('volatile_read() Registry', () => {
      /**
       * Verify volatile_read is registered as an intrinsic.
       */
      it('should be registered as an intrinsic', () => {
        expect(INTRINSIC_REGISTRY.isIntrinsic('volatile_read')).toBe(true);
      });

      /**
       * Verify volatile_read is in Optimization category.
       */
      it('should be in Optimization category', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.category).toBe(IntrinsicCategory.Optimization);
      });

      /**
       * Verify volatile_read takes word address and returns byte.
       */
      it('should take word address and return byte', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.parameterTypes).toEqual([IL_WORD]);
        expect(def.returnType).toBe(IL_BYTE);
      });

      /**
       * Verify volatile_read has VOLATILE_READ opcode.
       */
      it('should have VOLATILE_READ opcode', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.opcode).toBe(ILOpcode.VOLATILE_READ);
      });

      /**
       * Verify volatile_read has side effects.
       */
      it('should have side effects', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.hasSideEffects).toBe(true);
      });

      /**
       * Verify volatile_read is a barrier.
       */
      it('should be a barrier', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.isBarrier).toBe(true);
      });

      /**
       * Verify volatile_read is volatile.
       */
      it('should be volatile', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.isVolatile).toBe(true);
      });

      /**
       * Verify volatile_read has 4 cycle count.
       */
      it('should have 4 cycle count', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_read')!;
        expect(def.cycleCount).toBe(4);
      });
    });

    describe('volatile_write() Registry', () => {
      /**
       * Verify volatile_write is registered as an intrinsic.
       */
      it('should be registered as an intrinsic', () => {
        expect(INTRINSIC_REGISTRY.isIntrinsic('volatile_write')).toBe(true);
      });

      /**
       * Verify volatile_write is in Optimization category.
       */
      it('should be in Optimization category', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.category).toBe(IntrinsicCategory.Optimization);
      });

      /**
       * Verify volatile_write takes word address and byte value, returns void.
       */
      it('should take word address and byte value, return void', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.parameterTypes).toEqual([IL_WORD, IL_BYTE]);
        expect(def.returnType).toBe(IL_VOID);
      });

      /**
       * Verify volatile_write has VOLATILE_WRITE opcode.
       */
      it('should have VOLATILE_WRITE opcode', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.opcode).toBe(ILOpcode.VOLATILE_WRITE);
      });

      /**
       * Verify volatile_write has side effects.
       */
      it('should have side effects', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.hasSideEffects).toBe(true);
      });

      /**
       * Verify volatile_write is a barrier.
       */
      it('should be a barrier', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.isBarrier).toBe(true);
      });

      /**
       * Verify volatile_write is volatile.
       */
      it('should be volatile', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.isVolatile).toBe(true);
      });

      /**
       * Verify volatile_write has 4 cycle count.
       */
      it('should have 4 cycle count', () => {
        const def = INTRINSIC_REGISTRY.get('volatile_write')!;
        expect(def.cycleCount).toBe(4);
      });
    });
  });

  // ===========================================================================
  // Extreme Test Category: Integration Patterns
  // ===========================================================================

  describe('Integration Patterns', () => {
    /**
     * Test critical section pattern with barriers.
     */
    it('should support critical section pattern with barriers', () => {
      const func = new ILFunction('criticalSection', [], IL_VOID);
      const block = func.getEntryBlock();

      const barrier1 = new ILOptBarrierInstruction(0);
      const barrier2 = new ILOptBarrierInstruction(1);

      block.addInstruction(barrier1);
      // ... critical code would go here ...
      block.addInstruction(barrier2);

      expect(block.getInstructions()).toHaveLength(2);
      expect(block.getInstructions()[0].opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(block.getInstructions()[1].opcode).toBe(ILOpcode.OPT_BARRIER);
    });

    /**
     * Test volatile read/write pair for hardware access.
     */
    it('should support volatile read/write pair', () => {
      const func = new ILFunction('hardwareAccess', [], IL_VOID);
      const block = func.getEntryBlock();

      const addressReg = func.createRegister(IL_WORD);
      const valueReg = func.createRegister(IL_BYTE);
      const resultReg = func.createRegister(IL_BYTE);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);
      const vwrite = new ILVolatileWriteInstruction(1, addressReg, valueReg);

      block.addInstruction(vread);
      block.addInstruction(vwrite);

      expect(block.getInstructions()).toHaveLength(2);
      // Both should have side effects
      expect(block.getInstructions()[0].hasSideEffects()).toBe(true);
      expect(block.getInstructions()[1].hasSideEffects()).toBe(true);
    });

    /**
     * Test all optimization intrinsics are in same category.
     */
    it('should have all opt intrinsics in Optimization category', () => {
      const optIntrinsics = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Optimization);
      const names = optIntrinsics.map((i) => i.name);

      expect(names).toContain('barrier');
      expect(names).toContain('volatile_read');
      expect(names).toContain('volatile_write');
    });

    /**
     * Test barrier between volatile operations.
     */
    it('should support barrier between volatile operations', () => {
      const func = new ILFunction('volatileWithBarrier', [], IL_VOID);
      const block = func.getEntryBlock();

      const addressReg = func.createRegister(IL_WORD);
      const resultReg = func.createRegister(IL_BYTE);
      const valueReg = func.createRegister(IL_BYTE);

      const vread = new ILVolatileReadInstruction(0, addressReg, resultReg);
      const barrier = new ILOptBarrierInstruction(1);
      const vwrite = new ILVolatileWriteInstruction(2, addressReg, valueReg);

      block.addInstruction(vread);
      block.addInstruction(barrier);
      block.addInstruction(vwrite);

      // All three should have side effects
      const instructions = block.getInstructions();
      expect(instructions).toHaveLength(3);
      expect(instructions.every((i) => i.hasSideEffects())).toBe(true);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Optimization Category Consistency
  // ===========================================================================

  describe('Optimization Category Consistency', () => {
    /**
     * Verify all optimization intrinsics have side effects.
     */
    it('should have all opt intrinsics with side effects', () => {
      const barrierDef = INTRINSIC_REGISTRY.get('barrier')!;
      const vreadDef = INTRINSIC_REGISTRY.get('volatile_read')!;
      const vwriteDef = INTRINSIC_REGISTRY.get('volatile_write')!;

      expect(barrierDef.hasSideEffects).toBe(true);
      expect(vreadDef.hasSideEffects).toBe(true);
      expect(vwriteDef.hasSideEffects).toBe(true);
    });

    /**
     * Verify all optimization intrinsics are barriers.
     */
    it('should have all opt intrinsics as barriers', () => {
      const barrierDef = INTRINSIC_REGISTRY.get('barrier')!;
      const vreadDef = INTRINSIC_REGISTRY.get('volatile_read')!;
      const vwriteDef = INTRINSIC_REGISTRY.get('volatile_write')!;

      expect(barrierDef.isBarrier).toBe(true);
      expect(vreadDef.isBarrier).toBe(true);
      expect(vwriteDef.isBarrier).toBe(true);
    });

    /**
     * Verify volatile intrinsics have isVolatile=true, barrier does not.
     */
    it('should have correct volatile flags', () => {
      const barrierDef = INTRINSIC_REGISTRY.get('barrier')!;
      const vreadDef = INTRINSIC_REGISTRY.get('volatile_read')!;
      const vwriteDef = INTRINSIC_REGISTRY.get('volatile_write')!;

      // barrier is NOT volatile (it's just a barrier)
      expect(barrierDef.isVolatile).toBe(false);
      // volatile_read and volatile_write ARE volatile
      expect(vreadDef.isVolatile).toBe(true);
      expect(vwriteDef.isVolatile).toBe(true);
    });

    /**
     * Verify none are compile-time intrinsics.
     */
    it('should have none as compile-time intrinsics', () => {
      const barrierDef = INTRINSIC_REGISTRY.get('barrier')!;
      const vreadDef = INTRINSIC_REGISTRY.get('volatile_read')!;
      const vwriteDef = INTRINSIC_REGISTRY.get('volatile_write')!;

      expect(barrierDef.isCompileTime).toBe(false);
      expect(vreadDef.isCompileTime).toBe(false);
      expect(vwriteDef.isCompileTime).toBe(false);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Documentation and Descriptions
  // ===========================================================================

  describe('Documentation and Descriptions', () => {
    /**
     * Verify barrier has meaningful description.
     */
    it('should have barrier description mentioning reordering', () => {
      const def = INTRINSIC_REGISTRY.get('barrier')!;
      expect(def.description.toLowerCase()).toContain('barrier');
    });

    /**
     * Verify volatile_read has meaningful description.
     */
    it('should have volatile_read description mentioning volatile or cannot', () => {
      const def = INTRINSIC_REGISTRY.get('volatile_read')!;
      const desc = def.description.toLowerCase();
      expect(desc.includes('volatile') || desc.includes('cannot')).toBe(true);
    });

    /**
     * Verify volatile_write has meaningful description.
     */
    it('should have volatile_write description mentioning volatile or cannot', () => {
      const def = INTRINSIC_REGISTRY.get('volatile_write')!;
      const desc = def.description.toLowerCase();
      expect(desc.includes('volatile') || desc.includes('cannot')).toBe(true);
    });
  });
});
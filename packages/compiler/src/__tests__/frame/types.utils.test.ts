/**
 * Tests for FrameSlot utility functions
 *
 * Tests for hasZpAllocationError and calculateZpScoreBreakdown.
 */

import { describe, it, expect } from 'vitest';
import {
  createFrameSlot,
  hasZpAllocationError,
  calculateZpScoreBreakdown,
} from '../../frame/types.js';
import { SlotLocation, SlotKind, ZpDirective } from '../../frame/enums.js';
import { TypeKind, TypeInfo, BUILTIN_TYPES } from '../../semantic/types.js';

describe('hasZpAllocationError', () => {
  describe('Error Detection', () => {
    it('should return true when @zp slot is not in ZP', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.FrameRegion, // Error: required ZP but got frame region
        address: 0x0200,
      });
      expect(hasZpAllocationError(slot)).toBe(true);
    });

    it('should return true when @zp slot is in register', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.Register, // Error: required ZP but got register
      });
      expect(hasZpAllocationError(slot)).toBe(true);
    });
  });

  describe('Success Cases', () => {
    it('should return false when @zp slot is in ZP', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.ZeroPage,
        address: 0xFB,
      });
      expect(hasZpAllocationError(slot)).toBe(false);
    });

    it('should return false for @ram slot in frame region', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
        location: SlotLocation.FrameRegion,
      });
      expect(hasZpAllocationError(slot)).toBe(false);
    });

    it('should return false for no-directive slot in frame region', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
      });
      expect(hasZpAllocationError(slot)).toBe(false);
    });

    it('should return false for no-directive slot in ZP', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
        location: SlotLocation.ZeroPage,
      });
      expect(hasZpAllocationError(slot)).toBe(false);
    });

    it('should return false for default slot', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(hasZpAllocationError(slot)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should return false for @ram slot even if somehow in ZP', () => {
      // This shouldn't happen in practice, but the function only checks @zp errors
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
        location: SlotLocation.ZeroPage, // Weird but not a ZP allocation error
      });
      expect(hasZpAllocationError(slot)).toBe(false);
    });

    it('should work with parameters', () => {
      const slot = createFrameSlot('ptr', SlotKind.Parameter, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.FrameRegion,
      });
      expect(hasZpAllocationError(slot)).toBe(true);
    });

    it('should work with return slots', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.FrameRegion,
      });
      expect(hasZpAllocationError(slot)).toBe(true);
    });

    it('should work with temporary slots', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.FrameRegion,
      });
      expect(hasZpAllocationError(slot)).toBe(true);
    });
  });
});

describe('calculateZpScoreBreakdown', () => {
  describe('Type Weight Calculation', () => {
    it('should give weight 50 for word type', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(50);
    });

    it('should give weight 20 for byte type', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(20);
    });

    it('should give weight 10 for bool type', () => {
      const slot = createFrameSlot('flag', SlotKind.Local, BUILTIN_TYPES.BOOL);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(10);
    });

    it('should give weight 5 for array type', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      const slot = createFrameSlot('buffer', SlotKind.Local, arrayType);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(5);
    });

    it('should give weight 0 for void type', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.VOID);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(0);
    });

    it('should give weight 0 for unknown type', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.UNKNOWN);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.typeWeight).toBe(0);
    });
  });

  describe('Access Bonus Calculation', () => {
    it('should calculate 2 points per access', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 5,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.accessBonus).toBe(10);
    });

    it('should give 0 bonus for 0 accesses', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 0,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.accessBonus).toBe(0);
    });

    it('should handle high access counts', () => {
      const slot = createFrameSlot('hotVar', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 100,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.accessBonus).toBe(200);
    });
  });

  describe('Loop Bonus Calculation', () => {
    it('should calculate 20 points per loop depth', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 2,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.loopBonus).toBe(40);
    });

    it('should give 0 bonus for depth 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 0,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.loopBonus).toBe(0);
    });

    it('should handle deep nesting', () => {
      const slot = createFrameSlot('deepVar', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 5,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.loopBonus).toBe(100);
    });
  });

  describe('Directive Bonus Calculation', () => {
    it('should give 10000 bonus for @zp directive', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.directiveBonus).toBe(10000);
    });

    it('should give 0 bonus for @ram directive', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.directiveBonus).toBe(0);
    });

    it('should give 0 bonus for no directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
      });
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.directiveBonus).toBe(0);
    });

    it('should give 0 bonus for default directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const breakdown = calculateZpScoreBreakdown(slot);
      expect(breakdown.directiveBonus).toBe(0);
    });
  });

  describe('Total Score Calculation', () => {
    it('should sum all components correctly', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        accessCount: 10,
        maxLoopDepth: 2,
        zpDirective: ZpDirective.None,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // word type (50) + 10 accesses * 2 (20) + loop depth 2 * 20 (40) + no directive (0)
      expect(breakdown.typeWeight).toBe(50);
      expect(breakdown.accessBonus).toBe(20);
      expect(breakdown.loopBonus).toBe(40);
      expect(breakdown.directiveBonus).toBe(0);
      expect(breakdown.totalScore).toBe(110);
    });

    it('should calculate high score for @zp directive', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        accessCount: 10,
        maxLoopDepth: 2,
        zpDirective: ZpDirective.Zp,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // word type (50) + 10 accesses * 2 (20) + loop depth 2 * 20 (40) + @zp (10000)
      expect(breakdown.totalScore).toBe(10110);
    });

    it('should match component sum', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 5,
        maxLoopDepth: 1,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      const expectedTotal =
        breakdown.typeWeight +
        breakdown.accessBonus +
        breakdown.loopBonus +
        breakdown.directiveBonus;
      expect(breakdown.totalScore).toBe(expectedTotal);
    });
  });

  describe('Real-World Score Scenarios', () => {
    it('should calculate score for hot loop counter', () => {
      // A byte counter in a tight loop
      const slot = createFrameSlot('i', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 20, // Incremented, compared, used
        maxLoopDepth: 2, // Nested loop
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // byte (20) + 20*2 access (40) + 2*20 loop (40)
      expect(breakdown.totalScore).toBe(100);
    });

    it('should calculate score for pointer variable', () => {
      // A word pointer used for indirect access
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        accessCount: 15,
        maxLoopDepth: 1,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // word (50) + 15*2 access (30) + 1*20 loop (20)
      expect(breakdown.totalScore).toBe(100);
    });

    it('should calculate score for rarely used variable', () => {
      // A byte used once outside any loop
      const slot = createFrameSlot('config', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 1,
        maxLoopDepth: 0,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // byte (20) + 1*2 access (2) + 0 loop (0)
      expect(breakdown.totalScore).toBe(22);
    });

    it('should calculate score for @zp required pointer', () => {
      // User explicitly requires ZP for a pointer
      const slot = createFrameSlot('fastPtr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        accessCount: 5,
        maxLoopDepth: 1,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // word (50) + 5*2 access (10) + 1*20 loop (20) + @zp (10000)
      expect(breakdown.totalScore).toBe(10080);
    });

    it('should calculate score for large array', () => {
      // An array that shouldn't be in ZP
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[64]',
        size: 64,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 64,
      };
      const slot = createFrameSlot('buffer', SlotKind.Local, arrayType, {
        zpDirective: ZpDirective.Ram, // Explicitly @ram
        accessCount: 10,
        maxLoopDepth: 1,
      });
      const breakdown = calculateZpScoreBreakdown(slot);

      // array (5) + 10*2 access (20) + 1*20 loop (20) + @ram (0)
      expect(breakdown.totalScore).toBe(45);
    });
  });

  describe('Score Comparison for Priority', () => {
    it('should rank @zp slots highest', () => {
      const zpSlot = createFrameSlot('zpVar', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Zp,
        accessCount: 1,
      });
      const hotSlot = createFrameSlot('hotVar', SlotKind.Local, BUILTIN_TYPES.WORD, {
        accessCount: 100,
        maxLoopDepth: 5,
      });

      const zpBreakdown = calculateZpScoreBreakdown(zpSlot);
      const hotBreakdown = calculateZpScoreBreakdown(hotSlot);

      // @zp should always win
      expect(zpBreakdown.totalScore).toBeGreaterThan(hotBreakdown.totalScore);
    });

    it('should rank word types higher than byte types (same access)', () => {
      const wordSlot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        accessCount: 5,
        maxLoopDepth: 1,
      });
      const byteSlot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 5,
        maxLoopDepth: 1,
      });

      const wordBreakdown = calculateZpScoreBreakdown(wordSlot);
      const byteBreakdown = calculateZpScoreBreakdown(byteSlot);

      expect(wordBreakdown.totalScore).toBeGreaterThan(byteBreakdown.totalScore);
    });

    it('should rank high-access variables higher', () => {
      const hotSlot = createFrameSlot('hot', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 50,
      });
      const coldSlot = createFrameSlot('cold', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 2,
      });

      const hotBreakdown = calculateZpScoreBreakdown(hotSlot);
      const coldBreakdown = calculateZpScoreBreakdown(coldSlot);

      expect(hotBreakdown.totalScore).toBeGreaterThan(coldBreakdown.totalScore);
    });

    it('should rank deep-loop variables higher', () => {
      const deepSlot = createFrameSlot('deep', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 3,
      });
      const shallowSlot = createFrameSlot('shallow', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 0,
      });

      const deepBreakdown = calculateZpScoreBreakdown(deepSlot);
      const shallowBreakdown = calculateZpScoreBreakdown(shallowSlot);

      expect(deepBreakdown.totalScore).toBeGreaterThan(shallowBreakdown.totalScore);
    });
  });
});
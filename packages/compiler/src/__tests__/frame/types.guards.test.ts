/**
 * Tests for FrameSlot type guard functions
 *
 * Tests for slot kind guards, location guards, and ZP directive guards.
 */

import { describe, it, expect } from 'vitest';
import {
  createFrameSlot,
  isParameterSlot,
  isLocalSlot,
  isReturnSlot,
  isTemporarySlot,
  isZpSlot,
  isFrameRegionSlot,
  isRegisterSlot,
  requiresZp,
  forbiddenFromZp,
  hasNoZpDirective,
} from '../../frame/types.js';
import { SlotLocation, SlotKind, ZpDirective } from '../../frame/enums.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';

describe('Slot Kind Type Guards', () => {
  describe('isParameterSlot', () => {
    it('should return true for parameter slots', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
      expect(isParameterSlot(slot)).toBe(true);
    });

    it('should return false for local slots', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isParameterSlot(slot)).toBe(false);
    });

    it('should return false for return slots', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
      expect(isParameterSlot(slot)).toBe(false);
    });

    it('should return false for temporary slots', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.BYTE);
      expect(isParameterSlot(slot)).toBe(false);
    });
  });

  describe('isLocalSlot', () => {
    it('should return true for local slots', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isLocalSlot(slot)).toBe(true);
    });

    it('should return false for parameter slots', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
      expect(isLocalSlot(slot)).toBe(false);
    });

    it('should return false for return slots', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
      expect(isLocalSlot(slot)).toBe(false);
    });

    it('should return false for temporary slots', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.BYTE);
      expect(isLocalSlot(slot)).toBe(false);
    });
  });

  describe('isReturnSlot', () => {
    it('should return true for return slots', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
      expect(isReturnSlot(slot)).toBe(true);
    });

    it('should return false for parameter slots', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
      expect(isReturnSlot(slot)).toBe(false);
    });

    it('should return false for local slots', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isReturnSlot(slot)).toBe(false);
    });

    it('should return false for temporary slots', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.BYTE);
      expect(isReturnSlot(slot)).toBe(false);
    });
  });

  describe('isTemporarySlot', () => {
    it('should return true for temporary slots', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.WORD);
      expect(isTemporarySlot(slot)).toBe(true);
    });

    it('should return false for parameter slots', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
      expect(isTemporarySlot(slot)).toBe(false);
    });

    it('should return false for local slots', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isTemporarySlot(slot)).toBe(false);
    });

    it('should return false for return slots', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
      expect(isTemporarySlot(slot)).toBe(false);
    });
  });

  describe('Kind Guards Mutual Exclusion', () => {
    it('should have exactly one kind guard return true for parameter', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
      const guards = [isParameterSlot, isLocalSlot, isReturnSlot, isTemporarySlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });

    it('should have exactly one kind guard return true for local', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const guards = [isParameterSlot, isLocalSlot, isReturnSlot, isTemporarySlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });

    it('should have exactly one kind guard return true for return', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
      const guards = [isParameterSlot, isLocalSlot, isReturnSlot, isTemporarySlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });

    it('should have exactly one kind guard return true for temporary', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.WORD);
      const guards = [isParameterSlot, isLocalSlot, isReturnSlot, isTemporarySlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });
  });
});

describe('Slot Location Type Guards', () => {
  describe('isZpSlot', () => {
    it('should return true for ZeroPage location', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
      });
      expect(isZpSlot(slot)).toBe(true);
    });

    it('should return false for FrameRegion location', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
      });
      expect(isZpSlot(slot)).toBe(false);
    });

    it('should return false for Register location', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
      });
      expect(isZpSlot(slot)).toBe(false);
    });

    it('should return false for default location', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isZpSlot(slot)).toBe(false);
    });
  });

  describe('isFrameRegionSlot', () => {
    it('should return true for FrameRegion location', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
      });
      expect(isFrameRegionSlot(slot)).toBe(true);
    });

    it('should return true for default location', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isFrameRegionSlot(slot)).toBe(true);
    });

    it('should return false for ZeroPage location', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
      });
      expect(isFrameRegionSlot(slot)).toBe(false);
    });

    it('should return false for Register location', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
      });
      expect(isFrameRegionSlot(slot)).toBe(false);
    });
  });

  describe('isRegisterSlot', () => {
    it('should return true for Register location', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
        register: 'A',
      });
      expect(isRegisterSlot(slot)).toBe(true);
    });

    it('should return false for ZeroPage location', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
      });
      expect(isRegisterSlot(slot)).toBe(false);
    });

    it('should return false for FrameRegion location', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(isRegisterSlot(slot)).toBe(false);
    });
  });

  describe('Location Guards Mutual Exclusion', () => {
    it('should have exactly one location guard return true for ZeroPage', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
      });
      const guards = [isZpSlot, isFrameRegionSlot, isRegisterSlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });

    it('should have exactly one location guard return true for FrameRegion', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
      });
      const guards = [isZpSlot, isFrameRegionSlot, isRegisterSlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });

    it('should have exactly one location guard return true for Register', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
      });
      const guards = [isZpSlot, isFrameRegionSlot, isRegisterSlot];
      const trueCount = guards.filter(guard => guard(slot)).length;
      expect(trueCount).toBe(1);
    });
  });
});

describe('ZP Directive Type Guards', () => {
  describe('requiresZp', () => {
    it('should return true for Zp directive', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      expect(requiresZp(slot)).toBe(true);
    });

    it('should return false for None directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
      });
      expect(requiresZp(slot)).toBe(false);
    });

    it('should return false for Ram directive', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
      });
      expect(requiresZp(slot)).toBe(false);
    });

    it('should return false for default directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(requiresZp(slot)).toBe(false);
    });
  });

  describe('forbiddenFromZp', () => {
    it('should return true for Ram directive', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
      });
      expect(forbiddenFromZp(slot)).toBe(true);
    });

    it('should return false for None directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
      });
      expect(forbiddenFromZp(slot)).toBe(false);
    });

    it('should return false for Zp directive', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      expect(forbiddenFromZp(slot)).toBe(false);
    });

    it('should return false for default directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(forbiddenFromZp(slot)).toBe(false);
    });
  });

  describe('hasNoZpDirective', () => {
    it('should return true for None directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
      });
      expect(hasNoZpDirective(slot)).toBe(true);
    });

    it('should return true for default directive', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(hasNoZpDirective(slot)).toBe(true);
    });

    it('should return false for Zp directive', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      expect(hasNoZpDirective(slot)).toBe(false);
    });

    it('should return false for Ram directive', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
      });
      expect(hasNoZpDirective(slot)).toBe(false);
    });
  });

  describe('ZP Directive Guards Coverage', () => {
    it('should have exactly one ZP directive guard return true for None', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.None,
      });
      // Note: hasNoZpDirective covers None, requiresZp covers Zp, forbiddenFromZp covers Ram
      expect(hasNoZpDirective(slot)).toBe(true);
      expect(requiresZp(slot)).toBe(false);
      expect(forbiddenFromZp(slot)).toBe(false);
    });

    it('should have exactly one ZP directive guard return true for Zp', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      expect(hasNoZpDirective(slot)).toBe(false);
      expect(requiresZp(slot)).toBe(true);
      expect(forbiddenFromZp(slot)).toBe(false);
    });

    it('should have exactly one ZP directive guard return true for Ram', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
      });
      expect(hasNoZpDirective(slot)).toBe(false);
      expect(requiresZp(slot)).toBe(false);
      expect(forbiddenFromZp(slot)).toBe(true);
    });
  });
});

describe('Combined Guard Usage', () => {
  describe('Real-World Scenarios', () => {
    it('should identify ZP-required parameter allocated to ZP', () => {
      const slot = createFrameSlot('ptr', SlotKind.Parameter, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.ZeroPage,
        address: 0xFB,
      });

      expect(isParameterSlot(slot)).toBe(true);
      expect(requiresZp(slot)).toBe(true);
      expect(isZpSlot(slot)).toBe(true);
    });

    it('should identify RAM-required local allocated to frame region', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        zpDirective: ZpDirective.Ram,
        location: SlotLocation.FrameRegion,
        address: 0x0200,
      });

      expect(isLocalSlot(slot)).toBe(true);
      expect(forbiddenFromZp(slot)).toBe(true);
      expect(isFrameRegionSlot(slot)).toBe(true);
    });

    it('should identify register-passed parameter', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
        register: 'A',
      });

      expect(isParameterSlot(slot)).toBe(true);
      expect(isRegisterSlot(slot)).toBe(true);
      expect(hasNoZpDirective(slot)).toBe(true);
    });

    it('should identify compiler temporary in frame region', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.WORD, {
        location: SlotLocation.FrameRegion,
        address: 0x0202,
      });

      expect(isTemporarySlot(slot)).toBe(true);
      expect(isFrameRegionSlot(slot)).toBe(true);
      expect(hasNoZpDirective(slot)).toBe(true);
    });

    it('should identify return slot in frame region', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.WORD, {
        location: SlotLocation.FrameRegion,
        address: 0x0200,
      });

      expect(isReturnSlot(slot)).toBe(true);
      expect(isFrameRegionSlot(slot)).toBe(true);
    });
  });
});
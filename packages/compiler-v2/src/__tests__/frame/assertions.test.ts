/**
 * Tests for SFA assertion helper functions
 *
 * These tests verify that the custom assertions work correctly.
 * The assertions will be used extensively in SFA implementation testing.
 *
 * @module __tests__/frame/assertions.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  SlotLocation,
  type Frame,
  type FrameAllocationResult,
  // Frame existence assertions
  expectFrameExists,
  expectFrameAt,
  expectFrameSize,
  // Slot location assertions
  expectSlotInZP,
  expectSlotInRAM,
  expectSlotAt,
  expectSlotSize,
  // Coalescing assertions
  expectCoalesced,
  expectNotCoalesced,
  expectAllCoalesced,
  // Diagnostic assertions
  expectNoErrors,
  expectSuccess,
  expectError,
  expectErrorForFunction,
  expectWarning,
  expectErrorCount,
  // Statistics assertions
  expectCoalescingSavings,
  expectZPUsage,
  expectExactZPUsage,
  expectTotalAllocation,
  expectCoalesceGroupCount,
  // Test data builders
  createTestAllocationResult,
  createTestFrame,
  createTestSlot,
  createTestDiagnostic,
} from './helpers/index.js';

// ============================================================================
// Test Data Builder Tests
// ============================================================================

describe('Test Data Builders', () => {
  describe('createTestAllocationResult', () => {
    it('should create empty result with defaults', () => {
      const result = createTestAllocationResult();

      expect(result.frameMap).toBeInstanceOf(Map);
      expect(result.frameMap.size).toBe(0);
      expect(result.diagnostics).toEqual([]);
      expect(result.success).toBe(true);
      expect(result.stats.totalFunctions).toBe(0);
      expect(result.stats.zpBytesUsed).toBe(0);
    });

    it('should create result with provided frames', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main', { baseAddress: 0x0200 }));
      frames.set('helper', createTestFrame('helper', { baseAddress: 0x0210 }));

      const result = createTestAllocationResult({ frames });

      expect(result.frameMap.size).toBe(2);
      expect(result.frameMap.get('main')).toBeDefined();
      expect(result.frameMap.get('helper')).toBeDefined();
    });

    it('should create result with custom stats', () => {
      const result = createTestAllocationResult({
        stats: {
          zpBytesUsed: 10,
          coalescingSavingsPercent: 0.35,
          coalesceGroupCount: 3,
        },
      });

      expect(result.stats.zpBytesUsed).toBe(10);
      expect(result.stats.coalescingSavingsPercent).toBe(0.35);
      expect(result.stats.coalesceGroupCount).toBe(3);
    });

    it('should create result with diagnostics', () => {
      const diagnostics = [
        createTestDiagnostic('error', 'E001', 'Test error'),
        createTestDiagnostic('warning', 'W001', 'Test warning'),
      ];

      const result = createTestAllocationResult({ diagnostics });

      expect(result.diagnostics).toHaveLength(2);
      expect(result.success).toBe(false); // Has errors, so not successful
    });

    it('should allow overriding success flag', () => {
      const result = createTestAllocationResult({ success: false });
      expect(result.success).toBe(false);
    });
  });

  describe('createTestFrame', () => {
    it('should create frame with defaults', () => {
      const frame = createTestFrame('testFunc');

      expect(frame.functionName).toBe('testFunc');
      expect(frame.baseAddress).toBe(0x0200);
      expect(frame.totalSize).toBe(0);
      expect(frame.slots).toEqual([]);
      expect(frame.coalesceGroup).toBe(0);
      expect(frame.zpBytesUsed).toBe(0);
    });

    it('should create frame with custom properties', () => {
      const slots = [
        createTestSlot('x', { size: 1 }),
        createTestSlot('y', { size: 2 }),
      ];

      const frame = createTestFrame('myFunc', {
        baseAddress: 0x0300,
        totalSize: 3,
        slots,
        coalesceGroup: 5,
        zpBytesUsed: 2,
      });

      expect(frame.functionName).toBe('myFunc');
      expect(frame.baseAddress).toBe(0x0300);
      expect(frame.totalSize).toBe(3);
      expect(frame.slots).toHaveLength(2);
      expect(frame.coalesceGroup).toBe(5);
      expect(frame.zpBytesUsed).toBe(2);
    });
  });

  describe('createTestSlot', () => {
    it('should create slot with defaults', () => {
      const slot = createTestSlot('counter');

      expect(slot.name).toBe('counter');
      expect(slot.size).toBe(1);
      expect(slot.offset).toBe(0);
      expect(slot.location).toBe(SlotLocation.FrameRegion);
      expect(slot.address).toBe(0x0200); // Default RAM base
    });

    it('should create ZP slot with correct address', () => {
      const slot = createTestSlot('fastVar', {
        location: SlotLocation.ZeroPage,
        offset: 5,
      });

      expect(slot.location).toBe(SlotLocation.ZeroPage);
      expect(slot.address).toBe(5); // ZP base (0) + offset
    });

    it('should create RAM slot with correct address', () => {
      const slot = createTestSlot('slowVar', {
        location: SlotLocation.FrameRegion,
        offset: 10,
      });

      expect(slot.location).toBe(SlotLocation.FrameRegion);
      expect(slot.address).toBe(0x020a); // RAM base (0x0200) + offset (10)
    });

    it('should allow custom address override', () => {
      const slot = createTestSlot('custom', {
        address: 0x1234,
      });

      expect(slot.address).toBe(0x1234);
    });
  });

  describe('createTestDiagnostic', () => {
    it('should create error diagnostic', () => {
      const diag = createTestDiagnostic('error', 'SFA_001', 'Recursion detected');

      expect(diag.severity).toBe('error');
      expect(diag.code).toBe('SFA_001');
      expect(diag.message).toBe('Recursion detected');
      expect(diag.functionName).toBeUndefined();
    });

    it('should create diagnostic with function name', () => {
      const diag = createTestDiagnostic('warning', 'SFA_002', 'ZP overflow', 'myFunc');

      expect(diag.functionName).toBe('myFunc');
    });
  });
});

// ============================================================================
// Frame Existence Assertion Tests
// ============================================================================

describe('Frame Existence Assertions', () => {
  describe('expectFrameExists', () => {
    it('should pass when frame exists', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main'));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectFrameExists(result, 'main');
    });

    it('should fail when frame does not exist', () => {
      const result = createTestAllocationResult();

      expect(() => expectFrameExists(result, 'nonexistent')).toThrow();
    });
  });

  describe('expectFrameAt', () => {
    it('should pass when frame is at expected address', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main', { baseAddress: 0x0200 }));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectFrameAt(result, 'main', 0x0200);
    });

    it('should fail when frame is at different address', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main', { baseAddress: 0x0200 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectFrameAt(result, 'main', 0x0300)).toThrow();
    });

    it('should fail when frame does not exist', () => {
      const result = createTestAllocationResult();

      expect(() => expectFrameAt(result, 'nonexistent', 0x0200)).toThrow();
    });
  });

  describe('expectFrameSize', () => {
    it('should pass when frame has expected size', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main', { totalSize: 10 }));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectFrameSize(result, 'main', 10);
    });

    it('should fail when frame has different size', () => {
      const frames = new Map<string, Frame>();
      frames.set('main', createTestFrame('main', { totalSize: 10 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectFrameSize(result, 'main', 20)).toThrow();
    });
  });
});

// ============================================================================
// Slot Location Assertion Tests
// ============================================================================

describe('Slot Location Assertions', () => {
  describe('expectSlotInZP', () => {
    it('should pass when slot is in Zero Page', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('counter', { location: SlotLocation.ZeroPage })],
      });

      // Should not throw
      expectSlotInZP(frame, 'counter');
    });

    it('should fail when slot is not in Zero Page', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('counter', { location: SlotLocation.FrameRegion })],
      });

      expect(() => expectSlotInZP(frame, 'counter')).toThrow();
    });

    it('should fail when slot does not exist', () => {
      const frame = createTestFrame('main', { slots: [] });

      expect(() => expectSlotInZP(frame, 'nonexistent')).toThrow();
    });
  });

  describe('expectSlotInRAM', () => {
    it('should pass when slot is in RAM', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('buffer', { location: SlotLocation.FrameRegion })],
      });

      // Should not throw
      expectSlotInRAM(frame, 'buffer');
    });

    it('should fail when slot is in Zero Page', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('buffer', { location: SlotLocation.ZeroPage })],
      });

      expect(() => expectSlotInRAM(frame, 'buffer')).toThrow();
    });
  });

  describe('expectSlotAt', () => {
    it('should pass when slot is at expected address', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('counter', { address: 0x02 })],
      });

      // Should not throw
      expectSlotAt(frame, 'counter', 0x02);
    });

    it('should fail when slot is at different address', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('counter', { address: 0x02 })],
      });

      expect(() => expectSlotAt(frame, 'counter', 0x10)).toThrow();
    });
  });

  describe('expectSlotSize', () => {
    it('should pass when slot has expected size', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('word', { size: 2 })],
      });

      // Should not throw
      expectSlotSize(frame, 'word', 2);
    });

    it('should fail when slot has different size', () => {
      const frame = createTestFrame('main', {
        slots: [createTestSlot('word', { size: 2 })],
      });

      expect(() => expectSlotSize(frame, 'word', 1)).toThrow();
    });
  });
});

// ============================================================================
// Coalescing Assertion Tests
// ============================================================================

describe('Coalescing Assertions', () => {
  describe('expectCoalesced', () => {
    it('should pass when functions are in same coalesce group', () => {
      const frames = new Map<string, Frame>();
      frames.set('funcA', createTestFrame('funcA', { coalesceGroup: 1 }));
      frames.set('funcB', createTestFrame('funcB', { coalesceGroup: 1 }));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectCoalesced(result, 'funcA', 'funcB');
    });

    it('should fail when functions are in different coalesce groups', () => {
      const frames = new Map<string, Frame>();
      frames.set('funcA', createTestFrame('funcA', { coalesceGroup: 1 }));
      frames.set('funcB', createTestFrame('funcB', { coalesceGroup: 2 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectCoalesced(result, 'funcA', 'funcB')).toThrow();
    });

    it('should fail when one function does not exist', () => {
      const frames = new Map<string, Frame>();
      frames.set('funcA', createTestFrame('funcA', { coalesceGroup: 1 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectCoalesced(result, 'funcA', 'nonexistent')).toThrow();
    });
  });

  describe('expectNotCoalesced', () => {
    it('should pass when functions are in different coalesce groups', () => {
      const frames = new Map<string, Frame>();
      frames.set('caller', createTestFrame('caller', { coalesceGroup: 1 }));
      frames.set('callee', createTestFrame('callee', { coalesceGroup: 2 }));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectNotCoalesced(result, 'caller', 'callee');
    });

    it('should fail when functions are in same coalesce group', () => {
      const frames = new Map<string, Frame>();
      frames.set('caller', createTestFrame('caller', { coalesceGroup: 1 }));
      frames.set('callee', createTestFrame('callee', { coalesceGroup: 1 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectNotCoalesced(result, 'caller', 'callee')).toThrow();
    });
  });

  describe('expectAllCoalesced', () => {
    it('should pass when all functions are in same coalesce group', () => {
      const frames = new Map<string, Frame>();
      frames.set('funcA', createTestFrame('funcA', { coalesceGroup: 3 }));
      frames.set('funcB', createTestFrame('funcB', { coalesceGroup: 3 }));
      frames.set('funcC', createTestFrame('funcC', { coalesceGroup: 3 }));
      const result = createTestAllocationResult({ frames });

      // Should not throw
      expectAllCoalesced(result, ['funcA', 'funcB', 'funcC']);
    });

    it('should fail when any function is in different group', () => {
      const frames = new Map<string, Frame>();
      frames.set('funcA', createTestFrame('funcA', { coalesceGroup: 1 }));
      frames.set('funcB', createTestFrame('funcB', { coalesceGroup: 1 }));
      frames.set('funcC', createTestFrame('funcC', { coalesceGroup: 2 }));
      const result = createTestAllocationResult({ frames });

      expect(() => expectAllCoalesced(result, ['funcA', 'funcB', 'funcC'])).toThrow();
    });

    it('should throw error when given less than 2 functions', () => {
      const result = createTestAllocationResult();

      expect(() => expectAllCoalesced(result, ['single'])).toThrow(
        'expectAllCoalesced requires at least 2 function names'
      );
    });
  });
});

// ============================================================================
// Diagnostic Assertion Tests
// ============================================================================

describe('Diagnostic Assertions', () => {
  describe('expectNoErrors', () => {
    it('should pass when there are no errors', () => {
      const result = createTestAllocationResult({ diagnostics: [] });

      // Should not throw
      expectNoErrors(result);
    });

    it('should pass when there are only warnings', () => {
      const diagnostics = [createTestDiagnostic('warning', 'W001', 'Some warning')];
      const result = createTestAllocationResult({ diagnostics });

      // Should not throw
      expectNoErrors(result);
    });

    it('should fail when there are errors', () => {
      const diagnostics = [createTestDiagnostic('error', 'E001', 'Some error')];
      const result = createTestAllocationResult({ diagnostics });

      expect(() => expectNoErrors(result)).toThrow();
    });
  });

  describe('expectSuccess', () => {
    it('should pass when success is true and no errors', () => {
      const result = createTestAllocationResult({ success: true, diagnostics: [] });

      // Should not throw
      expectSuccess(result);
    });

    it('should fail when success is false', () => {
      const result = createTestAllocationResult({ success: false, diagnostics: [] });

      expect(() => expectSuccess(result)).toThrow();
    });
  });

  describe('expectError', () => {
    it('should pass when expected error code exists', () => {
      const diagnostics = [createTestDiagnostic('error', 'SFA_RECURSION', 'Recursion detected')];
      const result = createTestAllocationResult({ diagnostics });

      // Should not throw
      expectError(result, 'SFA_RECURSION');
    });

    it('should fail when error code does not exist', () => {
      const diagnostics = [createTestDiagnostic('error', 'SFA_OTHER', 'Other error')];
      const result = createTestAllocationResult({ diagnostics });

      expect(() => expectError(result, 'SFA_RECURSION')).toThrow();
    });

    it('should fail when no errors exist', () => {
      const result = createTestAllocationResult({ diagnostics: [] });

      expect(() => expectError(result, 'SFA_RECURSION')).toThrow();
    });
  });

  describe('expectErrorForFunction', () => {
    it('should pass when error exists for the function', () => {
      const diagnostics = [
        createTestDiagnostic('error', 'SFA_RECURSION', 'Recursion in factorial', 'factorial'),
      ];
      const result = createTestAllocationResult({ diagnostics });

      // Should not throw
      expectErrorForFunction(result, 'SFA_RECURSION', 'factorial');
    });

    it('should fail when error exists but for different function', () => {
      const diagnostics = [
        createTestDiagnostic('error', 'SFA_RECURSION', 'Recursion in factorial', 'factorial'),
      ];
      const result = createTestAllocationResult({ diagnostics });

      expect(() => expectErrorForFunction(result, 'SFA_RECURSION', 'otherFunc')).toThrow();
    });
  });

  describe('expectWarning', () => {
    it('should pass when expected warning code exists', () => {
      const diagnostics = [createTestDiagnostic('warning', 'W_ZP_FULL', 'ZP is full')];
      const result = createTestAllocationResult({ diagnostics });

      // Should not throw
      expectWarning(result, 'W_ZP_FULL');
    });

    it('should fail when warning code does not exist', () => {
      const result = createTestAllocationResult({ diagnostics: [] });

      expect(() => expectWarning(result, 'W_ZP_FULL')).toThrow();
    });
  });

  describe('expectErrorCount', () => {
    it('should pass when error count matches', () => {
      const diagnostics = [
        createTestDiagnostic('error', 'E001', 'Error 1'),
        createTestDiagnostic('error', 'E002', 'Error 2'),
        createTestDiagnostic('warning', 'W001', 'Warning 1'),
      ];
      const result = createTestAllocationResult({ diagnostics });

      // Should not throw (2 errors, 1 warning)
      expectErrorCount(result, 2);
    });

    it('should fail when error count does not match', () => {
      const diagnostics = [createTestDiagnostic('error', 'E001', 'Error 1')];
      const result = createTestAllocationResult({ diagnostics });

      expect(() => expectErrorCount(result, 2)).toThrow();
    });

    it('should pass with zero errors when none exist', () => {
      const result = createTestAllocationResult({ diagnostics: [] });

      // Should not throw
      expectErrorCount(result, 0);
    });
  });
});

// ============================================================================
// Statistics Assertion Tests
// ============================================================================

describe('Statistics Assertions', () => {
  describe('expectCoalescingSavings', () => {
    it('should pass when savings meet minimum', () => {
      const result = createTestAllocationResult({
        stats: { coalescingSavingsPercent: 0.40 },
      });

      // Should not throw
      expectCoalescingSavings(result, 0.30);
    });

    it('should pass when savings exactly meet minimum', () => {
      const result = createTestAllocationResult({
        stats: { coalescingSavingsPercent: 0.30 },
      });

      // Should not throw
      expectCoalescingSavings(result, 0.30);
    });

    it('should fail when savings are below minimum', () => {
      const result = createTestAllocationResult({
        stats: { coalescingSavingsPercent: 0.20 },
      });

      expect(() => expectCoalescingSavings(result, 0.30)).toThrow();
    });
  });

  describe('expectZPUsage', () => {
    it('should pass when ZP usage is within range', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 15 },
      });

      // Should not throw
      expectZPUsage(result, 10, 20);
    });

    it('should pass when ZP usage equals min', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 10 },
      });

      // Should not throw
      expectZPUsage(result, 10, 20);
    });

    it('should pass when ZP usage equals max', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 20 },
      });

      // Should not throw
      expectZPUsage(result, 10, 20);
    });

    it('should fail when ZP usage is below min', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 5 },
      });

      expect(() => expectZPUsage(result, 10, 20)).toThrow();
    });

    it('should fail when ZP usage is above max', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 25 },
      });

      expect(() => expectZPUsage(result, 10, 20)).toThrow();
    });
  });

  describe('expectExactZPUsage', () => {
    it('should pass when ZP usage matches exactly', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 10 },
      });

      // Should not throw
      expectExactZPUsage(result, 10);
    });

    it('should fail when ZP usage does not match', () => {
      const result = createTestAllocationResult({
        stats: { zpBytesUsed: 10 },
      });

      expect(() => expectExactZPUsage(result, 15)).toThrow();
    });
  });

  describe('expectTotalAllocation', () => {
    it('should pass when total allocation matches', () => {
      const result = createTestAllocationResult({
        stats: { totalBytesAllocated: 256 },
      });

      // Should not throw
      expectTotalAllocation(result, 256);
    });

    it('should fail when total allocation does not match', () => {
      const result = createTestAllocationResult({
        stats: { totalBytesAllocated: 256 },
      });

      expect(() => expectTotalAllocation(result, 512)).toThrow();
    });
  });

  describe('expectCoalesceGroupCount', () => {
    it('should pass when group count matches', () => {
      const result = createTestAllocationResult({
        stats: { coalesceGroupCount: 3 },
      });

      // Should not throw
      expectCoalesceGroupCount(result, 3);
    });

    it('should fail when group count does not match', () => {
      const result = createTestAllocationResult({
        stats: { coalesceGroupCount: 3 },
      });

      expect(() => expectCoalesceGroupCount(result, 5)).toThrow();
    });
  });
});

// ============================================================================
// SlotLocation Enum Tests
// ============================================================================

describe('SlotLocation Enum', () => {
  it('should have correct values', () => {
    expect(SlotLocation.ZeroPage).toBe('ZeroPage');
    expect(SlotLocation.FrameRegion).toBe('FrameRegion');
    expect(SlotLocation.Register).toBe('Register');
  });

  it('should be usable in comparisons', () => {
    const location = SlotLocation.ZeroPage;
    expect(location === SlotLocation.ZeroPage).toBe(true);
    expect(location === SlotLocation.FrameRegion).toBe(false);
  });
});
/**
 * Accumulator Optimization Tests - CGT3.8
 *
 * Tests for accumulator state tracking and load elimination optimization.
 * Verifies redundant loads are skipped when A already has the required value.
 *
 * @module __tests__/codegen/unit/accumulator-optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createLoadByteInstr,
  createStoreByteInstr,
  createLoadImmInstr,
  countInstructions,
  hasCommentContaining,
} from './_test-helpers.js';

// ============================================================================
// Accumulator Optimization Tests
// ============================================================================

describe('Accumulator Optimization', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('load elimination - slot values', () => {
    it('skips redundant load when A already has slot value', () => {
      const slot = createZpSlot('counter', 0x50);

      // First load sets A state
      generator.testGenLoadByte(createLoadByteInstr(slot));
      // Second load should be skipped
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('emits comment when skipping redundant slot load', () => {
      const slot = createZpSlot('counter', 0x50);

      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'A already has')).toBe(true);
    });

    it('loads when different slot is needed', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      generator.testGenLoadByte(createLoadByteInstr(slot1));
      generator.testGenLoadByte(createLoadByteInstr(slot2));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });

    it('reloads after different slot overwrites A', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      generator.testGenLoadByte(createLoadByteInstr(slot1));
      generator.testGenLoadByte(createLoadByteInstr(slot2));
      generator.testGenLoadByte(createLoadByteInstr(slot1)); // Needs reload

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(3);
    });
  });

  describe('load elimination - immediate values', () => {
    it('skips redundant load when A already has immediate value', () => {
      // First load sets A state
      generator.testGenLoadImm(createLoadImmInstr(42));
      // Second load should be skipped
      generator.testGenLoadImm(createLoadImmInstr(42));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('emits comment when skipping redundant immediate load', () => {
      generator.testGenLoadImm(createLoadImmInstr(42));
      generator.testGenLoadImm(createLoadImmInstr(42));

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'A already has')).toBe(true);
    });

    it('loads when different immediate is needed', () => {
      generator.testGenLoadImm(createLoadImmInstr(42));
      generator.testGenLoadImm(createLoadImmInstr(100));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('slot vs immediate tracking', () => {
    it('loads slot after immediate (different tracking)', () => {
      const slot = createZpSlot('x', 0x50);

      generator.testGenLoadImm(createLoadImmInstr(42));
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      // Both should emit since they're different value sources
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });

    it('loads immediate after slot (different tracking)', () => {
      const slot = createZpSlot('x', 0x50);

      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadImm(createLoadImmInstr(42));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('store preserves A state', () => {
    it('A state preserved after store to same slot', () => {
      const slot = createZpSlot('counter', 0x50);

      // Load sets A state
      generator.testGenLoadByte(createLoadByteInstr(slot));
      // Store preserves A (it still has value at 0x50)
      generator.testGenStoreByte(createStoreByteInstr(slot));
      // Load should be skipped since A still has the value
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      // Only 1 LDA (first load), store doesn't invalidate
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(1);
    });

    it('A state updated to new slot after store', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      generator.testGenLoadByte(createLoadByteInstr(slot1));
      // After storing to slot2, A now has value at 0x51
      generator.testGenStoreByte(createStoreByteInstr(slot2));

      // Loading slot2 should be skipped (A has it)
      generator.testGenLoadByte(createLoadByteInstr(slot2));
      // Loading slot1 should need reload (A no longer has it)
      generator.testGenLoadByte(createLoadByteInstr(slot1));

      const elements = generator.getElements();
      // Load slot1, store slot2, skip load slot2, load slot1
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('invalidation scenarios', () => {
    it('manual invalidation forces reload', () => {
      const slot = createZpSlot('x', 0x50);

      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testInvalidateA();
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });

    it('immediate value cleared by invalidation', () => {
      generator.testGenLoadImm(createLoadImmInstr(42));
      generator.testInvalidateA();
      generator.testGenLoadImm(createLoadImmInstr(42));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('optimization patterns', () => {
    it('optimizes repeated initialization to same value', () => {
      // Common pattern: setting multiple locations to same value
      const slot1 = createZpSlot('a', 0x50);
      const slot2 = createZpSlot('b', 0x51);
      const slot3 = createZpSlot('c', 0x52);

      // Load 0 once
      generator.testGenLoadImm(createLoadImmInstr(0));
      // Store to multiple slots (A stays 0)
      generator.testGenStoreByte(createStoreByteInstr(slot1));
      generator.testGenStoreByte(createStoreByteInstr(slot2));
      generator.testGenStoreByte(createStoreByteInstr(slot3));

      const elements = generator.getElements();
      // Only 1 LDA for initial load
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(3);
    });

    it('optimizes read-modify-write pattern', () => {
      const slot = createZpSlot('counter', 0x50);

      // Load, operate (would invalidate A), store - typical pattern
      // Since we're just testing memory ops, multiple loads to same slot
      // should optimize
      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles value 0 correctly', () => {
      generator.testGenLoadImm(createLoadImmInstr(0));
      generator.testGenLoadImm(createLoadImmInstr(0));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('handles value 255 correctly', () => {
      generator.testGenLoadImm(createLoadImmInstr(255));
      generator.testGenLoadImm(createLoadImmInstr(255));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('handles address 0 slot correctly', () => {
      const slot = createZpSlot('zero', 0x00);

      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('distinguishes address 0 from immediate 0', () => {
      const slot = createZpSlot('zero', 0x00);

      // Load from address 0
      generator.testGenLoadByte(createLoadByteInstr(slot));
      // Load immediate 0 (different - not from slot)
      generator.testGenLoadImm(createLoadImmInstr(0));

      const elements = generator.getElements();
      // Both should emit - slot value vs immediate
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });

    it('handles ZP vs absolute slots with same value range', () => {
      const zpSlot = createZpSlot('zp', 0x50);
      const absSlot = createAbsSlot('abs', 0x0250);

      // Different addresses, both need loads
      generator.testGenLoadByte(createLoadByteInstr(zpSlot));
      generator.testGenLoadByte(createLoadByteInstr(absSlot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('complex sequences', () => {
    it('handles alternating slot pattern', () => {
      const slotA = createZpSlot('a', 0x50);
      const slotB = createZpSlot('b', 0x51);

      // A, B, A, B pattern - no optimization possible
      generator.testGenLoadByte(createLoadByteInstr(slotA));
      generator.testGenLoadByte(createLoadByteInstr(slotB));
      generator.testGenLoadByte(createLoadByteInstr(slotA));
      generator.testGenLoadByte(createLoadByteInstr(slotB));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(4);
    });

    it('handles repeated same-slot pattern', () => {
      const slot = createZpSlot('x', 0x50);

      // X, X, X pattern - all after first are skipped
      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('handles store-then-load to same address', () => {
      const slot = createZpSlot('x', 0x50);

      // Load sets A = value@0x50
      generator.testGenLoadByte(createLoadByteInstr(slot));
      // Store to same address keeps A = value@0x50
      generator.testGenStoreByte(createStoreByteInstr(slot));
      // Load should be skipped
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(1);
    });
  });
});
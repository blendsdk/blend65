/**
 * Accumulator State Tests - CGT2.1
 *
 * Tests for accumulator state tracking in the code generator.
 * The accumulator state is used for simple load elimination:
 * if A already contains the value we need, skip the redundant load.
 *
 * @module __tests__/codegen/generator/accumulator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccumulatorState,
  createUnknownAState,
  createSlotAState,
  createImmediateAState,
  CodeGeneratorBase,
} from '../../../codegen/generator/base.js';
import { ILProgram, ILFunction } from '../../../il/index.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Test subclass to expose protected methods for testing.
 */
class TestableCodeGeneratorBase extends CodeGeneratorBase {
  // Expose protected methods for testing
  public testInvalidateA(): void {
    this.invalidateA();
  }

  public testSetAFromSlot(address: number): void {
    this.setAFromSlot(address);
  }

  public testSetAFromImmediate(value: number): void {
    this.setAFromImmediate(value);
  }

  public testAHasSlot(address: number): boolean {
    return this.aHasSlot(address);
  }

  public testAHasImmediate(value: number): boolean {
    return this.aHasImmediate(value);
  }

  public getAState(): AccumulatorState {
    return this.aState;
  }

  // Override abstract methods
  public generate(_program: ILProgram): never {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Accumulator State Factory Functions', () => {
  describe('createUnknownAState', () => {
    it('creates an unknown state', () => {
      const state = createUnknownAState();
      expect(state.known).toBe(false);
    });

    it('does not have slotAddress', () => {
      const state = createUnknownAState();
      expect(state.slotAddress).toBeUndefined();
    });

    it('does not have immediateValue', () => {
      const state = createUnknownAState();
      expect(state.immediateValue).toBeUndefined();
    });

    it('does not have isWordLow', () => {
      const state = createUnknownAState();
      expect(state.isWordLow).toBeUndefined();
    });
  });

  describe('createSlotAState', () => {
    it('creates a known state with slot address', () => {
      const state = createSlotAState(0x50);
      expect(state.known).toBe(true);
      expect(state.slotAddress).toBe(0x50);
    });

    it('does not have immediateValue', () => {
      const state = createSlotAState(0x50);
      expect(state.immediateValue).toBeUndefined();
    });

    it('handles zero page addresses', () => {
      const state = createSlotAState(0x02);
      expect(state.slotAddress).toBe(0x02);
    });

    it('handles absolute addresses', () => {
      const state = createSlotAState(0x0200);
      expect(state.slotAddress).toBe(0x0200);
    });

    it('handles high addresses', () => {
      const state = createSlotAState(0xD020);
      expect(state.slotAddress).toBe(0xD020);
    });
  });

  describe('createImmediateAState', () => {
    it('creates a known state with immediate value', () => {
      const state = createImmediateAState(42);
      expect(state.known).toBe(true);
      expect(state.immediateValue).toBe(42);
    });

    it('does not have slotAddress', () => {
      const state = createImmediateAState(42);
      expect(state.slotAddress).toBeUndefined();
    });

    it('handles value 0', () => {
      const state = createImmediateAState(0);
      expect(state.immediateValue).toBe(0);
      expect(state.known).toBe(true);
    });

    it('handles value 255', () => {
      const state = createImmediateAState(255);
      expect(state.immediateValue).toBe(255);
    });

    it('handles large values (word)', () => {
      const state = createImmediateAState(0x1234);
      expect(state.immediateValue).toBe(0x1234);
    });
  });
});

// ============================================================================
// CodeGeneratorBase Accumulator State Management Tests
// ============================================================================

describe('CodeGeneratorBase Accumulator State Management', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('initial state', () => {
    it('starts with unknown accumulator state', () => {
      const state = generator.getAState();
      expect(state.known).toBe(false);
    });
  });

  describe('invalidateA', () => {
    it('sets accumulator state to unknown', () => {
      // First, set to known state
      generator.testSetAFromSlot(0x50);
      expect(generator.getAState().known).toBe(true);

      // Then invalidate
      generator.testInvalidateA();
      expect(generator.getAState().known).toBe(false);
    });

    it('clears slot address', () => {
      generator.testSetAFromSlot(0x50);
      generator.testInvalidateA();
      expect(generator.getAState().slotAddress).toBeUndefined();
    });

    it('clears immediate value', () => {
      generator.testSetAFromImmediate(42);
      generator.testInvalidateA();
      expect(generator.getAState().immediateValue).toBeUndefined();
    });
  });

  describe('setAFromSlot', () => {
    it('sets known state with slot address', () => {
      generator.testSetAFromSlot(0x50);
      const state = generator.getAState();
      expect(state.known).toBe(true);
      expect(state.slotAddress).toBe(0x50);
    });

    it('clears previous immediate value', () => {
      generator.testSetAFromImmediate(42);
      generator.testSetAFromSlot(0x50);
      expect(generator.getAState().immediateValue).toBeUndefined();
    });

    it('overwrites previous slot address', () => {
      generator.testSetAFromSlot(0x50);
      generator.testSetAFromSlot(0x60);
      expect(generator.getAState().slotAddress).toBe(0x60);
    });
  });

  describe('setAFromImmediate', () => {
    it('sets known state with immediate value', () => {
      generator.testSetAFromImmediate(42);
      const state = generator.getAState();
      expect(state.known).toBe(true);
      expect(state.immediateValue).toBe(42);
    });

    it('clears previous slot address', () => {
      generator.testSetAFromSlot(0x50);
      generator.testSetAFromImmediate(42);
      expect(generator.getAState().slotAddress).toBeUndefined();
    });

    it('overwrites previous immediate value', () => {
      generator.testSetAFromImmediate(42);
      generator.testSetAFromImmediate(100);
      expect(generator.getAState().immediateValue).toBe(100);
    });

    it('handles value 0', () => {
      generator.testSetAFromImmediate(0);
      expect(generator.getAState().immediateValue).toBe(0);
      expect(generator.getAState().known).toBe(true);
    });
  });

  describe('aHasSlot', () => {
    it('returns false for unknown state', () => {
      expect(generator.testAHasSlot(0x50)).toBe(false);
    });

    it('returns true when A contains matching slot', () => {
      generator.testSetAFromSlot(0x50);
      expect(generator.testAHasSlot(0x50)).toBe(true);
    });

    it('returns false when A contains different slot', () => {
      generator.testSetAFromSlot(0x50);
      expect(generator.testAHasSlot(0x60)).toBe(false);
    });

    it('returns false when A contains immediate', () => {
      generator.testSetAFromImmediate(0x50);
      expect(generator.testAHasSlot(0x50)).toBe(false);
    });

    it('handles address 0', () => {
      generator.testSetAFromSlot(0);
      expect(generator.testAHasSlot(0)).toBe(true);
      expect(generator.testAHasSlot(1)).toBe(false);
    });
  });

  describe('aHasImmediate', () => {
    it('returns false for unknown state', () => {
      expect(generator.testAHasImmediate(42)).toBe(false);
    });

    it('returns true when A contains matching immediate', () => {
      generator.testSetAFromImmediate(42);
      expect(generator.testAHasImmediate(42)).toBe(true);
    });

    it('returns false when A contains different immediate', () => {
      generator.testSetAFromImmediate(42);
      expect(generator.testAHasImmediate(100)).toBe(false);
    });

    it('returns false when A contains slot', () => {
      generator.testSetAFromSlot(42);
      expect(generator.testAHasImmediate(42)).toBe(false);
    });

    it('handles value 0', () => {
      generator.testSetAFromImmediate(0);
      expect(generator.testAHasImmediate(0)).toBe(true);
      expect(generator.testAHasImmediate(1)).toBe(false);
    });
  });
});

// ============================================================================
// Accumulator State Lifecycle Tests
// ============================================================================

describe('Accumulator State Lifecycle', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('tracks slot -> immediate -> invalidate sequence', () => {
    // Initial: unknown
    expect(generator.getAState().known).toBe(false);

    // Load from slot
    generator.testSetAFromSlot(0x50);
    expect(generator.testAHasSlot(0x50)).toBe(true);
    expect(generator.testAHasImmediate(0x50)).toBe(false);

    // Load immediate
    generator.testSetAFromImmediate(42);
    expect(generator.testAHasSlot(0x50)).toBe(false);
    expect(generator.testAHasImmediate(42)).toBe(true);

    // Invalidate (e.g., after arithmetic)
    generator.testInvalidateA();
    expect(generator.getAState().known).toBe(false);
    expect(generator.testAHasImmediate(42)).toBe(false);
  });

  it('tracks repeated slot loads', () => {
    generator.testSetAFromSlot(0x50);
    expect(generator.testAHasSlot(0x50)).toBe(true);

    generator.testSetAFromSlot(0x60);
    expect(generator.testAHasSlot(0x50)).toBe(false);
    expect(generator.testAHasSlot(0x60)).toBe(true);

    generator.testSetAFromSlot(0x70);
    expect(generator.testAHasSlot(0x60)).toBe(false);
    expect(generator.testAHasSlot(0x70)).toBe(true);
  });

  it('tracks repeated immediate loads', () => {
    generator.testSetAFromImmediate(10);
    expect(generator.testAHasImmediate(10)).toBe(true);

    generator.testSetAFromImmediate(20);
    expect(generator.testAHasImmediate(10)).toBe(false);
    expect(generator.testAHasImmediate(20)).toBe(true);

    generator.testSetAFromImmediate(30);
    expect(generator.testAHasImmediate(20)).toBe(false);
    expect(generator.testAHasImmediate(30)).toBe(true);
  });
});

// ============================================================================
// Load Elimination Scenario Tests
// ============================================================================

describe('Load Elimination Scenarios', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('can skip redundant load from same slot', () => {
    // Simulate: LDA $50
    generator.testSetAFromSlot(0x50);

    // Check: can we skip LDA $50 again?
    expect(generator.testAHasSlot(0x50)).toBe(true);
    // Answer: Yes! Skip the redundant load.
  });

  it('cannot skip load from different slot', () => {
    // Simulate: LDA $50
    generator.testSetAFromSlot(0x50);

    // Check: can we skip LDA $60?
    expect(generator.testAHasSlot(0x60)).toBe(false);
    // Answer: No, must load from $60.
  });

  it('can skip redundant load of same immediate', () => {
    // Simulate: LDA #42
    generator.testSetAFromImmediate(42);

    // Check: can we skip LDA #42 again?
    expect(generator.testAHasImmediate(42)).toBe(true);
    // Answer: Yes! Skip the redundant load.
  });

  it('cannot skip load of different immediate', () => {
    // Simulate: LDA #42
    generator.testSetAFromImmediate(42);

    // Check: can we skip LDA #100?
    expect(generator.testAHasImmediate(100)).toBe(false);
    // Answer: No, must load #100.
  });

  it('invalidates after arithmetic operation', () => {
    // Simulate: LDA $50 (load counter)
    generator.testSetAFromSlot(0x50);
    expect(generator.testAHasSlot(0x50)).toBe(true);

    // Simulate: ADC #1 (add 1) - result is unknown
    generator.testInvalidateA();

    // Check: is counter still in A?
    expect(generator.testAHasSlot(0x50)).toBe(false);
    // Answer: No, A now contains counter+1, not counter.
  });

  it('slot address 0 is valid and distinct from immediate 0', () => {
    generator.testSetAFromSlot(0);
    expect(generator.testAHasSlot(0)).toBe(true);
    expect(generator.testAHasImmediate(0)).toBe(false);

    generator.testSetAFromImmediate(0);
    expect(generator.testAHasSlot(0)).toBe(false);
    expect(generator.testAHasImmediate(0)).toBe(true);
  });
});
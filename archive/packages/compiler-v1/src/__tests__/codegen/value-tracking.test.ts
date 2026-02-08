/**
 * Tests for Value Tracking System in BaseCodeGenerator
 *
 * Tests the value tracking infrastructure that enables the code generator
 * to emit correct operands for binary operations instead of placeholders.
 *
 * The value tracking system tracks where IL values are stored at runtime
 * (registers, zero page, memory) and provides methods to load values
 * and format operands accordingly.
 *
 * @module __tests__/codegen/value-tracking.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAcmeEmitter } from '../../asm-il/emitters/index.js';
import { BaseCodeGenerator } from '../../codegen/base-generator.js';
import { ValueLocation } from '../../codegen/types.js';
import type { TrackedValue, CodegenOptions } from '../../codegen/types.js';
import { C64_CONFIG } from '../../target/index.js';

/**
 * Concrete test implementation of BaseCodeGenerator
 *
 * Exposes protected value tracking methods for testing.
 */
class TestValueTrackingGenerator extends BaseCodeGenerator {
  // Assembly output helper
  public getAssemblyOutput(): string {
    const asmModule = this.asmBuilder.build();
    const emitter = createAcmeEmitter();
    return emitter.emit(asmModule).text;
  }

  // Value tracking method exposure
  public exposeTrackValue(ilValueId: string, location: TrackedValue): void {
    this.trackValue(ilValueId, location);
  }

  public exposeGetValueLocation(ilValueId: string): TrackedValue | undefined {
    return this.getValueLocation(ilValueId);
  }

  public exposeLoadValueToA(ilValueId: string): boolean {
    return this.loadValueToA(ilValueId);
  }

  public exposeLoadValueToX(ilValueId: string): boolean {
    return this.loadValueToX(ilValueId);
  }

  public exposeLoadValueToY(ilValueId: string): boolean {
    return this.loadValueToY(ilValueId);
  }

  public exposeFormatOperand(ilValueId: string): string {
    return this.formatOperand(ilValueId);
  }

  public exposeIsValueInA(ilValueId: string): boolean {
    return this.isValueInA(ilValueId);
  }

  public exposeInvalidateRegisters(): void {
    this.invalidateRegisters();
  }

  public exposeInvalidateAccumulator(): void {
    this.invalidateAccumulator();
  }

  public exposeResetValueTracking(): void {
    this.resetValueTracking();
  }

  public exposeResetState(): void {
    this.resetState();
  }

  public exposeGetWarnings(): string[] {
    return this.getWarnings();
  }

  public setOptions(options: CodegenOptions): void {
    this.options = options;
  }
}

describe('Value Tracking System', () => {
  let generator: TestValueTrackingGenerator;

  beforeEach(() => {
    generator = new TestValueTrackingGenerator();
    // Set options so resetState works properly
    generator.setOptions({
      target: C64_CONFIG,
      format: 'prg',
      sourceMap: false,
      debug: 'none',
      loadAddress: 0x0801,
    });
  });

  // ===========================================================================
  // Basic Tracking Tests
  // ===========================================================================

  describe('trackValue() and getValueLocation()', () => {
    it('should track an immediate value', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 42,
      });

      const loc = generator.exposeGetValueLocation('v1');
      expect(loc).toBeDefined();
      expect(loc?.location).toBe(ValueLocation.IMMEDIATE);
      expect(loc?.value).toBe(42);
    });

    it('should track a zero-page value', () => {
      generator.exposeTrackValue('v2', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      const loc = generator.exposeGetValueLocation('v2');
      expect(loc).toBeDefined();
      expect(loc?.location).toBe(ValueLocation.ZERO_PAGE);
      expect(loc?.address).toBe(0x50);
    });

    it('should track an absolute memory value', () => {
      generator.exposeTrackValue('v3', {
        location: ValueLocation.ABSOLUTE,
        address: 0xD020,
      });

      const loc = generator.exposeGetValueLocation('v3');
      expect(loc).toBeDefined();
      expect(loc?.location).toBe(ValueLocation.ABSOLUTE);
      expect(loc?.address).toBe(0xD020);
    });

    it('should track a labeled value', () => {
      generator.exposeTrackValue('v4', {
        location: ValueLocation.LABEL,
        label: '_counter',
      });

      const loc = generator.exposeGetValueLocation('v4');
      expect(loc).toBeDefined();
      expect(loc?.location).toBe(ValueLocation.LABEL);
      expect(loc?.label).toBe('_counter');
    });

    it('should track accumulator location', () => {
      generator.exposeTrackValue('v5', {
        location: ValueLocation.ACCUMULATOR,
      });

      const loc = generator.exposeGetValueLocation('v5');
      expect(loc).toBeDefined();
      expect(loc?.location).toBe(ValueLocation.ACCUMULATOR);
    });

    it('should track X register location', () => {
      generator.exposeTrackValue('v6', {
        location: ValueLocation.X_REGISTER,
      });

      const loc = generator.exposeGetValueLocation('v6');
      expect(loc?.location).toBe(ValueLocation.X_REGISTER);
    });

    it('should track Y register location', () => {
      generator.exposeTrackValue('v7', {
        location: ValueLocation.Y_REGISTER,
      });

      const loc = generator.exposeGetValueLocation('v7');
      expect(loc?.location).toBe(ValueLocation.Y_REGISTER);
    });

    it('should track word (16-bit) values', () => {
      generator.exposeTrackValue('v8', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x60,
        isWord: true,
      });

      const loc = generator.exposeGetValueLocation('v8');
      expect(loc?.isWord).toBe(true);
    });

    it('should return undefined for untracked values', () => {
      const loc = generator.exposeGetValueLocation('unknown');
      expect(loc).toBeUndefined();
    });

    it('should handle SSA-style value IDs', () => {
      generator.exposeTrackValue('v5:i.2', {
        location: ValueLocation.IMMEDIATE,
        value: 100,
      });

      const loc = generator.exposeGetValueLocation('v5:i.2');
      expect(loc).toBeDefined();
      expect(loc?.value).toBe(100);
    });

    it('should overwrite previous tracking for same value ID', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 10,
      });

      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      const loc = generator.exposeGetValueLocation('v1');
      expect(loc?.location).toBe(ValueLocation.ZERO_PAGE);
      expect(loc?.address).toBe(0x50);
    });
  });

  // ===========================================================================
  // Load Value to A Tests
  // ===========================================================================

  describe('loadValueToA()', () => {
    it('should emit nothing when value already in A', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ACCUMULATOR,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('already in A');
    });

    it('should emit LDA immediate for immediate values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 0x42,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDA');
      expect(output).toContain('#$42');
    });

    it('should emit LDA zero-page for ZP values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDA');
      expect(output).toContain('$50');
    });

    it('should emit LDA absolute for absolute values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ABSOLUTE,
        address: 0xD020,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDA');
      expect(output).toContain('$D020');
    });

    it('should emit LDA label for labeled values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.LABEL,
        label: '_counter',
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDA');
      expect(output).toContain('_counter');
    });

    it('should emit TXA for X register values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.X_REGISTER,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TXA');
    });

    it('should emit TYA for Y register values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.Y_REGISTER,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TYA');
    });

    it('should emit PLA for stack values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.STACK,
      });

      const result = generator.exposeLoadValueToA('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('PLA');
    });

    it('should return false and add warning for untracked values', () => {
      const result = generator.exposeLoadValueToA('unknown');
      expect(result).toBe(false);
      const warnings = generator.exposeGetWarnings();
      expect(warnings.some((w) => w.includes('Unknown value location'))).toBe(true);
    });
  });

  // ===========================================================================
  // Load Value to X Tests
  // ===========================================================================

  describe('loadValueToX()', () => {
    it('should emit nothing when value already in X', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.X_REGISTER,
      });

      const result = generator.exposeLoadValueToX('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('already in X');
    });

    it('should emit LDX immediate for immediate values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 0x10,
      });

      const result = generator.exposeLoadValueToX('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDX');
      expect(output).toContain('#$10');
    });

    it('should emit LDX zero-page for ZP values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x30,
      });

      const result = generator.exposeLoadValueToX('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDX');
      expect(output).toContain('$30');
    });

    it('should emit TAX for accumulator values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ACCUMULATOR,
      });

      const result = generator.exposeLoadValueToX('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TAX');
    });

    it('should emit TYA+TAX for Y register values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.Y_REGISTER,
      });

      const result = generator.exposeLoadValueToX('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TYA');
      expect(output).toContain('TAX');
    });
  });

  // ===========================================================================
  // Load Value to Y Tests
  // ===========================================================================

  describe('loadValueToY()', () => {
    it('should emit nothing when value already in Y', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.Y_REGISTER,
      });

      const result = generator.exposeLoadValueToY('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('already in Y');
    });

    it('should emit LDY immediate for immediate values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 0x20,
      });

      const result = generator.exposeLoadValueToY('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDY');
      expect(output).toContain('#$20');
    });

    it('should emit TAY for accumulator values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ACCUMULATOR,
      });

      const result = generator.exposeLoadValueToY('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TAY');
    });

    it('should emit TXA+TAY for X register values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.X_REGISTER,
      });

      const result = generator.exposeLoadValueToY('v1');
      expect(result).toBe(true);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('TXA');
      expect(output).toContain('TAY');
    });
  });

  // ===========================================================================
  // Format Operand Tests
  // ===========================================================================

  describe('formatOperand()', () => {
    it('should format immediate operand correctly', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 0x42,
      });

      const operand = generator.exposeFormatOperand('v1');
      expect(operand).toBe('#$42');
    });

    it('should format zero-page operand correctly', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      const operand = generator.exposeFormatOperand('v1');
      expect(operand).toBe('$50');
    });

    it('should format absolute operand correctly', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ABSOLUTE,
        address: 0xD020,
      });

      const operand = generator.exposeFormatOperand('v1');
      expect(operand).toBe('$D020');
    });

    it('should format label operand correctly', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.LABEL,
        label: '_counter',
      });

      const operand = generator.exposeFormatOperand('v1');
      expect(operand).toBe('_counter');
    });

    it('should return #$00 and add warning for register values', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ACCUMULATOR,
      });

      const operand = generator.exposeFormatOperand('v1');
      expect(operand).toBe('#$00');
      const warnings = generator.exposeGetWarnings();
      expect(warnings.some((w) => w.includes('register'))).toBe(true);
    });

    it('should return #$00 and add warning for untracked values', () => {
      const operand = generator.exposeFormatOperand('unknown');
      expect(operand).toBe('#$00');
      const warnings = generator.exposeGetWarnings();
      expect(warnings.some((w) => w.includes('Unknown'))).toBe(true);
    });
  });

  // ===========================================================================
  // Value Location Checks
  // ===========================================================================

  describe('isValueInA()', () => {
    it('should return true when value is in accumulator', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ACCUMULATOR,
      });

      expect(generator.exposeIsValueInA('v1')).toBe(true);
    });

    it('should return false when value is in other location', () => {
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      expect(generator.exposeIsValueInA('v1')).toBe(false);
    });

    it('should return false for untracked values', () => {
      expect(generator.exposeIsValueInA('unknown')).toBe(false);
    });
  });

  // ===========================================================================
  // Register Invalidation Tests
  // ===========================================================================

  describe('invalidateRegisters()', () => {
    it('should remove all register-tracked values', () => {
      generator.exposeTrackValue('v1', { location: ValueLocation.ACCUMULATOR });
      generator.exposeTrackValue('v2', { location: ValueLocation.X_REGISTER });
      generator.exposeTrackValue('v3', { location: ValueLocation.Y_REGISTER });
      generator.exposeTrackValue('v4', { location: ValueLocation.ZERO_PAGE, address: 0x50 });

      generator.exposeInvalidateRegisters();

      expect(generator.exposeGetValueLocation('v1')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v2')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v3')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v4')).toBeDefined(); // ZP not affected
    });
  });

  describe('invalidateAccumulator()', () => {
    it('should remove only accumulator-tracked values', () => {
      generator.exposeTrackValue('v1', { location: ValueLocation.ACCUMULATOR });
      generator.exposeTrackValue('v2', { location: ValueLocation.X_REGISTER });
      generator.exposeTrackValue('v3', { location: ValueLocation.ZERO_PAGE, address: 0x50 });

      generator.exposeInvalidateAccumulator();

      expect(generator.exposeGetValueLocation('v1')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v2')).toBeDefined(); // X not affected
      expect(generator.exposeGetValueLocation('v3')).toBeDefined(); // ZP not affected
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('resetValueTracking()', () => {
    it('should clear all tracked values', () => {
      generator.exposeTrackValue('v1', { location: ValueLocation.IMMEDIATE, value: 10 });
      generator.exposeTrackValue('v2', { location: ValueLocation.ZERO_PAGE, address: 0x50 });
      generator.exposeTrackValue('v3', { location: ValueLocation.ACCUMULATOR });

      generator.exposeResetValueTracking();

      expect(generator.exposeGetValueLocation('v1')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v2')).toBeUndefined();
      expect(generator.exposeGetValueLocation('v3')).toBeUndefined();
    });
  });

  describe('resetState()', () => {
    it('should also clear value tracking', () => {
      generator.exposeTrackValue('v1', { location: ValueLocation.IMMEDIATE, value: 10 });

      generator.exposeResetState();

      expect(generator.exposeGetValueLocation('v1')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('integration scenarios', () => {
    it('should support tracking workflow: CONST → store → ADD', () => {
      // Simulate: let a = 10; let b = 20; let c = a + b;

      // Track v1 = CONST 10
      generator.exposeTrackValue('v1', {
        location: ValueLocation.IMMEDIATE,
        value: 10,
      });

      // After storing a, track at ZP location
      generator.exposeTrackValue('v1', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x50,
      });

      // Track v2 = CONST 20
      generator.exposeTrackValue('v2', {
        location: ValueLocation.IMMEDIATE,
        value: 20,
      });

      // After storing b, track at ZP location
      generator.exposeTrackValue('v2', {
        location: ValueLocation.ZERO_PAGE,
        address: 0x51,
      });

      // For ADD, we need left operand in A and right operand as operand
      // Load v1 to A
      generator.exposeLoadValueToA('v1');
      // Get v2 as operand for ADC
      const operand = generator.exposeFormatOperand('v2');

      const output = generator.getAssemblyOutput();
      expect(output).toContain('LDA');
      expect(output).toContain('$50'); // Loading v1 from ZP
      expect(operand).toBe('$51'); // v2 at ZP $51
    });

    it('should handle multiple values in different locations', () => {
      generator.exposeTrackValue('const1', { location: ValueLocation.IMMEDIATE, value: 0xFF });
      generator.exposeTrackValue('local1', { location: ValueLocation.ZERO_PAGE, address: 0x02 });
      generator.exposeTrackValue('global1', { location: ValueLocation.ABSOLUTE, address: 0xC000 });
      generator.exposeTrackValue('named', { location: ValueLocation.LABEL, label: '_score' });
      generator.exposeTrackValue('inA', { location: ValueLocation.ACCUMULATOR });
      generator.exposeTrackValue('inX', { location: ValueLocation.X_REGISTER });
      generator.exposeTrackValue('inY', { location: ValueLocation.Y_REGISTER });

      // Verify all are properly tracked
      expect(generator.exposeFormatOperand('const1')).toBe('#$FF');
      expect(generator.exposeFormatOperand('local1')).toBe('$02');
      expect(generator.exposeFormatOperand('global1')).toBe('$C000');
      expect(generator.exposeFormatOperand('named')).toBe('_score');

      // Register values warn but still return fallback
      generator.exposeFormatOperand('inA');
      generator.exposeFormatOperand('inX');
      generator.exposeFormatOperand('inY');
      const warnings = generator.exposeGetWarnings();
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });
  });
});
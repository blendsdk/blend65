/**
 * ASM-IL Types Tests - Addressing Modes
 *
 * Tests for the AsmAddressingMode enum values.
 *
 * @module __tests__/codegen/asm-il/types/addressing-modes.test
 */

import { describe, it, expect } from 'vitest';
import { AsmAddressingMode } from '../../../../codegen/asm-il/types.js';

describe('AsmAddressingMode', () => {
  describe('enum values exist', () => {
    it('should have Implied mode', () => {
      expect(AsmAddressingMode.Implied).toBe('Implied');
    });

    it('should have Accumulator mode', () => {
      expect(AsmAddressingMode.Accumulator).toBe('Accumulator');
    });

    it('should have Immediate mode', () => {
      expect(AsmAddressingMode.Immediate).toBe('Immediate');
    });

    it('should have ZeroPage mode', () => {
      expect(AsmAddressingMode.ZeroPage).toBe('ZeroPage');
    });

    it('should have ZeroPageX mode', () => {
      expect(AsmAddressingMode.ZeroPageX).toBe('ZeroPageX');
    });

    it('should have ZeroPageY mode', () => {
      expect(AsmAddressingMode.ZeroPageY).toBe('ZeroPageY');
    });

    it('should have Absolute mode', () => {
      expect(AsmAddressingMode.Absolute).toBe('Absolute');
    });

    it('should have AbsoluteX mode', () => {
      expect(AsmAddressingMode.AbsoluteX).toBe('AbsoluteX');
    });

    it('should have AbsoluteY mode', () => {
      expect(AsmAddressingMode.AbsoluteY).toBe('AbsoluteY');
    });

    it('should have Indirect mode', () => {
      expect(AsmAddressingMode.Indirect).toBe('Indirect');
    });

    it('should have IndexedIndirect mode', () => {
      expect(AsmAddressingMode.IndexedIndirect).toBe('IndexedIndirect');
    });

    it('should have IndirectIndexed mode', () => {
      expect(AsmAddressingMode.IndirectIndexed).toBe('IndirectIndexed');
    });

    it('should have Relative mode', () => {
      expect(AsmAddressingMode.Relative).toBe('Relative');
    });
  });

  describe('completeness', () => {
    it('should have exactly 13 addressing modes', () => {
      // All 6502 addressing modes
      const allModes = Object.values(AsmAddressingMode);
      expect(allModes).toHaveLength(13);
    });

    it('should contain all standard 6502 addressing modes', () => {
      const allModes = Object.values(AsmAddressingMode);
      
      // Implied and accumulator
      expect(allModes).toContain('Implied');
      expect(allModes).toContain('Accumulator');
      
      // Immediate
      expect(allModes).toContain('Immediate');
      
      // Zero page variants
      expect(allModes).toContain('ZeroPage');
      expect(allModes).toContain('ZeroPageX');
      expect(allModes).toContain('ZeroPageY');
      
      // Absolute variants
      expect(allModes).toContain('Absolute');
      expect(allModes).toContain('AbsoluteX');
      expect(allModes).toContain('AbsoluteY');
      
      // Indirect variants
      expect(allModes).toContain('Indirect');
      expect(allModes).toContain('IndexedIndirect');
      expect(allModes).toContain('IndirectIndexed');
      
      // Relative (for branches)
      expect(allModes).toContain('Relative');
    });
  });

  describe('string enum type safety', () => {
    it('should use string values for serialization safety', () => {
      // Verify all values are strings (not numbers)
      for (const mode of Object.values(AsmAddressingMode)) {
        expect(typeof mode).toBe('string');
      }
    });

    it('should have unique values', () => {
      const values = Object.values(AsmAddressingMode);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
});
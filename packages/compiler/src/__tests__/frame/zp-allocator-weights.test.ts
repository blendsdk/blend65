/**
 * ZP Allocator - Type Weights Tests
 *
 * Tests for ZP_TYPE_WEIGHTS constants and getTypeWeight function.
 *
 * @module __tests__/frame/zp-allocator-weights
 */

import { describe, it, expect } from 'vitest';
import { TypeKind } from '../../semantic/types.js';
import {
  ZP_TYPE_WEIGHTS,
  getTypeWeight,
} from '../../frame/allocator/zp-allocator.js';

describe('ZP Allocator - Type Weights', () => {
  describe('ZP_TYPE_WEIGHTS constants', () => {
    it('should have pointer as highest weight', () => {
      expect(ZP_TYPE_WEIGHTS.pointer).toBe(0x800); // 2048
    });

    it('should have byte as medium weight', () => {
      expect(ZP_TYPE_WEIGHTS.byte).toBe(0x100); // 256
    });

    it('should have bool same as byte', () => {
      expect(ZP_TYPE_WEIGHTS.bool).toBe(ZP_TYPE_WEIGHTS.byte);
    });

    it('should have word as lower weight', () => {
      expect(ZP_TYPE_WEIGHTS.word).toBe(0x080); // 128
    });

    it('should have string same as pointer', () => {
      expect(ZP_TYPE_WEIGHTS.string).toBe(ZP_TYPE_WEIGHTS.pointer);
    });

    it('should have array as zero weight', () => {
      expect(ZP_TYPE_WEIGHTS.array).toBe(0);
    });

    it('should have void as zero weight', () => {
      expect(ZP_TYPE_WEIGHTS.void).toBe(0);
    });

    it('should maintain weight ordering: pointer > byte > word', () => {
      expect(ZP_TYPE_WEIGHTS.pointer).toBeGreaterThan(ZP_TYPE_WEIGHTS.byte);
      expect(ZP_TYPE_WEIGHTS.byte).toBeGreaterThan(ZP_TYPE_WEIGHTS.word);
      expect(ZP_TYPE_WEIGHTS.word).toBeGreaterThan(ZP_TYPE_WEIGHTS.array);
    });
  });

  describe('getTypeWeight', () => {
    it('should return correct weight for Byte', () => {
      expect(getTypeWeight(TypeKind.Byte)).toBe(0x100);
    });

    it('should return correct weight for Bool', () => {
      expect(getTypeWeight(TypeKind.Bool)).toBe(0x100);
    });

    it('should return correct weight for Word', () => {
      expect(getTypeWeight(TypeKind.Word)).toBe(0x080);
    });

    it('should return correct weight for String', () => {
      expect(getTypeWeight(TypeKind.String)).toBe(0x800);
    });

    it('should return correct weight for Array', () => {
      expect(getTypeWeight(TypeKind.Array)).toBe(0);
    });

    it('should return correct weight for Void', () => {
      expect(getTypeWeight(TypeKind.Void)).toBe(0);
    });

    it('should return byte weight for unknown types', () => {
      // Use a numeric value that doesn't match any TypeKind
      expect(getTypeWeight(999 as TypeKind)).toBe(ZP_TYPE_WEIGHTS.byte);
    });
  });
});
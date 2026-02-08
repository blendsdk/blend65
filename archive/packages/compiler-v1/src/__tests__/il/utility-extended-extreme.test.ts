/**
 * IL Utility Extended - Extreme Tests
 *
 * Extreme edge case tests for Utility and CompileTime intrinsic categories.
 * These tests verify category-level organization and properties for:
 * - IntrinsicCategory.Utility (lo, hi)
 * - IntrinsicCategory.CompileTime (sizeof, length)
 * - Category filtering via getByCategory()
 * - Category consistency and mutual exclusion
 * - Global registry category counts
 *
 * Task 5a.3: Extended testing for utility intrinsics registry definitions.
 *
 * @module il/utility-extended-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';

// =============================================================================
// Extreme Test Category: Utility Category Filtering
// =============================================================================

describe('Utility Extended Extreme Tests', () => {
  describe('Utility Category Filtering', () => {
    /**
     * Verify getByCategory returns exactly 2 Utility intrinsics (lo, hi).
     */
    it('should return exactly 2 Utility intrinsics', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      expect(utility).toHaveLength(2);
    });

    /**
     * Verify lo is in Utility category.
     */
    it('should include lo in Utility category', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      const names = utility.map((i) => i.name);
      expect(names).toContain('lo');
    });

    /**
     * Verify hi is in Utility category.
     */
    it('should include hi in Utility category', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      const names = utility.map((i) => i.name);
      expect(names).toContain('hi');
    });
  });

  // ===========================================================================
  // Extreme Test Category: CompileTime Category Filtering
  // ===========================================================================

  describe('CompileTime Category Filtering', () => {
    /**
     * Verify getByCategory returns exactly 2 CompileTime intrinsics (sizeof, length).
     */
    it('should return exactly 2 CompileTime intrinsics', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      expect(compileTime).toHaveLength(2);
    });

    /**
     * Verify sizeof is in CompileTime category.
     */
    it('should include sizeof in CompileTime category', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      const names = compileTime.map((i) => i.name);
      expect(names).toContain('sizeof');
    });

    /**
     * Verify length is in CompileTime category.
     */
    it('should include length in CompileTime category', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      const names = compileTime.map((i) => i.name);
      expect(names).toContain('length');
    });

    /**
     * Verify all CompileTime intrinsics have isCompileTime=true.
     */
    it('should have isCompileTime=true for all CompileTime category intrinsics', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      for (const def of compileTime) {
        expect(def.isCompileTime).toBe(true);
      }
    });

    /**
     * Verify all CompileTime intrinsics have null opcode (no runtime IL).
     */
    it('should have null opcode for all CompileTime intrinsics', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      for (const def of compileTime) {
        expect(def.opcode).toBeNull();
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Category Mutual Exclusion
  // ===========================================================================

  describe('Category Mutual Exclusion', () => {
    /**
     * Verify Utility and CompileTime categories are distinct (no overlap).
     */
    it('should have no overlap between Utility and CompileTime', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);

      const utilityNames = new Set(utility.map((i) => i.name));
      const compileTimeNames = compileTime.map((i) => i.name);

      for (const name of compileTimeNames) {
        expect(utilityNames.has(name)).toBe(false);
      }
    });

    /**
     * Verify lo is NOT in CompileTime category.
     * lo has a runtime opcode (INTRINSIC_LO).
     */
    it('should not have lo in CompileTime category', () => {
      const compileTime = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.CompileTime);
      const names = compileTime.map((i) => i.name);
      expect(names).not.toContain('lo');
    });

    /**
     * Verify sizeof is NOT in Utility category.
     * sizeof is purely compile-time.
     */
    it('should not have sizeof in Utility category', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      const names = utility.map((i) => i.name);
      expect(names).not.toContain('sizeof');
    });
  });

  // ===========================================================================
  // Extreme Test Category: Utility Properties Consistency
  // ===========================================================================

  describe('Utility Properties Consistency', () => {
    /**
     * Verify all Utility intrinsics have no side effects (pure functions).
     */
    it('should have no side effects for all Utility intrinsics', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      for (const def of utility) {
        expect(def.hasSideEffects).toBe(false);
      }
    });

    /**
     * Verify all Utility intrinsics are NOT compile-time only.
     * They have runtime opcodes.
     */
    it('should not be compile-time for Utility intrinsics', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      for (const def of utility) {
        expect(def.isCompileTime).toBe(false);
      }
    });

    /**
     * Verify all Utility intrinsics have valid opcodes (not null).
     */
    it('should have valid opcodes for all Utility intrinsics', () => {
      const utility = INTRINSIC_REGISTRY.getByCategory(IntrinsicCategory.Utility);
      for (const def of utility) {
        expect(def.opcode).not.toBeNull();
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Global Registry Utility/CompileTime Intrinsics
  // ===========================================================================

  describe('Global Registry Utility/CompileTime Intrinsics', () => {
    /**
     * Verify lo, hi are present in global INTRINSIC_REGISTRY.
     */
    it('should have lo and hi in global registry', () => {
      expect(INTRINSIC_REGISTRY.isIntrinsic('lo')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('hi')).toBe(true);
    });

    /**
     * Verify sizeof, length are present in global INTRINSIC_REGISTRY.
     */
    it('should have sizeof and length in global registry', () => {
      expect(INTRINSIC_REGISTRY.isIntrinsic('sizeof')).toBe(true);
      expect(INTRINSIC_REGISTRY.isIntrinsic('length')).toBe(true);
    });
  });
});
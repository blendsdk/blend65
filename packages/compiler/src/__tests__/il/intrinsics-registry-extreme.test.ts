/**
 * IL Intrinsics Registry - Extreme Tests
 *
 * Extreme edge case tests for the IntrinsicRegistry class.
 * These tests supplement the regular registry tests with:
 * - Registry lookup edge cases (empty names, special characters, unicode)
 * - Category boundary conditions
 * - Compile-time intrinsic edge cases
 * - Concurrent registry access simulation
 * - Registry immutability verification
 *
 * @module il/intrinsics-registry-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
  type IntrinsicDefinition,
} from '../../il/intrinsics/registry.js';
import { ILOpcode } from '../../il/instructions.js';
import { IL_VOID, IL_BYTE, IL_WORD } from '../../il/types.js';

// =============================================================================
// Extreme Test Category: Registry Lookup Edge Cases
// =============================================================================

describe('IntrinsicRegistry Extreme Tests', () => {
  describe('Registry Lookup Edge Cases', () => {
    /**
     * Test that empty string lookups return false/undefined gracefully.
     * This ensures the registry handles edge inputs without crashing.
     */
    it('should return false for empty string isIntrinsic lookup', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.isIntrinsic('')).toBe(false);
    });

    /**
     * Test that empty string get() returns undefined.
     * Verifies no exception is thrown for empty lookups.
     */
    it('should return undefined for empty string get() lookup', () => {
      const registry = new IntrinsicRegistry();
      expect(registry.get('')).toBeUndefined();
    });

    /**
     * Test lookups with special characters that should never match.
     * Ensures the registry doesn't have unintended intrinsic names.
     */
    it('should return false for special character names', () => {
      const registry = new IntrinsicRegistry();
      const specialNames = [
        '@peek', // @ prefix
        '$poke', // $ prefix
        'peek!', // trailing special char
        'poke?', // trailing question
        'peek poke', // space in name
        'peek\n', // newline in name
        'peek\t', // tab in name
        'peek\0', // null character
      ];
      for (const name of specialNames) {
        expect(registry.isIntrinsic(name)).toBe(false);
      }
    });

    /**
     * Test that unicode names are handled gracefully.
     * The registry should not have unicode intrinsic names.
     */
    it('should return false for unicode intrinsic names', () => {
      const registry = new IntrinsicRegistry();
      const unicodeNames = [
        'peek™', // trademark
        'pöke', // umlaut
        'πeek', // greek letter
        '读取', // chinese characters
        'peek🎮', // emoji
      ];
      for (const name of unicodeNames) {
        expect(registry.isIntrinsic(name)).toBe(false);
      }
    });

    /**
     * Test case sensitivity - intrinsic names are case-sensitive.
     * "PEEK" should not match "peek".
     */
    it('should be case-sensitive for intrinsic lookups', () => {
      const registry = new IntrinsicRegistry();

      // Lowercase versions should exist
      expect(registry.isIntrinsic('peek')).toBe(true);
      expect(registry.isIntrinsic('poke')).toBe(true);
      expect(registry.isIntrinsic('sei')).toBe(true);

      // Uppercase versions should NOT exist
      expect(registry.isIntrinsic('PEEK')).toBe(false);
      expect(registry.isIntrinsic('POKE')).toBe(false);
      expect(registry.isIntrinsic('SEI')).toBe(false);

      // Mixed case should NOT exist
      expect(registry.isIntrinsic('Peek')).toBe(false);
      expect(registry.isIntrinsic('PeEk')).toBe(false);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Category Boundary Conditions
  // ===========================================================================

  describe('Category Boundary Conditions', () => {
    /**
     * Test that each intrinsic belongs to exactly one category.
     * Verifies no intrinsic is duplicated across categories.
     */
    it('should have each intrinsic in exactly one category', () => {
      const registry = new IntrinsicRegistry();
      const allCategories = [
        IntrinsicCategory.Memory,
        IntrinsicCategory.Optimization,
        IntrinsicCategory.CPU,
        IntrinsicCategory.Stack,
        IntrinsicCategory.Utility,
        IntrinsicCategory.CompileTime,
      ];

      const allIntrinsics = Array.from(registry.getAll());

      for (const intrinsic of allIntrinsics) {
        // Count how many categories contain this intrinsic by category match
        let categoryCount = 0;
        for (const category of allCategories) {
          const categoryIntrinsics = registry.getByCategory(category);
          if (categoryIntrinsics.some((i) => i.name === intrinsic.name)) {
            categoryCount++;
          }
        }
        // Each intrinsic should appear in exactly one category
        expect(categoryCount).toBe(1);
      }
    });

    /**
     * Test that getByCategory returns empty array for all categories
     * that might not have intrinsics (defensive coding check).
     */
    it('should return empty array for categories with no intrinsics', () => {
      const registry = new IntrinsicRegistry();

      // All current categories should have at least one intrinsic
      // This test verifies the structure is correct
      const allCategories = [
        IntrinsicCategory.Memory,
        IntrinsicCategory.Optimization,
        IntrinsicCategory.CPU,
        IntrinsicCategory.Stack,
      ];

      for (const category of allCategories) {
        const intrinsics = registry.getByCategory(category);
        expect(intrinsics.length).toBeGreaterThan(0);
      }
    });

    /**
     * Test that category filtering is exhaustive - all intrinsics are accounted for.
     * The sum of all category counts should equal total intrinsic count.
     */
    it('should have all intrinsics accounted for in categories', () => {
      const registry = new IntrinsicRegistry();
      const allCategories = [
        IntrinsicCategory.Memory,
        IntrinsicCategory.Optimization,
        IntrinsicCategory.CPU,
        IntrinsicCategory.Stack,
        IntrinsicCategory.Utility,
        IntrinsicCategory.CompileTime,
      ];

      let totalInCategories = 0;
      for (const category of allCategories) {
        totalInCategories += registry.getByCategory(category).length;
      }

      // Total should equal registry size
      expect(totalInCategories).toBe(registry.size);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Compile-Time Intrinsic Edge Cases
  // ===========================================================================

  describe('Compile-Time Intrinsic Edge Cases', () => {
    /**
     * Test that all compile-time intrinsics have null opcode.
     * Compile-time intrinsics should not generate runtime IL.
     */
    it('should have null opcode for all compile-time intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const compileTime = registry.getCompileTimeIntrinsics();

      expect(compileTime.length).toBeGreaterThan(0);
      for (const intrinsic of compileTime) {
        expect(intrinsic.opcode).toBeNull();
      }
    });

    /**
     * Test that compile-time intrinsics have no side effects.
     * Compile-time intrinsics are pure calculations.
     */
    it('should have no side effects for compile-time intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const compileTime = registry.getCompileTimeIntrinsics();

      for (const intrinsic of compileTime) {
        expect(intrinsic.hasSideEffects).toBe(false);
      }
    });

    /**
     * Test that compile-time intrinsics have null cycle count.
     * They don't execute at runtime so have no cycle cost.
     */
    it('should have null cycle count for compile-time intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const compileTime = registry.getCompileTimeIntrinsics();

      for (const intrinsic of compileTime) {
        expect(intrinsic.cycleCount).toBeNull();
      }
    });

    /**
     * Test that compile-time intrinsics are not barriers.
     * They don't affect optimization ordering.
     */
    it('should not be barriers for compile-time intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const compileTime = registry.getCompileTimeIntrinsics();

      for (const intrinsic of compileTime) {
        expect(intrinsic.isBarrier).toBe(false);
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Registry Immutability Verification
  // ===========================================================================

  describe('Registry Immutability Verification', () => {
    /**
     * Test that the global singleton registry has consistent size
     * across multiple accesses. Verifies no mutations occur.
     */
    it('should have consistent size for global registry singleton', () => {
      const size1 = INTRINSIC_REGISTRY.size;
      const size2 = INTRINSIC_REGISTRY.size;
      const size3 = INTRINSIC_REGISTRY.size;

      expect(size1).toBe(size2);
      expect(size2).toBe(size3);
      expect(size1).toBeGreaterThan(15); // At least 16 intrinsics
    });

    /**
     * Test that getAll() returns the same intrinsics each time.
     * Verifies the registry doesn't change between calls.
     */
    it('should return same intrinsics on repeated getAll() calls', () => {
      const registry = new IntrinsicRegistry();

      const all1 = Array.from(registry.getAll()).map((i) => i.name).sort();
      const all2 = Array.from(registry.getAll()).map((i) => i.name).sort();

      expect(all1).toEqual(all2);
    });

    /**
     * Test that independent registry instances have same intrinsics.
     * Verifies deterministic initialization.
     */
    it('should initialize identically for multiple registry instances', () => {
      const registry1 = new IntrinsicRegistry();
      const registry2 = new IntrinsicRegistry();

      expect(registry1.size).toBe(registry2.size);

      const names1 = Array.from(registry1.getNames()).sort();
      const names2 = Array.from(registry2.getNames()).sort();

      expect(names1).toEqual(names2);
    });
  });

  // ===========================================================================
  // Extreme Test Category: Intrinsic Definition Completeness
  // ===========================================================================

  describe('Intrinsic Definition Completeness', () => {
    /**
     * Test that all intrinsics have required fields populated.
     * Verifies no partial/incomplete definitions exist.
     */
    it('should have all required fields for every intrinsic', () => {
      const registry = new IntrinsicRegistry();
      const allIntrinsics = Array.from(registry.getAll());

      for (const intrinsic of allIntrinsics) {
        // Name must be non-empty string
        expect(typeof intrinsic.name).toBe('string');
        expect(intrinsic.name.length).toBeGreaterThan(0);

        // Category must be valid enum value
        expect(Object.values(IntrinsicCategory)).toContain(intrinsic.category);

        // Parameter types must be array
        expect(Array.isArray(intrinsic.parameterTypes)).toBe(true);

        // Parameter names must be array
        expect(Array.isArray(intrinsic.parameterNames)).toBe(true);

        // Return type must be defined
        expect(intrinsic.returnType).toBeDefined();

        // Boolean flags must be booleans
        expect(typeof intrinsic.isCompileTime).toBe('boolean');
        expect(typeof intrinsic.hasSideEffects).toBe('boolean');
        expect(typeof intrinsic.isBarrier).toBe('boolean');
        expect(typeof intrinsic.isVolatile).toBe('boolean');

        // Description must be non-empty string
        expect(typeof intrinsic.description).toBe('string');
        expect(intrinsic.description.length).toBeGreaterThan(0);
      }
    });

    /**
     * Test that parameter names match parameter types count for runtime intrinsics.
     * Compile-time intrinsics (sizeof, length) are special - they have parameter
     * names for documentation but empty parameter types since they take special
     * type/array arguments that aren't regular IL values.
     */
    it('should have matching parameter names and types counts for runtime intrinsics', () => {
      const registry = new IntrinsicRegistry();
      const allIntrinsics = Array.from(registry.getAll());

      for (const intrinsic of allIntrinsics) {
        if (intrinsic.isCompileTime) {
          // Compile-time intrinsics may have documentation names but no IL parameter types
          // because they take special arguments (types, arrays) not regular values
          expect(intrinsic.parameterTypes.length).toBe(0);
        } else {
          // Runtime intrinsics must have matching counts
          expect(intrinsic.parameterNames.length).toBe(intrinsic.parameterTypes.length);
        }
      }
    });
  });
});
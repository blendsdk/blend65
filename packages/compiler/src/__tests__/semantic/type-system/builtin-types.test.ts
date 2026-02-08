/**
 * Type System Tests - Built-in Types
 *
 * Tests for built-in type definitions and access methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';

describe('TypeSystem - Built-in Types', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  // ==========================================================================
  // Built-in Type Existence
  // ==========================================================================

  describe('built-in type existence', () => {
    it('should have byte type', () => {
      const byteType = typeSystem.getBuiltinType('byte');
      expect(byteType).toBeDefined();
      expect(byteType!.kind).toBe(TypeKind.Byte);
    });

    it('should have word type', () => {
      const wordType = typeSystem.getBuiltinType('word');
      expect(wordType).toBeDefined();
      expect(wordType!.kind).toBe(TypeKind.Word);
    });

    it('should have bool type', () => {
      const boolType = typeSystem.getBuiltinType('bool');
      expect(boolType).toBeDefined();
      expect(boolType!.kind).toBe(TypeKind.Bool);
    });

    it('should have void type', () => {
      const voidType = typeSystem.getBuiltinType('void');
      expect(voidType).toBeDefined();
      expect(voidType!.kind).toBe(TypeKind.Void);
    });

    it('should have string type', () => {
      const stringType = typeSystem.getBuiltinType('string');
      expect(stringType).toBeDefined();
      expect(stringType!.kind).toBe(TypeKind.String);
    });

    it('should return undefined for unknown type name', () => {
      const unknownType = typeSystem.getBuiltinType('unknown_type');
      expect(unknownType).toBeUndefined();
    });
  });

  // ==========================================================================
  // Byte Type Properties
  // ==========================================================================

  describe('byte type properties', () => {
    it('should have correct name', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      expect(byteType.name).toBe('byte');
    });

    it('should have size of 1 byte', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      expect(byteType.size).toBe(1);
    });

    it('should be unsigned', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      expect(byteType.isSigned).toBe(false);
    });

    it('should be assignable', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      expect(byteType.isAssignable).toBe(true);
    });
  });

  // ==========================================================================
  // Word Type Properties
  // ==========================================================================

  describe('word type properties', () => {
    it('should have correct name', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      expect(wordType.name).toBe('word');
    });

    it('should have size of 2 bytes', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      expect(wordType.size).toBe(2);
    });

    it('should be unsigned', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      expect(wordType.isSigned).toBe(false);
    });

    it('should be assignable', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      expect(wordType.isAssignable).toBe(true);
    });
  });

  // ==========================================================================
  // Bool Type Properties
  // ==========================================================================

  describe('bool type properties', () => {
    it('should have correct name', () => {
      const boolType = typeSystem.getBuiltinType('bool')!;
      expect(boolType.name).toBe('bool');
    });

    it('should have size of 1 byte', () => {
      const boolType = typeSystem.getBuiltinType('bool')!;
      expect(boolType.size).toBe(1);
    });

    it('should be unsigned', () => {
      const boolType = typeSystem.getBuiltinType('bool')!;
      expect(boolType.isSigned).toBe(false);
    });

    it('should be assignable', () => {
      const boolType = typeSystem.getBuiltinType('bool')!;
      expect(boolType.isAssignable).toBe(true);
    });
  });

  // ==========================================================================
  // Void Type Properties
  // ==========================================================================

  describe('void type properties', () => {
    it('should have correct name', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(voidType.name).toBe('void');
    });

    it('should have size of 0 bytes', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(voidType.size).toBe(0);
    });

    it('should NOT be assignable', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(voidType.isAssignable).toBe(false);
    });
  });

  // ==========================================================================
  // String Type Properties
  // ==========================================================================

  describe('string type properties', () => {
    it('should have correct name', () => {
      const stringType = typeSystem.getBuiltinType('string')!;
      expect(stringType.name).toBe('string');
    });

    it('should have size of 0 (variable size)', () => {
      const stringType = typeSystem.getBuiltinType('string')!;
      expect(stringType.size).toBe(0);
    });

    it('should NOT be assignable', () => {
      const stringType = typeSystem.getBuiltinType('string')!;
      expect(stringType.isAssignable).toBe(false);
    });
  });

  // ==========================================================================
  // isBuiltinType Method
  // ==========================================================================

  describe('isBuiltinType', () => {
    it('should return true for byte', () => {
      expect(typeSystem.isBuiltinType('byte')).toBe(true);
    });

    it('should return true for word', () => {
      expect(typeSystem.isBuiltinType('word')).toBe(true);
    });

    it('should return true for bool', () => {
      expect(typeSystem.isBuiltinType('bool')).toBe(true);
    });

    it('should return true for void', () => {
      expect(typeSystem.isBuiltinType('void')).toBe(true);
    });

    it('should return true for string', () => {
      expect(typeSystem.isBuiltinType('string')).toBe(true);
    });

    it('should return false for unknown type name', () => {
      expect(typeSystem.isBuiltinType('unknown')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(typeSystem.isBuiltinType('')).toBe(false);
    });

    it('should return false for array type name', () => {
      expect(typeSystem.isBuiltinType('byte[]')).toBe(false);
    });
  });

  // ==========================================================================
  // getBuiltinTypeNames Method
  // ==========================================================================

  describe('getBuiltinTypeNames', () => {
    it('should return all 5 built-in type names', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toHaveLength(5);
    });

    it('should include byte', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toContain('byte');
    });

    it('should include word', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toContain('word');
    });

    it('should include bool', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toContain('bool');
    });

    it('should include void', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toContain('void');
    });

    it('should include string', () => {
      const names = typeSystem.getBuiltinTypeNames();
      expect(names).toContain('string');
    });
  });
});
/**
 * Type System Tests - Operator Type Resolution
 *
 * Tests for binary and unary operator result type resolution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';

describe('TypeSystem - Operator Type Resolution', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  // ==========================================================================
  // Binary Arithmetic Operators
  // ==========================================================================

  describe('binary arithmetic operators (+, -, *, /, %)', () => {
    describe('addition (+)', () => {
      it('should return byte for byte + byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(byte, byte, '+');

        expect(result).toBeDefined();
        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for word + word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, word, '+');

        expect(result).toBeDefined();
        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return word for byte + word (promotion)', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(byte, word, '+');

        expect(result).toBeDefined();
        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return word for word + byte (promotion)', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, byte, '+');

        expect(result).toBeDefined();
        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return undefined for string + byte', () => {
        const str = typeSystem.getBuiltinType('string')!;
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(str, byte, '+');

        expect(result).toBeUndefined();
      });
    });

    describe('subtraction (-)', () => {
      it('should return byte for byte - byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(byte, byte, '-');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for word - word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, word, '-');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('multiplication (*)', () => {
      it('should return byte for byte * byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(byte, byte, '*');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for word * word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, word, '*');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('division (/)', () => {
      it('should return byte for byte / byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(byte, byte, '/');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for word / word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, word, '/');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('modulo (%)', () => {
      it('should return byte for byte % byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getBinaryOperationType(byte, byte, '%');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for word % word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getBinaryOperationType(word, word, '%');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });
  });

  // ==========================================================================
  // Binary Comparison Operators
  // ==========================================================================

  describe('binary comparison operators (==, !=, <, >, <=, >=)', () => {
    it('should return bool for byte == byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '==');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for word == word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(word, word, '==');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte != byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '!=');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte < byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '<');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte > byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '>');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte <= byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '<=');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte >= byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '>=');

      expect(result!.kind).toBe(TypeKind.Bool);
    });
  });

  // ==========================================================================
  // Binary Logical Operators
  // ==========================================================================

  describe('binary logical operators (&&, ||)', () => {
    it('should return bool for bool && bool', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      const result = typeSystem.getBinaryOperationType(bool, bool, '&&');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for bool || bool', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      const result = typeSystem.getBinaryOperationType(bool, bool, '||');

      expect(result!.kind).toBe(TypeKind.Bool);
    });

    it('should return bool for byte && byte (truthy values)', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '&&');

      expect(result!.kind).toBe(TypeKind.Bool);
    });
  });

  // ==========================================================================
  // Binary Bitwise Operators
  // ==========================================================================

  describe('binary bitwise operators (&, |, ^, <<, >>)', () => {
    it('should return byte for byte & byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '&');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return word for word & word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(word, word, '&');

      expect(result!.kind).toBe(TypeKind.Word);
    });

    it('should return word for byte & word (promotion)', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(byte, word, '&');

      expect(result!.kind).toBe(TypeKind.Word);
    });

    it('should return byte for byte | byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '|');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return byte for byte ^ byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '^');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return byte for byte << byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '<<');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return byte for byte >> byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '>>');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return undefined for string & byte', () => {
      const str = typeSystem.getBuiltinType('string')!;
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(str, byte, '&');

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // Assignment Operators
  // ==========================================================================

  describe('assignment operators (=, +=, -=, etc.)', () => {
    it('should return left type for byte = byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '=');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return left type for word = byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(word, byte, '=');

      expect(result!.kind).toBe(TypeKind.Word);
    });

    it('should return left type for byte += byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '+=');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return left type for byte -= byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '-=');

      expect(result!.kind).toBe(TypeKind.Byte);
    });

    it('should return left type for byte &= byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '&=');

      expect(result!.kind).toBe(TypeKind.Byte);
    });
  });

  // ==========================================================================
  // Unknown Operators
  // ==========================================================================

  describe('unknown operators', () => {
    it('should return undefined for unknown operator', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byte, byte, '???');

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // Unary Operators
  // ==========================================================================

  describe('unary operators', () => {
    describe('logical NOT (!)', () => {
      it('should return bool for !bool', () => {
        const bool = typeSystem.getBuiltinType('bool')!;
        const result = typeSystem.getUnaryOperationType(bool, '!');

        expect(result!.kind).toBe(TypeKind.Bool);
      });

      it('should return bool for !byte (truthy)', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '!');

        expect(result!.kind).toBe(TypeKind.Bool);
      });
    });

    describe('bitwise NOT (~)', () => {
      it('should return byte for ~byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '~');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for ~word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '~');

        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return undefined for ~string', () => {
        const str = typeSystem.getBuiltinType('string')!;
        const result = typeSystem.getUnaryOperationType(str, '~');

        expect(result).toBeUndefined();
      });
    });

    describe('negation (-)', () => {
      it('should return byte for -byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '-');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for -word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '-');

        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return undefined for -string', () => {
        const str = typeSystem.getBuiltinType('string')!;
        const result = typeSystem.getUnaryOperationType(str, '-');

        expect(result).toBeUndefined();
      });
    });

    describe('unary plus (+)', () => {
      it('should return byte for +byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '+');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for +word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '+');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('address-of (@)', () => {
      it('should return word for @byte (address)', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '@');

        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return word for @word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '@');

        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return word for @array', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const array = typeSystem.createArrayType(byte, 10);
        const result = typeSystem.getUnaryOperationType(array, '@');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('increment (++)', () => {
      it('should return byte for ++byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '++');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for ++word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '++');

        expect(result!.kind).toBe(TypeKind.Word);
      });

      it('should return undefined for ++string', () => {
        const str = typeSystem.getBuiltinType('string')!;
        const result = typeSystem.getUnaryOperationType(str, '++');

        expect(result).toBeUndefined();
      });
    });

    describe('decrement (--)', () => {
      it('should return byte for --byte', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '--');

        expect(result!.kind).toBe(TypeKind.Byte);
      });

      it('should return word for --word', () => {
        const word = typeSystem.getBuiltinType('word')!;
        const result = typeSystem.getUnaryOperationType(word, '--');

        expect(result!.kind).toBe(TypeKind.Word);
      });
    });

    describe('unknown unary operator', () => {
      it('should return undefined for unknown unary operator', () => {
        const byte = typeSystem.getBuiltinType('byte')!;
        const result = typeSystem.getUnaryOperationType(byte, '???');

        expect(result).toBeUndefined();
      });
    });
  });
});
/**
 * Built-in Functions System Tests (Simplified)
 * GitHub Issue #42: Minimal Built-in Functions System for Memory Access (Core Functions Only)
 *
 * Simplified tests focusing on core functionality without complex AST metadata
 */

import { describe, it, expect } from 'vitest';
import {
  isBuiltInFunction,
  getBuiltInFunction,
  getAllBuiltInFunctionNames,
} from '../analyzers/expression-analyzer.js';
import { createPrimitiveType } from '../types.js';

describe('Built-in Functions System (Core)', () => {
  describe('Function Registry', () => {
    it('should recognize all 5 core built-in functions', () => {
      const expectedFunctions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];
      const actualFunctions = getAllBuiltInFunctionNames();

      expect(actualFunctions).toHaveLength(5);
      for (const func of expectedFunctions) {
        expect(actualFunctions).toContain(func);
        expect(isBuiltInFunction(func)).toBe(true);
      }
    });

    it('should not recognize non-built-in functions', () => {
      const nonBuiltinFunctions = ['print', 'abs', 'min', 'max', 'random', 'memcopy'];

      for (const func of nonBuiltinFunctions) {
        expect(isBuiltInFunction(func)).toBe(false);
        expect(getBuiltInFunction(func)).toBeUndefined();
      }
    });
  });

  describe('Function Signatures', () => {
    it('should define peek() correctly', () => {
      const peekDef = getBuiltInFunction('peek')!;
      expect(peekDef.name).toBe('peek');
      expect(peekDef.parameters).toHaveLength(1);
      expect(peekDef.parameters[0].name).toBe('address');
      expect(peekDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(peekDef.returnType).toEqual(createPrimitiveType('byte'));
      expect(peekDef.hasSideEffects).toBe(false);
      expect(peekDef.accessesHardware).toBe(true);
      expect(peekDef.description).toContain('Read 8-bit value');
    });

    it('should define poke() correctly', () => {
      const pokeDef = getBuiltInFunction('poke')!;
      expect(pokeDef.name).toBe('poke');
      expect(pokeDef.parameters).toHaveLength(2);
      expect(pokeDef.parameters[0].name).toBe('address');
      expect(pokeDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(pokeDef.parameters[1].name).toBe('value');
      expect(pokeDef.parameters[1].type).toEqual(createPrimitiveType('byte'));
      expect(pokeDef.returnType).toEqual(createPrimitiveType('void'));
      expect(pokeDef.hasSideEffects).toBe(true);
      expect(pokeDef.accessesHardware).toBe(true);
      expect(pokeDef.description).toContain('Write 8-bit value');
    });

    it('should define peekw() correctly', () => {
      const peekwDef = getBuiltInFunction('peekw')!;
      expect(peekwDef.name).toBe('peekw');
      expect(peekwDef.parameters).toHaveLength(1);
      expect(peekwDef.parameters[0].name).toBe('address');
      expect(peekwDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(peekwDef.returnType).toEqual(createPrimitiveType('word'));
      expect(peekwDef.hasSideEffects).toBe(false);
      expect(peekwDef.accessesHardware).toBe(true);
      expect(peekwDef.description).toContain('Read 16-bit value');
    });

    it('should define pokew() correctly', () => {
      const pokewDef = getBuiltInFunction('pokew')!;
      expect(pokewDef.name).toBe('pokew');
      expect(pokewDef.parameters).toHaveLength(2);
      expect(pokewDef.parameters[0].name).toBe('address');
      expect(pokewDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(pokewDef.parameters[1].name).toBe('value');
      expect(pokewDef.parameters[1].type).toEqual(createPrimitiveType('word'));
      expect(pokewDef.returnType).toEqual(createPrimitiveType('void'));
      expect(pokewDef.hasSideEffects).toBe(true);
      expect(pokewDef.accessesHardware).toBe(true);
      expect(pokewDef.description).toContain('Write 16-bit value');
    });

    it('should define sys() correctly', () => {
      const sysDef = getBuiltInFunction('sys')!;
      expect(sysDef.name).toBe('sys');
      expect(sysDef.parameters).toHaveLength(1);
      expect(sysDef.parameters[0].name).toBe('address');
      expect(sysDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(sysDef.returnType).toEqual(createPrimitiveType('void'));
      expect(sysDef.hasSideEffects).toBe(true);
      expect(sysDef.accessesHardware).toBe(true);
      expect(sysDef.description).toContain('Call machine language routine');
    });
  });

  describe('Side Effects Classification', () => {
    it('should classify read functions as non-side-effecting', () => {
      const readFunctions = ['peek', 'peekw'];

      for (const funcName of readFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.hasSideEffects).toBe(false);
      }
    });

    it('should classify write functions as side-effecting', () => {
      const writeFunctions = ['poke', 'pokew', 'sys'];

      for (const funcName of writeFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.hasSideEffects).toBe(true);
      }
    });

    it('should classify all functions as hardware-accessing', () => {
      const allFunctions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];

      for (const funcName of allFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.accessesHardware).toBe(true);
      }
    });
  });

  describe('Function Validation Configuration', () => {
    it('should configure address validation for all functions', () => {
      const allFunctions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];

      for (const funcName of allFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresAddressValidation).toBe(true);
      }
    });

    it('should configure value validation for write functions', () => {
      const writeFunctions = ['poke', 'pokew'];

      for (const funcName of writeFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresValueValidation).toBe(true);
      }
    });

    it('should not configure value validation for read functions', () => {
      const readFunctions = ['peek', 'peekw', 'sys'];

      for (const funcName of readFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresValueValidation).toBeUndefined();
      }
    });
  });

  describe('Function Documentation', () => {
    it('should provide helpful descriptions for all functions', () => {
      const expectedDescriptions = {
        'peek': 'Read 8-bit value from memory address',
        'poke': 'Write 8-bit value to memory address',
        'peekw': 'Read 16-bit value from memory address (little-endian)',
        'pokew': 'Write 16-bit value to memory address (little-endian)',
        'sys': 'Call machine language routine at specified address',
      };

      for (const [funcName, expectedDesc] of Object.entries(expectedDescriptions)) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.description).toBe(expectedDesc);
      }
    });

    it('should provide parameter descriptions', () => {
      const peekDef = getBuiltInFunction('peek')!;
      expect(peekDef.parameters[0].description).toContain('Memory address to read from');

      const pokeDef = getBuiltInFunction('poke')!;
      expect(pokeDef.parameters[0].description).toContain('Memory address to write to');
      expect(pokeDef.parameters[1].description).toContain('Byte value to write');

      const sysDef = getBuiltInFunction('sys')!;
      expect(sysDef.parameters[0].description).toContain('Machine language routine address');
    });
  });

  describe('Type System Integration', () => {
    it('should use correct Blend65 primitive types', () => {
      // Test that all built-in functions use the standard Blend65 type system
      const peekDef = getBuiltInFunction('peek')!;
      expect(peekDef.parameters[0].type.kind).toBe('primitive');
      expect(peekDef.returnType.kind).toBe('primitive');

      const pokeDef = getBuiltInFunction('poke')!;
      expect(pokeDef.parameters[0].type.kind).toBe('primitive');
      expect(pokeDef.parameters[1].type.kind).toBe('primitive');
      expect(pokeDef.returnType.kind).toBe('primitive');
    });

    it('should distinguish between byte and word types correctly', () => {
      const peekDef = getBuiltInFunction('peek')!;
      const pokeDef = getBuiltInFunction('poke')!;
      const peekwDef = getBuiltInFunction('peekw')!;
      const pokewDef = getBuiltInFunction('pokew')!;

      // Address parameters are always word
      expect((peekDef.parameters[0].type as any).name).toBe('word');
      expect((pokeDef.parameters[0].type as any).name).toBe('word');
      expect((peekwDef.parameters[0].type as any).name).toBe('word');
      expect((pokewDef.parameters[0].type as any).name).toBe('word');

      // Value parameters and return types vary
      expect((peekDef.returnType as any).name).toBe('byte');
      expect((pokeDef.parameters[1].type as any).name).toBe('byte');
      expect((peekwDef.returnType as any).name).toBe('word');
      expect((pokewDef.parameters[1].type as any).name).toBe('word');
    });
  });

  describe('6502 Memory Architecture Alignment', () => {
    it('should align with 6502 memory access patterns', () => {
      // All functions should work with 16-bit addresses (0x0000-0xFFFF)
      const allFunctions = getAllBuiltInFunctionNames();

      for (const funcName of allFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;

        // First parameter is always an address (word type)
        expect(funcDef.parameters[0].type).toEqual(createPrimitiveType('word'));
        expect(funcDef.parameters[0].name).toBe('address');

        // All functions access hardware/memory
        expect(funcDef.accessesHardware).toBe(true);
      }
    });

    it('should provide byte-level and word-level access', () => {
      const byteFunctions = ['peek', 'poke'];
      const wordFunctions = ['peekw', 'pokew'];

      for (const funcName of byteFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        if (funcDef.parameters.length > 1) {
          // poke() has byte value parameter
          expect(funcDef.parameters[1].type).toEqual(createPrimitiveType('byte'));
        }
        if (funcDef.name === 'peek') {
          // peek() returns byte
          expect(funcDef.returnType).toEqual(createPrimitiveType('byte'));
        }
      }

      for (const funcName of wordFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        if (funcDef.parameters.length > 1) {
          // pokew() has word value parameter
          expect(funcDef.parameters[1].type).toEqual(createPrimitiveType('word'));
        }
        if (funcDef.name === 'peekw') {
          // peekw() returns word
          expect(funcDef.returnType).toEqual(createPrimitiveType('word'));
        }
      }
    });
  });

  describe('Implementation Completeness', () => {
    it('should implement exactly the 5 core functions specified in GitHub Issue #42', () => {
      const expectedFunctions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];
      const actualFunctions = getAllBuiltInFunctionNames().sort();
      const expectedSorted = expectedFunctions.sort();

      expect(actualFunctions).toEqual(expectedSorted);
    });

    it('should NOT implement future extension functions', () => {
      const futureExtensions = [
        'abs', 'min', 'max', 'sqrt', 'sin', 'cos', // Math functions
        'memcmp', 'memset', 'memswap', 'memcopy', // Memory functions
        'wait_vblank', 'read_raster', 'enable_irq', // Hardware abstraction
        'random', 'print', 'input', // Utility functions
      ];

      for (const func of futureExtensions) {
        expect(isBuiltInFunction(func)).toBe(false);
        expect(getBuiltInFunction(func)).toBeUndefined();
      }
    });

    it('should provide complete definitions for all functions', () => {
      const allFunctions = getAllBuiltInFunctionNames();

      for (const funcName of allFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;

        // Every function should have complete definition
        expect(funcDef.name).toBe(funcName);
        expect(funcDef.parameters).toBeDefined();
        expect(funcDef.parameters.length).toBeGreaterThan(0);
        expect(funcDef.returnType).toBeDefined();
        expect(funcDef.description).toBeDefined();
        expect(funcDef.description.length).toBeGreaterThan(0);
        expect(typeof funcDef.hasSideEffects).toBe('boolean');
        expect(typeof funcDef.accessesHardware).toBe('boolean');

        // All parameters should have proper definitions
        for (const param of funcDef.parameters) {
          expect(param.name).toBeDefined();
          expect(param.name.length).toBeGreaterThan(0);
          expect(param.type).toBeDefined();
          expect(param.description).toBeDefined();
          expect(param.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Platform Requirements', () => {
    it('should require address validation for all functions', () => {
      const allFunctions = getAllBuiltInFunctionNames();

      for (const funcName of allFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresAddressValidation).toBe(true);
      }
    });

    it('should require value validation for write functions only', () => {
      const writeFunctions = ['poke', 'pokew'];
      const readFunctions = ['peek', 'peekw', 'sys'];

      for (const funcName of writeFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresValueValidation).toBe(true);
      }

      for (const funcName of readFunctions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.validation?.requiresValueValidation).toBeUndefined();
      }
    });
  });

  describe('Memory Access Semantics', () => {
    it('should provide both 8-bit and 16-bit memory access', () => {
      // 8-bit access
      const peek = getBuiltInFunction('peek')!;
      const poke = getBuiltInFunction('poke')!;
      expect((peek.returnType as any).name).toBe('byte');
      expect((poke.parameters[1].type as any).name).toBe('byte');

      // 16-bit access
      const peekw = getBuiltInFunction('peekw')!;
      const pokew = getBuiltInFunction('pokew')!;
      expect((peekw.returnType as any).name).toBe('word');
      expect((pokew.parameters[1].type as any).name).toBe('word');
    });

    it('should support machine language routine calls', () => {
      const sys = getBuiltInFunction('sys')!;
      expect(sys.name).toBe('sys');
      expect((sys.returnType as any).name).toBe('void');
      expect(sys.hasSideEffects).toBe(true);
      expect(sys.description).toContain('machine language routine');
    });

    it('should handle little-endian semantics for word operations', () => {
      const peekwDef = getBuiltInFunction('peekw')!;
      const pokewDef = getBuiltInFunction('pokew')!;

      expect(peekwDef.description).toContain('little-endian');
      expect(pokewDef.description).toContain('little-endian');
    });
  });
});

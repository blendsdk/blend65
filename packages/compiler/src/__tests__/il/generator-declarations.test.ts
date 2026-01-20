/**
 * IL Declaration Generator Tests
 *
 * Tests for declaration-level IL generation features including:
 * - Intrinsic function detection and registration
 * - Function parameter type handling  
 * - Function type handling
 *
 * Note: Full function body generation requires ILExpressionGenerator which
 * is not yet implemented. Tests for local variable processing and statement
 * generation will be added once expression generation is complete.
 *
 * @module __tests__/il/generator-declarations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILModuleGenerator } from '../../il/generator/modules.js';
import { ILDeclarationGenerator } from '../../il/generator/declarations.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILTypeKind } from '../../il/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parses Blend65 source code into an AST Program.
 *
 * @param source - Blend65 source code
 * @returns Parsed Program node
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates an ILModuleGenerator for testing.
 * We use ILModuleGenerator for tests that don't require full body generation.
 *
 * @returns Generator instance with fresh symbol table
 */
function createModuleGenerator(): ILModuleGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILModuleGenerator(symbolTable);
}

/**
 * Creates an ILDeclarationGenerator for testing intrinsics.
 *
 * @returns Declaration generator instance
 */
function createDeclarationGenerator(): ILDeclarationGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILDeclarationGenerator(symbolTable);
}

// =============================================================================
// Function Stub and Type Tests
// =============================================================================

describe('ILDeclarationGenerator', () => {
  describe('function type handling', () => {
    let generator: ILModuleGenerator;

    beforeEach(() => {
      generator = createModuleGenerator();
    });

    it('should create function type for void function', () => {
      const source = `
        module test
        function noReturn()
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('noReturn');
      expect(func).toBeDefined();
      expect(func!.returnType.kind).toBe(ILTypeKind.Void);
    });

    it('should create function type for byte return', () => {
      const source = `
        module test
        function getByteValue(): byte
          return 0
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('getByteValue');
      expect(func).toBeDefined();
      expect(func!.returnType.kind).toBe(ILTypeKind.Byte);
    });

    it('should create function type for word return', () => {
      const source = `
        module test
        function getWordValue(): word
          return 0
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('getWordValue');
      expect(func).toBeDefined();
      expect(func!.returnType.kind).toBe(ILTypeKind.Word);
    });
  });

  // ===========================================================================
  // Parameter Mapping Tests
  // ===========================================================================

  describe('parameter mapping', () => {
    let generator: ILModuleGenerator;

    beforeEach(() => {
      generator = createModuleGenerator();
    });

    it('should create parameter registers', () => {
      const source = `
        module test
        function add(a: byte, b: byte): byte
          return a + b
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('add');
      expect(func).toBeDefined();
      
      // Check parameter registers exist
      const paramA = func!.getParameterRegister(0);
      const paramB = func!.getParameterRegister(1);
      expect(paramA).toBeDefined();
      expect(paramB).toBeDefined();
    });

    it('should map parameters with correct types', () => {
      const source = `
        module test
        function process(value: byte, offset: word): word
          return offset
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('process');
      expect(func).toBeDefined();
      
      // Check parameter types
      expect(func!.parameters[0].type.kind).toBe(ILTypeKind.Byte);
      expect(func!.parameters[1].type.kind).toBe(ILTypeKind.Word);
    });

    it('should access parameter by name', () => {
      const source = `
        module test
        function getValue(input: byte): byte
          return input
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('getValue');
      expect(func).toBeDefined();
      
      // Get parameter by name
      const inputReg = func!.getParameterRegisterByName('input');
      expect(inputReg).toBeDefined();
    });

    it('should handle function with no parameters', () => {
      const source = `
        module test
        function noParams(): byte
          return 0
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('noParams');
      expect(func).toBeDefined();
      expect(func!.parameters.length).toBe(0);
    });

    it('should handle function with many parameters', () => {
      const source = `
        module test
        function manyParams(a: byte, b: byte, c: byte, d: byte): byte
          return a
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('manyParams');
      expect(func).toBeDefined();
      expect(func!.parameters.length).toBe(4);
      
      // All parameter registers should be defined
      for (let i = 0; i < 4; i++) {
        expect(func!.getParameterRegister(i)).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Intrinsic Function Tests
  // ===========================================================================

  describe('intrinsic function detection', () => {
    let generator: ILDeclarationGenerator;

    beforeEach(() => {
      generator = createDeclarationGenerator();
    });

    it('should detect stub function as intrinsic', () => {
      // Stub functions use semicolon terminator instead of body
      const source = `
        module test
        function peek(address: word): byte;
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      // Stub function should be registered as intrinsic
      expect(generator.isIntrinsic('peek')).toBe(true);
    });

    it('should store intrinsic info', () => {
      // Void return type stub function with semicolon
      const source = `
        module test
        function poke(address: word, value: byte);
      `;
      const program = parseSource(source);

      generator.generateModule(program);

      const info = generator.getIntrinsicInfo('poke');
      expect(info).toBeDefined();
      expect(info!.name).toBe('poke');
      expect(info!.returnType.kind).toBe(ILTypeKind.Void);
    });

    it('should detect multiple intrinsics', () => {
      // Multiple stub functions declared with semicolon
      const source = `
        module test
        function peek(address: word): byte;
        function poke(address: word, value: byte);
        function peekw(address: word): word;
      `;
      const program = parseSource(source);

      generator.generateModule(program);

      expect(generator.isIntrinsic('peek')).toBe(true);
      expect(generator.isIntrinsic('poke')).toBe(true);
      expect(generator.isIntrinsic('peekw')).toBe(true);
    });

    it('should not mark regular function as intrinsic', () => {
      const source = `
        module test
        function regularFunc(): byte
          return 0
        end function
      `;
      const program = parseSource(source);

      generator.generateModule(program);

      expect(generator.isIntrinsic('regularFunc')).toBe(false);
    });

    it('should get all intrinsics', () => {
      // Mix of stub (semicolon) and regular (with body) functions
      const source = `
        module test
        function intrinsic1(): byte;
        function intrinsic2(x: byte): byte;
        function regular(): byte
          return 0
        end function
      `;
      const program = parseSource(source);

      generator.generateModule(program);

      const intrinsics = generator.getIntrinsics();
      expect(intrinsics.size).toBe(2);
      expect(intrinsics.has('intrinsic1')).toBe(true);
      expect(intrinsics.has('intrinsic2')).toBe(true);
      expect(intrinsics.has('regular')).toBe(false);
    });

    it('should store intrinsic parameter types', () => {
      // Stub function with multiple parameters
      const source = `
        module test
        function multiParam(a: byte, b: word, c: byte): word;
      `;
      const program = parseSource(source);

      generator.generateModule(program);

      const info = generator.getIntrinsicInfo('multiParam');
      expect(info).toBeDefined();
      expect(info!.parameterTypes.length).toBe(3);
      expect(info!.parameterTypes[0].kind).toBe(ILTypeKind.Byte);
      expect(info!.parameterTypes[1].kind).toBe(ILTypeKind.Word);
      expect(info!.parameterTypes[2].kind).toBe(ILTypeKind.Byte);
      expect(info!.returnType.kind).toBe(ILTypeKind.Word);
    });
  });

  // ===========================================================================
  // Multiple Functions Tests
  // ===========================================================================

  describe('multiple function generation', () => {
    let generator: ILModuleGenerator;

    beforeEach(() => {
      generator = createModuleGenerator();
    });

    it('should generate multiple functions in same module', () => {
      const source = `
        module test
        function first()
        end function
        function second(): byte
          return 0
        end function
        function third(x: byte)
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      expect(result.module.getFunctions().length).toBe(3);
      expect(result.module.hasFunction('first')).toBe(true);
      expect(result.module.hasFunction('second')).toBe(true);
      expect(result.module.hasFunction('third')).toBe(true);
    });

    it('should handle mix of stub and regular functions', () => {
      // Stub functions use semicolon terminator, regular functions have body
      const source = `
        module test
        function peek(addr: word): byte;
        function process()
        end function
        function poke(addr: word, val: byte);
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      expect(result.module.getFunctions().length).toBe(3);
    });
  });
});
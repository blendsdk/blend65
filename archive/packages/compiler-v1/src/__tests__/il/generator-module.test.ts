/**
 * IL Module Generator Tests
 *
 * Tests for the ILModuleGenerator class which handles:
 * - Module creation and initialization
 * - Import processing
 * - Global variable generation
 * - @map declaration processing (simple, range, sequential struct, explicit struct)
 * - Enum declaration processing
 * - Function stub creation
 * - Export processing
 * - Entry point detection
 *
 * @module __tests__/il/generator-module.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILModuleGenerator } from '../../il/generator/modules.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILStorageClass } from '../../il/function.js';
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
 *
 * @returns Generator instance with fresh symbol table
 */
function createGenerator(): ILModuleGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILModuleGenerator(symbolTable);
}

// =============================================================================
// Module Creation Tests
// =============================================================================

describe('ILModuleGenerator', () => {
  let generator: ILModuleGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('module creation', () => {
    it('should generate module from empty program', () => {
      const source = `module empty`;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      expect(result.module).toBeDefined();
      expect(result.module.name).toBe('empty');
    });

    it('should generate module with correct name', () => {
      const source = `module my_module`;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.name).toBe('my_module');
    });

    it('should create empty module with no functions', () => {
      const source = `module test`;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.getFunctions()).toHaveLength(0);
    });

    it('should create empty module with no globals', () => {
      const source = `module test`;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.getGlobals()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Global Variable Tests
  // ===========================================================================

  describe('global variable generation', () => {
    it('should generate global variable with type annotation', () => {
      const source = `
        module test
        let counter: byte
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const globals = result.module.getGlobals();
      expect(globals).toHaveLength(1);
      expect(globals[0].name).toBe('counter');
      expect(globals[0].type.kind).toBe(ILTypeKind.Byte);
    });

    it('should generate global word variable', () => {
      const source = `
        module test
        let score: word
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].type.kind).toBe(ILTypeKind.Word);
    });

    it('should generate global constant', () => {
      const source = `
        module test
        const MAX_LIVES: byte = 3
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].isConstant).toBe(true);
      expect(globals[0].initialValue).toBe(3);
    });

    it('should generate @zp global variable', () => {
      const source = `
        module test
        @zp let fastCounter: byte
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].storageClass).toBe(ILStorageClass.ZeroPage);
    });

    it('should generate @ram global variable', () => {
      const source = `
        module test
        @ram let buffer: byte
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].storageClass).toBe(ILStorageClass.Ram);
    });

    it('should generate @data global variable', () => {
      const source = `
        module test
        @data const table: byte = 0
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].storageClass).toBe(ILStorageClass.Data);
    });

    it('should generate array global variable', () => {
      const source = `
        module test
        let buffer: byte[256]
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const globals = result.module.getGlobals();
      expect(globals[0].type.kind).toBe(ILTypeKind.Array);
      expect(globals[0].type.sizeInBytes).toBe(256);
    });
  });

  // ===========================================================================
  // @map Declaration Tests
  // ===========================================================================

  describe('@map declaration generation', () => {
    describe('simple @map', () => {
      it('should generate simple @map declaration', () => {
        const source = `
          module test
          @map borderColor at $D020: byte
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        expect(result.success).toBe(true);
        const globals = result.module.getGlobals();
        expect(globals).toHaveLength(1);
        expect(globals[0].name).toBe('borderColor');
        expect(globals[0].storageClass).toBe(ILStorageClass.Map);
        expect(globals[0].address).toBe(0xD020);
      });

      it('should generate simple @map with word type', () => {
        const source = `
          module test
          @map screenPtr at $00FB: word
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        const globals = result.module.getGlobals();
        expect(globals[0].type.kind).toBe(ILTypeKind.Word);
        expect(globals[0].address).toBe(0x00FB);
      });
    });

    describe('range @map', () => {
      it('should generate range @map declaration', () => {
        const source = `
          module test
          @map spriteRegs from $D000 to $D02E: byte
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        expect(result.success).toBe(true);
        const globals = result.module.getGlobals();
        expect(globals).toHaveLength(1);
        expect(globals[0].name).toBe('spriteRegs');
        expect(globals[0].storageClass).toBe(ILStorageClass.Map);
        expect(globals[0].address).toBe(0xD000);
        expect(globals[0].type.kind).toBe(ILTypeKind.Array);
      });
    });

    describe('sequential struct @map', () => {
      it('should generate sequential struct @map declaration', () => {
        const source = `
          module test
          @map sid at $D400 type {
            frequency: word
            pulseWidth: word
            control: byte
          }
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        expect(result.success).toBe(true);
        // Should create globals for each field plus the base
        const globals = result.module.getGlobals();
        expect(globals.length).toBeGreaterThanOrEqual(4); // 3 fields + 1 base
      });

      it('should generate sequential struct fields with correct addresses', () => {
        const source = `
          module test
          @map voice1 at $D400 type {
            frequency: word
            pulseWidth: word
          }
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        const freqGlobal = result.module.getGlobal('voice1.frequency');
        const pwGlobal = result.module.getGlobal('voice1.pulseWidth');

        expect(freqGlobal?.address).toBe(0xD400);
        expect(pwGlobal?.address).toBe(0xD402); // offset by word size
      });
    });

    describe('explicit struct @map', () => {
      it('should generate explicit struct @map declaration', () => {
        const source = `
          module test
          @map vic at $D000 layout {
            sprite0x at $00: byte
            sprite0y at $01: byte
            sprite1x at $02: byte
          }
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        expect(result.success).toBe(true);
        const globals = result.module.getGlobals();
        expect(globals.length).toBeGreaterThanOrEqual(4); // 3 fields + 1 base
      });

      it('should generate explicit struct fields with correct addresses', () => {
        const source = `
          module test
          @map vic at $D000 layout {
            spriteEnable at $15: byte
            borderColor at $20: byte
          }
        `;
        const program = parseSource(source);

        const result = generator.generateModule(program);

        const enableGlobal = result.module.getGlobal('vic.spriteEnable');
        const borderGlobal = result.module.getGlobal('vic.borderColor');

        expect(enableGlobal?.address).toBe(0xD000 + 0x15);
        expect(borderGlobal?.address).toBe(0xD000 + 0x20);
      });
    });
  });

  // ===========================================================================
  // Enum Declaration Tests
  // ===========================================================================

  describe('enum declaration generation', () => {
    it('should generate enum declaration', () => {
      const source = `
        module test
        enum Direction {
          Up,
          Down,
          Left,
          Right
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      // Each enum member becomes a constant global
      const globals = result.module.getGlobals();
      expect(globals.length).toBe(4);
    });

    it('should generate enum members with auto-incrementing values', () => {
      const source = `
        module test
        enum Color {
          Black,
          White,
          Red
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const blackGlobal = result.module.getGlobal('Color.Black');
      const whiteGlobal = result.module.getGlobal('Color.White');
      const redGlobal = result.module.getGlobal('Color.Red');

      expect(blackGlobal?.initialValue).toBe(0);
      expect(whiteGlobal?.initialValue).toBe(1);
      expect(redGlobal?.initialValue).toBe(2);
    });

    it('should generate enum members with explicit values', () => {
      const source = `
        module test
        enum Color {
          Black = 0,
          White = 1,
          Red = 2,
          Green = 5
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const greenGlobal = result.module.getGlobal('Color.Green');
      expect(greenGlobal?.initialValue).toBe(5);
    });

    it('should mark enum members as constants', () => {
      const source = `
        module test
        enum State {
          Idle,
          Running
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const idleGlobal = result.module.getGlobal('State.Idle');
      expect(idleGlobal?.isConstant).toBe(true);
    });
  });

  // ===========================================================================
  // Function Stub Tests
  // ===========================================================================

  describe('function stub generation', () => {
    it('should generate function stub for void function', () => {
      const source = `
        module test
        function init() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('init');
      expect(func).toBeDefined();
      expect(func!.isVoid()).toBe(true);
    });

    it('should generate function stub with parameters', () => {
      const source = `
        module test
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('add');
      expect(func).toBeDefined();
      // ILFunction uses parameters.length not getParameterCount()
      expect(func!.parameters.length).toBe(2);
    });

    it('should generate function stub with return type', () => {
      const source = `
        module test
        function getValue(): word {
          return 42;
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('getValue');
      expect(func).toBeDefined();
      expect(func!.returnType.kind).toBe(ILTypeKind.Word);
    });

    it('should generate multiple function stubs', () => {
      const source = `
        module test
        function foo() {
        }
        function bar() {
        }
        function baz() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.getFunctions()).toHaveLength(3);
      expect(result.module.hasFunction('foo')).toBe(true);
      expect(result.module.hasFunction('bar')).toBe(true);
      expect(result.module.hasFunction('baz')).toBe(true);
    });
  });

  // ===========================================================================
  // Import Processing Tests
  // ===========================================================================

  describe('import processing', () => {
    it('should process named import', () => {
      const source = `
        module test
        import foo from "other_module"
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const imports = result.module.getImports();
      expect(imports.length).toBeGreaterThanOrEqual(1);
    });

    it('should process multiple named imports', () => {
      const source = `
        module test
        import foo, bar, baz from "utils"
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const imports = result.module.getImports();
      expect(imports.length).toBeGreaterThanOrEqual(3);
    });

    it('should process wildcard import', () => {
      const source = `
        module test
        import * from "library"
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const imports = result.module.getImports();
      expect(imports.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Export Processing Tests
  // ===========================================================================

  describe('export processing', () => {
    it('should process exported function', () => {
      const source = `
        module test
        export function publicFunc() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      // Function should be marked as exported in the IL
      const func = result.module.getFunction('publicFunc');
      expect(func).toBeDefined();
      expect(func?.getExported()).toBe(true);
    });

    it('should process exported variable', () => {
      const source = `
        module test
        export let sharedValue: byte
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      // Check the global is marked as exported
      const global = result.module.getGlobal('sharedValue');
      expect(global?.isExported).toBe(true);
    });

    it('should mark exported function as exported in IL', () => {
      const source = `
        module test
        export function api() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      const func = result.module.getFunction('api');
      expect(func?.getExported()).toBe(true);
    });
  });

  // ===========================================================================
  // Entry Point Detection Tests
  // ===========================================================================

  describe('entry point detection', () => {
    it('should detect main function as entry point', () => {
      const source = `
        module test
        function main() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.hasEntryPoint()).toBe(true);
      expect(result.module.getEntryPoint()?.name).toBe('main');
    });

    it('should not detect entry point when no main function', () => {
      const source = `
        module test
        function other() {
        }
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.module.hasEntryPoint()).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should report success with valid module', () => {
      const source = `
        module valid
        let x: byte
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      expect(generator.hasErrors()).toBe(false);
    });

    it('should clear errors between generations', () => {
      // Generate first module
      const source1 = `module first`;
      const program1 = parseSource(source1);
      generator.generateModule(program1);

      // Generate second module
      const source2 = `module second`;
      const program2 = parseSource(source2);
      const result = generator.generateModule(program2);

      expect(result.success).toBe(true);
      expect(result.module.name).toBe('second');
    });
  });
});
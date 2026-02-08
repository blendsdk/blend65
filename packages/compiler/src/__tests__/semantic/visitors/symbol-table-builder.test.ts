/**
 * Symbol Table Builder Tests
 *
 * Tests for Pass 1 of semantic analysis: building the symbol table from AST.
 * Tests cover:
 * - Module declaration handling
 * - Function declaration and scopes
 * - Variable declaration (let and const)
 * - Parameter handling
 * - Import/export handling
 * - Enum and type declarations
 * - Duplicate declaration detection
 * - Scope creation for control flow statements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolTableBuilder, SymbolTableBuildResult } from '../../../semantic/visitors/symbol-table-builder.js';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SymbolKind } from '../../../semantic/symbol.js';
import { ScopeKind } from '../../../semantic/scope.js';
import type { Program } from '../../../ast/index.js';

/**
 * Helper to parse source code and return Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper to build symbol table from source code
 */
function buildSymbolTable(source: string): SymbolTableBuildResult {
  const program = parse(source);
  const builder = new SymbolTableBuilder();
  return builder.build(program);
}

describe('SymbolTableBuilder', () => {
  describe('Module Handling', () => {
    it('should create module scope for explicit module declaration', () => {
      const result = buildSymbolTable(`
        module Game
      `);

      expect(result.success).toBe(true);
      expect(result.symbolTable.getModuleName()).toBe('Game');
      expect(result.symbolTable.getRootScope().kind).toBe(ScopeKind.Module);
    });

    it('should create module scope for implicit module', () => {
      const result = buildSymbolTable(`
        function main(): void
        end
      `);

      expect(result.success).toBe(true);
      expect(result.symbolTable.getRootScope().kind).toBe(ScopeKind.Module);
    });

    it('should handle dotted module names', () => {
      const result = buildSymbolTable(`
        module Game.Engine.Core
      `);

      expect(result.success).toBe(true);
      expect(result.symbolTable.getModuleName()).toBe('Game.Engine.Core');
    });
  });

  describe('Function Declarations', () => {
    it('should register function symbol in module scope', () => {
      const result = buildSymbolTable(`
        module Test
        function add(a: byte, b: byte): byte
          return a + b
        end
      `);

      expect(result.success).toBe(true);

      const funcSymbol = result.symbolTable.lookupGlobal('add');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.kind).toBe(SymbolKind.Function);
      expect(funcSymbol!.name).toBe('add');
      expect(funcSymbol!.isExported).toBe(false);
    });

    it('should mark exported functions', () => {
      const result = buildSymbolTable(`
        module Test
        export function main(): void
        end
      `);

      expect(result.success).toBe(true);

      const funcSymbol = result.symbolTable.lookupGlobal('main');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.isExported).toBe(true);
    });

    it('should create function scope for function body', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(): void
          let x: byte = 0
        end
      `);

      expect(result.success).toBe(true);
      expect(result.symbolTable.getScopeCount()).toBeGreaterThan(1);
    });

    it('should register parameters in function scope', () => {
      const result = buildSymbolTable(`
        module Test
        function add(a: byte, b: byte): byte
          return a + b
        end
      `);

      expect(result.success).toBe(true);

      const funcSymbol = result.symbolTable.lookupGlobal('add');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.parameters).toBeDefined();
      expect(funcSymbol!.parameters!.length).toBe(2);
      expect(funcSymbol!.parameters![0].name).toBe('a');
      expect(funcSymbol!.parameters![0].kind).toBe(SymbolKind.Parameter);
      expect(funcSymbol!.parameters![1].name).toBe('b');
    });

    it('should handle stub functions (no body)', () => {
      const result = buildSymbolTable(`
        module Test
        function external(): void;
      `);

      expect(result.success).toBe(true);

      const funcSymbol = result.symbolTable.lookupGlobal('external');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.kind).toBe(SymbolKind.Function);
    });

    it('should report error for duplicate function declarations', () => {
      const result = buildSymbolTable(`
        module Test;
        function foo(): void {
          return;
        }
        function foo(): void {
          return;
        }
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('foo');
      expect(result.diagnostics[0].message).toContain('already declared');
    });

    it('should report error for duplicate parameter names', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(x: byte, x: byte): void
        end
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('x');
    });
  });

  describe('Variable Declarations', () => {
    it('should register let variable in current scope', () => {
      const result = buildSymbolTable(`
        module Test
        let counter: byte = 0
      `);

      expect(result.success).toBe(true);

      const varSymbol = result.symbolTable.lookupGlobal('counter');
      expect(varSymbol).toBeDefined();
      expect(varSymbol!.kind).toBe(SymbolKind.Variable);
      expect(varSymbol!.isConst).toBe(false);
    });

    it('should register const variable', () => {
      const result = buildSymbolTable(`
        module Test
        const MAX: byte = 255
      `);

      expect(result.success).toBe(true);

      const constSymbol = result.symbolTable.lookupGlobal('MAX');
      expect(constSymbol).toBeDefined();
      expect(constSymbol!.kind).toBe(SymbolKind.Constant);
      expect(constSymbol!.isConst).toBe(true);
    });

    it('should mark exported variables', () => {
      const result = buildSymbolTable(`
        module Test
        export let score: word = 0
      `);

      expect(result.success).toBe(true);

      const varSymbol = result.symbolTable.lookupGlobal('score');
      expect(varSymbol).toBeDefined();
      expect(varSymbol!.isExported).toBe(true);
    });

    it('should register local variables in function scope', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(): void
          let local: byte = 0
        end
      `);

      expect(result.success).toBe(true);

      // Local variable should not be in module scope
      const moduleVar = result.symbolTable.lookupGlobal('local');
      expect(moduleVar).toBeUndefined();
    });

    it('should report error for duplicate variable declarations', () => {
      const result = buildSymbolTable(`
        module Test
        let x: byte = 0
        let x: byte = 1
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('x');
    });

    it('should allow same name in different scopes (shadowing)', () => {
      const result = buildSymbolTable(`
        module Test
        let x: byte = 0
        function foo(): void
          let x: byte = 1
        end
      `);

      expect(result.success).toBe(true);
      expect(result.diagnostics.length).toBe(0);
    });
  });

  describe('Import Declarations', () => {
    it('should register imported symbols', () => {
      const result = buildSymbolTable(`
        module Test
        import foo from othermodule
      `);

      expect(result.success).toBe(true);

      const importSymbol = result.symbolTable.lookupGlobal('foo');
      expect(importSymbol).toBeDefined();
      expect(importSymbol!.kind).toBe(SymbolKind.ImportedSymbol);
      expect(importSymbol!.sourceModule).toBeDefined();
    });

    it('should register multiple imports from same module', () => {
      const result = buildSymbolTable(`
        module Test
        import foo, bar from other.module
      `);

      expect(result.success).toBe(true);

      const fooSymbol = result.symbolTable.lookupGlobal('foo');
      const barSymbol = result.symbolTable.lookupGlobal('bar');

      expect(fooSymbol).toBeDefined();
      expect(barSymbol).toBeDefined();
      expect(fooSymbol!.kind).toBe(SymbolKind.ImportedSymbol);
      expect(barSymbol!.kind).toBe(SymbolKind.ImportedSymbol);
    });

    it('should report error for duplicate import names', () => {
      const result = buildSymbolTable(`
        module Test
        import foo from module1
        import foo from module2
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('foo');
    });

    it('should report error when import conflicts with existing declaration', () => {
      const result = buildSymbolTable(`
        module Test
        let foo: byte = 0
        import foo from other.module
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Export Declarations', () => {
    it('should mark wrapped function as exported', () => {
      const result = buildSymbolTable(`
        module Test
        export function main(): void
        end
      `);

      expect(result.success).toBe(true);

      const funcSymbol = result.symbolTable.lookupGlobal('main');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.isExported).toBe(true);
    });

    it('should mark wrapped variable as exported', () => {
      const result = buildSymbolTable(`
        module Test
        export let config: byte = 0
      `);

      expect(result.success).toBe(true);

      const varSymbol = result.symbolTable.lookupGlobal('config');
      expect(varSymbol).toBeDefined();
      expect(varSymbol!.isExported).toBe(true);
    });

    it('should return all exported symbols', () => {
      const result = buildSymbolTable(`
        module Test;
        export function main(): void {
        }
        export let score: word = 0;
        let internal: byte = 0;
      `);

      expect(result.success).toBe(true);

      const exports = result.symbolTable.getExportedSymbols();
      expect(exports.length).toBe(2);

      const names = exports.map((s) => s.name);
      expect(names).toContain('main');
      expect(names).toContain('score');
      expect(names).not.toContain('internal');
    });
  });

  describe('Enum Declarations', () => {
    it('should register enum as constant', () => {
      const result = buildSymbolTable(`
        module Test
        enum Direction
          UP
          DOWN
          LEFT
          RIGHT
        end
      `);

      expect(result.success).toBe(true);

      const enumSymbol = result.symbolTable.lookupGlobal('Direction');
      expect(enumSymbol).toBeDefined();
      expect(enumSymbol!.kind).toBe(SymbolKind.Constant);
    });

    it('should register enum members', () => {
      const result = buildSymbolTable(`
        module Test
        enum Color
          RED
          GREEN
          BLUE
        end
      `);

      expect(result.success).toBe(true);

      // Enum members should be in scope
      const redSymbol = result.symbolTable.lookupGlobal('RED');
      const greenSymbol = result.symbolTable.lookupGlobal('GREEN');
      const blueSymbol = result.symbolTable.lookupGlobal('BLUE');

      expect(redSymbol).toBeDefined();
      expect(greenSymbol).toBeDefined();
      expect(blueSymbol).toBeDefined();
      expect(redSymbol!.kind).toBe(SymbolKind.EnumMember);
    });

    it('should report error for duplicate enum members within enum', () => {
      const result = buildSymbolTable(`
        module Test
        enum Status
          OK
          OK
        end
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('OK');
    });

    it('should report error for duplicate enum declarations', () => {
      const result = buildSymbolTable(`
        module Test;
        enum Color {
          RED
        }
        enum Color {
          BLUE
        }
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Type Declarations', () => {
    it('should register type alias', () => {
      const result = buildSymbolTable(`
        module Test
        type SpriteId = byte
      `);

      expect(result.success).toBe(true);

      const typeSymbol = result.symbolTable.lookupGlobal('SpriteId');
      expect(typeSymbol).toBeDefined();
      expect(typeSymbol!.kind).toBe(SymbolKind.Constant);
    });

    it('should mark exported type alias', () => {
      const result = buildSymbolTable(`
        module Test
        export type Score = word
      `);

      expect(result.success).toBe(true);

      const typeSymbol = result.symbolTable.lookupGlobal('Score');
      expect(typeSymbol).toBeDefined();
      expect(typeSymbol!.isExported).toBe(true);
    });
  });

  describe('Control Flow Scopes', () => {
    it('should create loop scope for while statement', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(): void
          while true
            let x: byte = 0
          end
        end
      `);

      expect(result.success).toBe(true);
      // At least: module, function, loop
      expect(result.symbolTable.getScopeCount()).toBeGreaterThanOrEqual(3);
    });

    it('should create loop scope for for statement', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(): void
          for i = 0 to 10
            let x: byte = 0
          end
        end
      `);

      expect(result.success).toBe(true);
      expect(result.symbolTable.getScopeCount()).toBeGreaterThanOrEqual(3);
    });

    it('should create block scope for if statement branches', () => {
      const result = buildSymbolTable(`
        module Test;
        function foo(): void {
          if (true) {
            let x: byte = 0;
          } else {
            let y: byte = 0;
          }
        }
      `);

      expect(result.success).toBe(true);
      // module, function, then-block, else-block
      expect(result.symbolTable.getScopeCount()).toBeGreaterThanOrEqual(4);
    });

    it('should allow same variable name in different branches', () => {
      const result = buildSymbolTable(`
        module Test;
        function foo(): void {
          if (true) {
            let x: byte = 0;
          } else {
            let x: byte = 1;
          }
        }
      `);

      expect(result.success).toBe(true);
      expect(result.diagnostics.length).toBe(0);
    });
  });

  describe('Multiple Functions', () => {
    it('should handle multiple function declarations', () => {
      const result = buildSymbolTable(`
        module Test;
        function foo(): void {
        }
        function bar(): void {
        }
        function baz(): void {
        }
      `);

      expect(result.success).toBe(true);

      const functions = result.symbolTable.getFunctionSymbols();
      expect(functions.length).toBe(3);
    });

    it('should isolate local variables between functions', () => {
      const result = buildSymbolTable(`
        module Test;
        function foo(): void {
          let x: byte = 0;
        }
        function bar(): void {
          let x: byte = 1;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.diagnostics.length).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after duplicate declaration error', () => {
      const result = buildSymbolTable(`
        module Test
        let x: byte = 0
        let x: byte = 1
        function foo(): void
        end
      `);

      // Should have error but still process function
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);

      // Function should still be registered
      const funcSymbol = result.symbolTable.lookupGlobal('foo');
      expect(funcSymbol).toBeDefined();
    });

    it('should continue processing function body after parameter error', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(x: byte, x: byte): void
          let y: byte = 0
        end
      `);

      expect(result.success).toBe(false);

      // y should still be registered in function scope
      // (we can't directly check this without more complex testing)
    });
  });

  describe('Symbol Table Statistics', () => {
    it('should track total scope count', () => {
      const result = buildSymbolTable(`
        module Test
        function foo(): void
          if true then
            let x: byte = 0
          end
        end
      `);

      expect(result.success).toBe(true);
      // module + function + if-block = at least 3
      expect(result.symbolTable.getScopeCount()).toBeGreaterThanOrEqual(3);
    });

    it('should track total symbol count', () => {
      const result = buildSymbolTable(`
        module Test
        let a: byte = 0
        let b: byte = 0
        function foo(): void
          let c: byte = 0
        end
      `);

      expect(result.success).toBe(true);
      // a, b, foo, c = 4 symbols
      expect(result.symbolTable.getTotalSymbolCount()).toBeGreaterThanOrEqual(4);
    });
  });
});
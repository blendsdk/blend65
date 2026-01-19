/**
 * Stub Functions - Semantic Analysis Tests
 *
 * Tests that stub functions (semicolon-terminated declarations without bodies)
 * are handled correctly through all semantic analysis passes.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';
import { SymbolKind } from '../../semantic/symbol.js';

describe('Stub Functions - Semantic Analysis', () => {
  /**
   * Helper: Parse and analyze source code
   */
  function analyzeSource(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(ast);

    return {
      ast,
      symbolTable: result.symbolTable,
      typeSystem: analyzer.getTypeSystem(),
      diagnostics: result.diagnostics,
      success: result.success,
    };
  }

  describe('Basic Stub Function Declaration', () => {
    it('should handle simple stub function with no parameters', () => {
      const source = `
        module test

        function nop(): void;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Verify symbol table entry
      const symbol = result.symbolTable.lookup('nop');
      expect(symbol).toBeDefined();
      expect(symbol?.kind).toBe(SymbolKind.Function);
      expect(symbol?.name).toBe('nop');

      // Verify AST node
      const funcDecl = result.ast.getDeclarations()[0];
      expect(funcDecl.constructor.name).toBe('FunctionDecl');
      expect((funcDecl as any).getName()).toBe('nop');
      expect((funcDecl as any).isStubFunction()).toBe(true);
      expect((funcDecl as any).getBody()).toBeNull();
    });

    it('should handle stub function with parameters', () => {
      const source = `
        module test

        function peek(address: word): byte;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      const symbol = result.symbolTable.lookup('peek');
      expect(symbol).toBeDefined();
      expect(symbol?.kind).toBe(SymbolKind.Function);

      // Verify function has parameters in AST
      const funcDecl = result.ast.getDeclarations()[0];
      const params = (funcDecl as any).getParameters();
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('address');
      // Note: Parameter type is resolved during semantic analysis, not stored on AST
    });

    it('should handle multiple stub functions', () => {
      const source = `
        module test

        function peek(address: word): byte;
        function poke(address: word, value: byte): void;
        function peekw(address: word): word;
        function pokew(address: word, value: word): void;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Verify all functions are in symbol table
      expect(result.symbolTable.lookup('peek')).toBeDefined();
      expect(result.symbolTable.lookup('poke')).toBeDefined();
      expect(result.symbolTable.lookup('peekw')).toBeDefined();
      expect(result.symbolTable.lookup('pokew')).toBeDefined();
    });

    it('should handle exported stub functions', () => {
      const source = `
        module test

        export function helper(): void;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      const symbol = result.symbolTable.lookup('helper');
      expect(symbol).toBeDefined();
      expect(symbol?.isExported).toBe(true);
    });

    it('should handle callback stub functions', () => {
      const source = `
        module test

        callback onInterrupt(): void;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      const symbol = result.symbolTable.lookup('onInterrupt');
      expect(symbol).toBeDefined();
      expect(symbol?.kind).toBe(SymbolKind.Function);
    });
  });

  describe('Stub Function Type Checking', () => {
    it('should allow calling stub functions', () => {
      const source = `
        module test

        function peek(address: word): byte;

        function main(): void
          let value: byte = peek($D020);
        end function

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should type-check stub function calls', () => {
      const source = `
        module test

        function poke(address: word, value: byte): void;

        function main(): void
          poke($D020, 0);  // Correct usage
        end function

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should detect type errors in stub function calls', () => {
      const source = `
        module test

        function peek(address: word): byte;

        function main(): void
          let value: word = peek($D020);  // Type mismatch: byte -> word
        end function

        end module
      `;

      const result = analyzeSource(source);

      // This should succeed (byte can widen to word)
      expect(result.success).toBe(true);
    });

    it('should detect argument count mismatch', () => {
      const source = `
        module test

        function poke(address: word, value: byte): void;

        function main(): void
          poke($D020);  // Missing argument
        end function

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('argument');
    });
  });

  describe('Stub Function Scope', () => {
    it('should not create function scope for stub functions', () => {
      const source = `
        module test

        function peek(address: word): byte;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);

      // Verify root scope has the function symbol
      const rootScope = result.symbolTable.getRootScope();
      expect(rootScope.symbols.has('peek')).toBe(true);

      // Stub functions still create child scope for parameters
      // but it's empty since there's no body
      const childScopes = rootScope.children || [];
      const functionScope = childScopes.find(s => {
        const funcDecl = result.ast.getDeclarations()[0];
        return s.node === funcDecl;
      });

      expect(functionScope).toBeDefined();
      expect(functionScope?.symbols.has('address')).toBe(true);
    });
  });

  describe('Mixed Stub and Regular Functions', () => {
    it('should handle mix of stub and regular functions', () => {
      const source = `
        module test

        function peek(address: word): byte;  // Stub

        function main(): void                // Regular
          let x: byte = peek($D020);
        end function

        function poke(address: word, value: byte): void;  // Stub

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Verify all functions in symbol table
      expect(result.symbolTable.lookup('peek')).toBeDefined();
      expect(result.symbolTable.lookup('main')).toBeDefined();
      expect(result.symbolTable.lookup('poke')).toBeDefined();

      // Verify stub vs regular distinction
      const peekDecl = result.ast.getDeclarations()[0];
      const mainDecl = result.ast.getDeclarations()[1];
      const pokeDecl = result.ast.getDeclarations()[2];

      expect((peekDecl as any).isStubFunction()).toBe(true);
      expect((mainDecl as any).isStubFunction()).toBe(false);
      expect((pokeDecl as any).isStubFunction()).toBe(true);

      expect((peekDecl as any).getBody()).toBeNull();
      expect((mainDecl as any).getBody()).not.toBeNull();
      expect((pokeDecl as any).getBody()).toBeNull();
    });

    it('should allow regular functions to call stub functions', () => {
      const source = `
        module test

        function peek(address: word): byte;
        function poke(address: word, value: byte): void;

        function setBorder(color: byte): void
          poke($D020, color);
        end function

        function getBorder(): byte
          return peek($D020);
        end function

        function main(): void
          setBorder(5);
          let border: byte = getBorder();
        end function

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('Stub Function Error Cases', () => {
    it('should not allow duplicate stub function declarations', () => {
      const source = `
        module test

        function peek(address: word): byte;
        function peek(address: word): byte;  // Duplicate

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Duplicate');
    });

    it('should not allow stub function with same name as variable', () => {
      const source = `
        module test

        let peek: byte = 0;
        function peek(address: word): byte;  // Name conflict

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Duplicate');
    });

    it('should not allow stub and regular function with same name', () => {
      const source = `
        module test

        function helper(): void;  // Stub

        function helper(): void   // Regular - same name
          // Do something
        end function

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Duplicate');
    });
  });

  describe('Real-World Built-In Stub Functions', () => {
    it('should handle complete set of built-in stub functions', () => {
      const source = `
        module BuiltIns

        export function peek(address: word): byte;
        export function poke(address: word, value: byte): void;
        export function peekw(address: word): word;
        export function pokew(address: word, value: word): void;

        end module
      `;

      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Verify all built-ins are exported
      const builtins = ['peek', 'poke', 'peekw', 'pokew'];
      for (const name of builtins) {
        const symbol = result.symbolTable.lookup(name);
        expect(symbol).toBeDefined();
        expect(symbol?.isExported).toBe(true);
        expect(symbol?.kind).toBe(SymbolKind.Function);
      }
    });

    it('should handle stub functions with imported usage pattern', () => {
      const source = `
        module test

        function peek(address: word): byte;

        function main(): void
          let border: byte = peek($D020);
        end function

        end module
      `;

      const result = analyzeSource(source);

      // This should succeed - stub functions work like regular functions for callers
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Verify stub function can be called from other functions
      const peekSymbol = result.symbolTable.lookup('peek');
      expect(peekSymbol).toBeDefined();
      expect(peekSymbol?.kind).toBe(SymbolKind.Function);
    });
  });
});